import { createContext, useContext, useEffect, useState, ReactNode } from 'react'
import { supabase } from '@/lib/supabase'
import { api } from '@/lib/api'
import { Session } from '@supabase/supabase-js'
import { AppUser } from '@/types/auth'

type AuthState =
  | { status: 'loading' }
  | { status: 'unauthenticated' }
  | { status: 'authenticated'; user: AppUser; session: Session }

type AuthContextValue = {
  state: AuthState
  login: (email: string, password: string) => Promise<boolean>
  signup: (email: string, password: string) => Promise<boolean>
  logout: () => Promise<void>
  resetPassword: (email: string) => Promise<boolean>
  updatePassword: (newPassword: string) => Promise<boolean>
  refreshUser: () => Promise<void>
}

const AuthContext = createContext<AuthContextValue | null>(null)

export const useAuth = () => {
  const context = useContext(AuthContext)
  if (!context) throw new Error('useAuth must be used within AuthProvider')
  return context
}


export const AuthProvider = ({ children }: { children: ReactNode }) => {
  const [state, setState] = useState<AuthState>({ status: 'loading' })

  const checkOwnerRezConnection = async (userId: string): Promise<boolean> => {
    try {
      const { data: tenant, error: tenantError } = await supabase
        .from('tenants')
        .select('id')
        .eq('user_id', userId)
        .maybeSingle()
      
      if (!tenantError && tenant) {
        const { data: oauthToken } = await supabase
          .from('oauth_tokens')
          .select('id')
          .eq('tenant_id', tenant.id)
          .eq('provider', 'ownerrez')
          .maybeSingle()
        
        return !!oauthToken
      }
      return false
    } catch {
      return false
    }
  }

  const ensureTenantExists = async (userId: string, email: string | undefined): Promise<string | null> => {
    if (!email) return null
    
    try {
      // check if tenant exists
      const { data: existingTenant } = await supabase
        .from('tenants')
        .select('id')
        .eq('user_id', userId)
        .maybeSingle()
        
      if (existingTenant) {
        return existingTenant.id
      }
      
      // create tenant if it doesn't exist
      const { data: newTenant, error: insertError } = await supabase
        .from('tenants')
        .insert({
          user_id: userId,
          email: email,
          company_name: 'My Company',
          ownerrez_connected: false
        })
        .select('id')
        .single()
        
      if (insertError) {
        // maybe it was created by another process, try to fetch again
        const { data: retryTenant } = await supabase
          .from('tenants')
          .select('id')
          .eq('user_id', userId)
          .maybeSingle()
          
        if (retryTenant) {
          return retryTenant.id
        }
        
        console.error('Failed to create tenant:', insertError)
        return null
      }
      
      return newTenant?.id || null
    } catch (err) {
      console.error('Error ensuring tenant exists:', err)
      return null
    }
  }

  const login = async (email: string, password: string): Promise<boolean> => {
    try {
      const { data, error } = await supabase.auth.signInWithPassword({
        email,
        password,
      })
      
      if (error) {
        console.error('Login failed:', error.message)
        return false
      }
      
      if (data.user && data.session) {
        api.setAccessToken(data.session.access_token)
        
        // ensure tenant exists for this user
        await ensureTenantExists(data.user.id, data.user.email)
        
        let hasOwnerRezConnection = data.user.user_metadata?.has_ownerrez_connection || false
        
        if (!hasOwnerRezConnection) {
          hasOwnerRezConnection = await checkOwnerRezConnection(data.user.id)
        }
        
        
        const appUser: AppUser = {
          ...data.user,
          companyName: data.user.user_metadata?.company_name,
          hasOwnerRezConnection,
          tenantId: data.user.user_metadata?.tenant_id
        }
        
        setState({
          status: 'authenticated',
          user: appUser,
          session: data.session
        })
        
        return true
      }
      return false
    } catch (error) {
      console.error('Login error:', error)
      return false
    }
  }

  const signup = async (email: string, password: string): Promise<boolean> => {
    try {
      // sign out any existing user first to prevent session mixup
      const { data: { session: existingSession } } = await supabase.auth.getSession()
      if (existingSession) {
        await supabase.auth.signOut()
        api.setAccessToken(null)
      }
      
      const { data, error } = await supabase.auth.signUp({
        email,
        password,
        options: {
          emailRedirectTo: `${window.location.origin}/auth/callback`,
        }
      })
      
      if (error) {
        console.error('Signup failed:', error.message)
        return false
      }
      
      if (data.user && !data.session) {
        console.log('Please check your email for confirmation link')
        return true
      }
      
      if (data.user && data.session) {
        api.setAccessToken(data.session.access_token)
        
        // ensure tenant exists for new user
        const tenantId = await ensureTenantExists(data.user.id, data.user.email)
        
        let hasOwnerRezConnection = data.user.user_metadata?.has_ownerrez_connection || false
        
        if (!hasOwnerRezConnection) {
          hasOwnerRezConnection = await checkOwnerRezConnection(data.user.id)
        }
        
        const appUser: AppUser = {
          ...data.user,
          companyName: data.user.user_metadata?.company_name,
          hasOwnerRezConnection,
          tenantId: tenantId || data.user.user_metadata?.tenant_id
        }
        
        setState({
          status: 'authenticated',
          user: appUser,
          session: data.session
        })
        
        return true
      }
      return false
    } catch (error) {
      console.error('Signup error:', error)
      return false
    }
  }

  const logout = async () => {
    try {
      const { error } = await supabase.auth.signOut()
      if (error) {
        console.error('Logout error:', error.message)
      }
    } catch (error) {
      console.error('Logout error:', error)
    } finally {
      api.setAccessToken(null)
      setState({ status: 'unauthenticated' })
    }
  }

  const resetPassword = async (email: string): Promise<boolean> => {
    try {
      const { error } = await supabase.auth.resetPasswordForEmail(email, {
        redirectTo: `${window.location.origin}/auth/callback?type=recovery`,
      })
      return !error
    } catch {
      return false
    }
  }

  const updatePassword = async (newPassword: string): Promise<boolean> => {
    try {
      const { error } = await supabase.auth.updateUser({
        password: newPassword
      })
      return !error
    } catch {
      return false
    }
  }

  const refreshUser = async () => {
    try {
      // always clear token first to prevent using stale tokens
      api.setAccessToken(null)
      
      const { data: { session } } = await supabase.auth.getSession()
      
      if (session) {
        api.setAccessToken(session.access_token)
        
        // ensure tenant exists
        const tenantId = await ensureTenantExists(session.user.id, session.user.email)
        
        let hasOwnerRezConnection = session.user.user_metadata?.has_ownerrez_connection || false
        
        if (!hasOwnerRezConnection) {
          hasOwnerRezConnection = await checkOwnerRezConnection(session.user.id)
        }
        
        const appUser: AppUser = {
          ...session.user,
          companyName: session.user.user_metadata?.company_name,
          hasOwnerRezConnection,
          tenantId: tenantId || session.user.user_metadata?.tenant_id
        }
        
        setState({
          status: 'authenticated',
          user: appUser,
          session
        })
      } else {
        setState({ status: 'unauthenticated' })
      }
    } catch (error) {
      console.error('Auth initialization error:', error)
      setState({ status: 'unauthenticated' })
    }
  }

  useEffect(() => {
    refreshUser()

    const { data: { subscription } } = supabase.auth.onAuthStateChange(async (event, session) => {
      console.log('Auth state change:', event, session?.user?.email)
      
      if (event === 'SIGNED_OUT') {
        api.setAccessToken(null)
        setState({ status: 'unauthenticated' })
      } else if (event === 'SIGNED_IN' && session) {
        // handle new sign in (including after signup)
        api.setAccessToken(session.access_token)
        
        // ensure tenant exists
        const tenantId = await ensureTenantExists(session.user.id, session.user.email)
        
        let hasOwnerRezConnection = session.user.user_metadata?.has_ownerrez_connection || false
        
        if (!hasOwnerRezConnection) {
          hasOwnerRezConnection = await checkOwnerRezConnection(session.user.id)
        }
        
        const appUser: AppUser = {
          ...session.user,
          companyName: session.user.user_metadata?.company_name,
          hasOwnerRezConnection,
          tenantId: tenantId || session.user.user_metadata?.tenant_id
        }
        
        setState({
          status: 'authenticated',
          user: appUser,
          session
        })
      } else if (event === 'TOKEN_REFRESHED' && session) {
        // update token when refreshed
        api.setAccessToken(session.access_token)
        
        // ensure tenant exists
        await ensureTenantExists(session.user.id, session.user.email)
        
        let hasOwnerRezConnection = session.user.user_metadata?.has_ownerrez_connection || false
        
        if (!hasOwnerRezConnection) {
          hasOwnerRezConnection = await checkOwnerRezConnection(session.user.id)
        }
        
        const appUser: AppUser = {
          ...session.user,
          companyName: session.user.user_metadata?.company_name,
          hasOwnerRezConnection,
          tenantId: session.user.user_metadata?.tenant_id
        }
        
        setState({
          status: 'authenticated',
          user: appUser,
          session
        })
      }
    })

    return () => {
      subscription.unsubscribe()
    }
  }, [])


  return (
    <AuthContext.Provider value={{ state, login, signup, logout, resetPassword, updatePassword, refreshUser }}>
      {children}
    </AuthContext.Provider>
  )
}
