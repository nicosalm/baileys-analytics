import { createContext, useContext, useEffect, useState, type ReactNode, useRef, useCallback } from 'react'
import { supabase } from '@/lib/supabase'
import { api } from '@/lib/api'
import type { Session } from '@supabase/supabase-js'
import type { AppUser, MeResponse } from '@/types/auth'

type AuthState = { status: 'loading' } | { status: 'unauthenticated' } | { status: 'authenticated'; user: AppUser; session: Session }

type AuthContextValue = {
  state: AuthState
  login: (email: string, password: string) => Promise<boolean>
  signup: (email: string, password: string) => Promise<{ success: boolean; error?: string }>
  signInWithGoogle: () => Promise<boolean>
  signInWithMicrosoft: () => Promise<boolean>
  signInAsDemo: () => Promise<boolean>
  logout: () => Promise<void>
  resetPassword: (email: string) => Promise<boolean>
  updatePassword: (newPassword: string) => Promise<boolean>
  updateEmail: (newEmail: string) => Promise<boolean>
  refreshUser: () => Promise<void>
  setOwnerRezConnected: () => void
  setCompanyName: (name: string | null) => void
}

const AuthContext = createContext<AuthContextValue | null>(null)

const isOAuthUser = (identities?: { provider: string }[]): boolean => {
  return identities?.some((id) => ['google', 'azure'].includes(id.provider)) ?? false
}

export const useAuth = () => {
  const context = useContext(AuthContext)
  if (!context) throw new Error('useAuth must be used within AuthProvider')
  return context
}

export const AuthProvider = ({ children }: { children: ReactNode }) => {
  const [state, setState] = useState<AuthState>({ status: 'loading' })
  const stateRef = useRef<AuthState>(state)
  const refreshPromiseRef = useRef<Promise<void> | null>(null)
  const isInitializedRef = useRef(false)

  // keep ref in sync with state for use in callbacks
  useEffect(() => {
    stateRef.current = state
  }, [state])

  // utility for retry with exponential backoff
  const isSessionExpired = (session: Session | null): boolean => {
    if (!session) return true
    if (!session.expires_at) return false

    // add a 30-second buffer before the actual expiry
    const expiryTime = new Date(session.expires_at * 1000)
    const bufferTime = new Date(expiryTime.getTime() - 30000)
    return bufferTime < new Date()
  }

  const processSession = useCallback(async (session: Session | null): Promise<boolean> => {
    if (!session) {
      api.setAccessToken(null)
      setState({ status: 'unauthenticated' })
      return false
    }

    // check if session is about to expire or already expired
    if (isSessionExpired(session)) {
      // trigger a refresh instead of processing stale session
      const {
        data: { session: refreshedSession },
      } = await supabase.auth.refreshSession()
      if (!refreshedSession) {
        api.setAccessToken(null)
        setState({ status: 'unauthenticated' })
        return false
      }
      session = refreshedSession
    }

    api.setAccessToken(session.access_token)

    // anonymous users get demo mode — skip tenant creation and ownerrez checks
    const isAnonymous = session.user.is_anonymous === true

    if (isAnonymous) {
      const appUser: AppUser = {
        ...session.user,
        hasOwnerRezConnection: true,
        tenantId: 'demo',
        isOAuthUser: false,
        companyName: 'Lakeshore Retreats',
        isDemo: true,
      }

      setState({ status: 'authenticated', user: appUser, session })
      return true
    }

    const me = await Promise.race([
      api.request<MeResponse>('/auth/me'),
      new Promise<null>((resolve) => setTimeout(() => resolve(null), 10000)),
    ])
    const profile = me?.success ? me.data : null

    const appUser: AppUser = {
      ...session.user,
      hasOwnerRezConnection: profile?.hasOwnerRezConnection ?? false,
      tenantId: profile?.tenantId ?? undefined,
      isOAuthUser: isOAuthUser(session.user.identities),
      companyName: profile?.companyName ?? null,
      isDemo: false,
    }

    setState({
      status: 'authenticated',
      user: appUser,
      session,
    })

    return true
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
        // process session and return its result to properly handle edge cases
        return await processSession(data.session)
      }
      return false
    } catch (error) {
      return false
    }
  }

  const signup = async (email: string, password: string): Promise<{ success: boolean; error?: string }> => {
    try {
      const { data, error } = await supabase.auth.signUp({
        email,
        password,
        options: {
          emailRedirectTo: `${window.location.origin}/auth/callback?type=signup`,
        },
      })

      if (error) {
        return { success: false, error: error.message }
      }

      // email confirmation required - user created but no session yet
      if (data.user && !data.session) {
        return { success: true }
      }

      // email confirmation not required - user created with session
      // (this happens if email confirmation is disabled in Supabase settings)
      if (data.user && data.session) {
        const processed = await processSession(data.session)
        return { success: processed, error: processed ? undefined : 'Failed to process session' }
      }

      // edge case: no user returned (shouldn't happen without error)
      return { success: false, error: 'Failed to create account' }
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Failed to create account'
      return { success: false, error: message }
    }
  }

  const signInWithGoogle = async (): Promise<boolean> => {
    try {
      const { error } = await supabase.auth.signInWithOAuth({
        provider: 'google',
        options: {
          redirectTo: `${window.location.origin}/auth/callback`,
        },
      })
      return !error
    } catch {
      return false
    }
  }

  const signInWithMicrosoft = async (): Promise<boolean> => {
    try {
      const { error } = await supabase.auth.signInWithOAuth({
        provider: 'azure',
        options: {
          redirectTo: `${window.location.origin}/auth/callback`,
        },
      })
      return !error
    } catch {
      return false
    }
  }

  const signInAsDemo = async (): Promise<boolean> => {
    try {
      const { data, error } = await supabase.auth.signInAnonymously()
      if (error || !data.session) return false
      return await processSession(data.session)
    } catch {
      return false
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
      // Verify user is authenticated via server-side check (getUser validates the JWT
      // against the Auth server, unlike getSession which only reads local storage)
      const {
        data: { user },
        error: userError,
      } = await supabase.auth.getUser()
      if (userError || !user) {
        return false
      }

      // Add timeout to prevent indefinite hanging
      const timeoutPromise = new Promise<never>((_, reject) => setTimeout(() => reject(new Error('Password update timeout')), 15000))

      const updatePromise = supabase.auth.updateUser({
        password: newPassword,
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
      // Verify user is authenticated via server-side check
      const {
        data: { user },
        error: userError,
      } = await supabase.auth.getUser()
      if (userError || !user) {
        return false
      }

      // Add timeout to prevent indefinite hanging (15 seconds)
      const timeoutPromise = new Promise<never>((_, reject) => {
        const timeoutId = setTimeout(() => {
          reject(new Error('Email update timeout after 15 seconds'))
        }, 15000)
        return timeoutId
      })

      const updatePromise = supabase.auth.updateUser({ email: newEmail }, { emailRedirectTo: `${window.location.origin}/auth/callback` })

      const result = await Promise.race([updatePromise, timeoutPromise])

      if (result.error) {
        return false
      }

      return true
    } catch (error) {
      return false
    }
  }

  const setCompanyName = useCallback((name: string | null) => {
    setState((prevState) => {
      if (prevState.status === 'authenticated') {
        return {
          ...prevState,
          user: {
            ...prevState.user,
            companyName: name,
          },
        }
      }
      return prevState
    })
  }, [])

  // directly update hasOwnerRezConnection state after oauth success
  // this avoids race conditions from polling the database
  const setOwnerRezConnected = useCallback(() => {
    setState((prevState) => {
      if (prevState.status === 'authenticated') {
        return {
          ...prevState,
          user: {
            ...prevState.user,
            hasOwnerRezConnection: true,
          },
        }
      }
      return prevState
    })
  }, [])

  const refreshUser = useCallback(async () => {
    // prevent multiple simultaneous refresh attempts
    if (refreshPromiseRef.current) {
      return refreshPromiseRef.current
    }

    refreshPromiseRef.current = (async () => {
      try {
        // verify the user is actually authenticated via server-side check
        const {
          data: { user },
          error: userError,
        } = await supabase.auth.getUser()

        if (userError || !user) {
          api.setAccessToken(null)
          setState({ status: 'unauthenticated' })
          return
        }

        // user is valid — refresh the session to get fresh tokens
        const {
          data: { session: refreshedSession },
          error: refreshError,
        } = await supabase.auth.refreshSession()

        if (!refreshError && refreshedSession) {
          await processSession(refreshedSession)
        } else {
          // couldn't refresh — treat as unauthenticated
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
    const {
      data: { subscription },
    } = supabase.auth.onAuthStateChange((event, session) => {
      // handle different auth events — avoid async work directly in this callback
      // per Supabase docs (risk of deadlocks). Use setTimeout to defer instead.
      switch (event) {
        case 'SIGNED_OUT':
          api.setAccessToken(null)
          setState({ status: 'unauthenticated' })
          break

        case 'SIGNED_IN':
          // only process if we're not already authenticated
          // use ref to avoid stale closure
          // defer with setTimeout to avoid deadlocks — Supabase docs warn against
          // calling async Supabase functions inside onAuthStateChange callbacks
          if (stateRef.current.status !== 'authenticated' && session) {
            setTimeout(() => processSession(session), 0)
          }
          break

        case 'TOKEN_REFRESHED':
        case 'USER_UPDATED':
          if (session) {
            // update token without full reprocessing
            api.setAccessToken(session.access_token)
            setState((prevState) => {
              if (prevState.status === 'authenticated') {
                return {
                  ...prevState,
                  session,
                }
              }
              return prevState
            })
          }
          break

        case 'INITIAL_SESSION':
          // handle initial session on page load
          // defer with setTimeout to avoid deadlocks in auth state change callback
          if (session) {
            setTimeout(() => processSession(session), 0)
          } else {
            setState({ status: 'unauthenticated' })
          }
          break

        case 'PASSWORD_RECOVERY':
          // Password recovery mode activated
          break
      }
    })

    // INITIAL_SESSION event (above) handles the initial session check —
    // no need for a separate getSession() call, which would cause
    // processSession to run twice concurrently on page load.

    return () => {
      subscription.unsubscribe()
      isInitializedRef.current = false
    }
  }, []) // removed processSession from deps to prevent re-runs

  return (
    <AuthContext.Provider
      value={{
        state,
        login,
        signup,
        signInWithGoogle,
        signInWithMicrosoft,
        signInAsDemo,
        logout,
        resetPassword,
        updatePassword,
        updateEmail,
        refreshUser,
        setOwnerRezConnected,
        setCompanyName,
      }}
    >
      {children}
    </AuthContext.Provider>
  )
}
