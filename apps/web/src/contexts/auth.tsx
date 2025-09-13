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
      const { data: tenant } = await supabase
        .from('tenants')
        .select('id')
        .eq('user_id', userId)
        .single()
      
      if (tenant) {
        const { data: oauthToken } = await supabase
          .from('oauth_tokens')
          .select('id')
          .eq('tenant_id', tenant.id)
          .eq('provider', 'ownerrez')
          .single()
        
        return !!oauthToken
      }
      return false
    } catch {
      return false
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
      const { data: { session } } = await supabase.auth.getSession()
      
      if (session) {
        api.setAccessToken(session.access_token)
        
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
      // only react to sign out events from onAuthStateChange
      // sign in is handled by the login function itself to avoid race conditions
      if (event === 'SIGNED_OUT') {
        api.setAccessToken(null)
        setState({ status: 'unauthenticated' })
      } else if (event === 'TOKEN_REFRESHED' && session) {
        // update token when refreshed
        api.setAccessToken(session.access_token)
        
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
