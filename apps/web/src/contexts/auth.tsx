import { createContext, useContext, useEffect, useState, ReactNode, useRef, useCallback } from 'react'
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
  signup: (email: string, password: string) => Promise<{ success: boolean; error?: string }>
  logout: () => Promise<void>
  resetPassword: (email: string) => Promise<boolean>
  updatePassword: (newPassword: string) => Promise<boolean>
  updateEmail: (newEmail: string) => Promise<boolean>
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
  const refreshPromiseRef = useRef<Promise<void> | null>(null)
  const isInitializedRef = useRef(false)
  const retryCountRef = useRef<Map<string, number>>(new Map())

  // utility for retry with exponential backoff
  const retryWithBackoff = async <T,>(
    fn: () => Promise<T>,
    operationName: string,
    maxRetries = 3
  ): Promise<T | null> => {
    const currentRetries = retryCountRef.current.get(operationName) || 0

    for (let i = currentRetries; i < maxRetries; i++) {
      try {
        retryCountRef.current.set(operationName, i)
        const result = await fn()
        retryCountRef.current.delete(operationName)
        return result
      } catch (error) {
        if (i === maxRetries - 1) {
          retryCountRef.current.delete(operationName)
          throw error
        }
        // exponential backoff: 1s, 2s, 4s
        await new Promise(resolve => setTimeout(resolve, Math.pow(2, i) * 1000))
      }
    }
    return null
  }

  // check if session is expired
  const isSessionExpired = (session: Session | null): boolean => {
    if (!session) return true
    if (!session.expires_at) return false

    // add a 30-second buffer before the actual expiry
    const expiryTime = new Date(session.expires_at * 1000)
    const bufferTime = new Date(expiryTime.getTime() - 30000)
    return bufferTime < new Date()
  }

  const checkOwnerRezConnection = async (userId: string): Promise<boolean> => {
    try {
      const { data: tenant, error: tenantError } = await supabase
        .from('tenants')
        .select('id')
        .eq('user_id', userId)
        .maybeSingle() as { data: { id: string } | null; error: any }

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
        .maybeSingle() as { data: { id: string } | null; error: any }

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
        } as any)
        .select('id')
        .single()

      if (insertError) {
        // maybe it was created by another process, try to fetch again
        const { data: retryTenant } = await supabase
          .from('tenants')
          .select('id')
          .eq('user_id', userId)
          .maybeSingle() as { data: { id: string } | null; error: any }

        if (retryTenant) {
          return retryTenant.id
        }

        return null
      }

      return (newTenant as any)?.id || null
    } catch (err) {
      return null
    }
  }

  const processSession = useCallback(async (session: Session | null) => {
    if (!session) {
      api.setAccessToken(null)
      setState({ status: 'unauthenticated' })
      return
    }

    // check if session is about to expire or already expired
    if (isSessionExpired(session)) {
      // trigger a refresh instead of processing stale session
      const { data: { session: refreshedSession } } = await supabase.auth.refreshSession()
      if (!refreshedSession) {
        api.setAccessToken(null)
        setState({ status: 'unauthenticated' })
        return
      }
      session = refreshedSession
    }

    api.setAccessToken(session.access_token)

    // ensure tenant exists with retry logic
    const tenantId = await retryWithBackoff(
      () => ensureTenantExists(session.user.id, session.user.email),
      'ensureTenantExists',
      2
    )

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
  }, []) // keep deps empty to avoid recreation, internal functions are stable

  const login = async (email: string, password: string): Promise<boolean> => {
    try {
      const { data, error } = await supabase.auth.signInWithPassword({
        email,
        password,
      })

      if (error) {
        return false
      }

      if (data.user && data.session) {
        // process session immediately to avoid race condition
        await processSession(data.session)
        return true
      }
      return false
    } catch (error) {
      return false
    }
  }

  const signup = async (email: string, password: string): Promise<{ success: boolean; error?: string }> => {
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
        return { success: false, error: error.message }
      }

      if (data.user && !data.session) {
        return { success: true }
      }

      if (data.user && data.session) {
        // process session immediately
        await processSession(data.session)
        return { success: true }
      }
      return { success: false, error: 'Unknown error occurred' }
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Unknown error occurred'
      return { success: false, error: message }
    }
  }

  const logout = async () => {
    try {
      await supabase.auth.signOut()
    } catch (error) {
      // Silent error handling
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
      // Check if session exists first
      const { data: { session } } = await supabase.auth.getSession()
      if (!session) {
        return false
      }

      // Add timeout to prevent indefinite hanging
      const timeoutPromise = new Promise<never>((_, reject) =>
        setTimeout(() => reject(new Error('Password update timeout')), 15000)
      )

      const updatePromise = supabase.auth.updateUser({
        password: newPassword
      })

      const { error } = await Promise.race([updatePromise, timeoutPromise])

      if (error) {
        return false
      }

      return true
    } catch (error) {
      return false
    }
  }

  const updateEmail = async (newEmail: string): Promise<boolean> => {
    try {
      // Check if session exists first
      const { data: { session } } = await supabase.auth.getSession()
      if (!session) {
        return false
      }

      // Add timeout to prevent indefinite hanging (15 seconds)
      const timeoutPromise = new Promise<never>((_, reject) => {
        const timeoutId = setTimeout(() => {
          reject(new Error('Email update timeout after 15 seconds'))
        }, 15000)
        return timeoutId
      })

      const updatePromise = supabase.auth.updateUser(
        { email: newEmail },
        { emailRedirectTo: `${window.location.origin}/auth/callback` }
      )

      const result = await Promise.race([updatePromise, timeoutPromise])

      if (result.error) {
        return false
      }

      return true
    } catch (error) {
      return false
    }
  }

  const refreshUser = useCallback(async () => {
    // prevent multiple simultaneous refresh attempts
    if (refreshPromiseRef.current) {
      return refreshPromiseRef.current
    }

    refreshPromiseRef.current = (async () => {
      try {
        // first try to get the existing session
        const { data: { session }, error } = await supabase.auth.getSession()

        if (error) {
          api.setAccessToken(null)
          setState({ status: 'unauthenticated' })
          return
        }

        // if we have a session, try to refresh it
        if (session) {
          const { data: { session: refreshedSession }, error: refreshError } = await supabase.auth.refreshSession()

          if (!refreshError && refreshedSession) {
            await processSession(refreshedSession)
          } else {
            // couldn't refresh, use existing session
            await processSession(session)
          }
        } else {
          api.setAccessToken(null)
          setState({ status: 'unauthenticated' })
        }
      } catch (error) {
        api.setAccessToken(null)
        setState({ status: 'unauthenticated' })
      } finally {
        refreshPromiseRef.current = null
      }
    })()

    return refreshPromiseRef.current
  }, [processSession])

  useEffect(() => {
    // prevent multiple initializations
    if (isInitializedRef.current) {
      return
    }
    isInitializedRef.current = true

    // set up auth state change listener first
    const { data: { subscription } } = supabase.auth.onAuthStateChange(async (event, session) => {
      // handle different auth events
      switch (event) {
        case 'SIGNED_OUT':
          api.setAccessToken(null)
          setState({ status: 'unauthenticated' })
          break

        case 'SIGNED_IN':
          // only process if we're not already authenticated
          // this prevents duplicate processing after login
          if (state.status !== 'authenticated' && session) {
            await processSession(session)
          }
          break

        case 'TOKEN_REFRESHED':
        case 'USER_UPDATED':
          if (session) {
            // update token without full reprocessing
            api.setAccessToken(session.access_token)
            setState(prevState => {
              if (prevState.status === 'authenticated') {
                return {
                  ...prevState,
                  session
                }
              }
              return prevState
            })
          }
          break

        case 'INITIAL_SESSION':
          // handle initial session on page load
          if (session) {
            await processSession(session)
          } else {
            setState({ status: 'unauthenticated' })
          }
          break

        case 'PASSWORD_RECOVERY':
          // Password recovery mode activated
          break
      }
    })

    // check for existing session after setting up listener
    // this ensures we don't miss any auth state changes
    supabase.auth.getSession().then(({ data: { session } }) => {
      if (session) {
        processSession(session)
      } else {
        setState({ status: 'unauthenticated' })
      }
    })

    return () => {
      subscription.unsubscribe()
      isInitializedRef.current = false
    }
  }, []) // removed processSession from deps to prevent re-runs

  return (
    <AuthContext.Provider value={{ state, login, signup, logout, resetPassword, updatePassword, updateEmail, refreshUser }}>
      {children}
    </AuthContext.Provider>
  )
}