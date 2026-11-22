import { useEffect, useState, useRef, useCallback } from 'react'
import { useNavigate, Link } from 'react-router-dom'
import { supabaseAuth, createSupabaseAuth, clearAuthStorage } from '@/lib/supabase'
import { useAuth } from '@/contexts/auth'
import { LoadingState } from '@/components/LoadingState'
import { AlertCircle, CheckCircle } from 'lucide-react'
import { BRAND } from '@/constants'
import { Logo } from '@/components/Logo'

type AuthStatus = 'loading' | 'success' | 'error'

// Create a fresh Supabase client for code exchange.
// The main client's internal state can get corrupted, but a fresh instance
// can still read the PKCE verifier from shared localStorage.
// Same storage key as the main client, so it shares the PKCE verifier; no refresh for a one-time exchange.
const createCallbackClient = () => createSupabaseAuth({ autoRefreshToken: false })

/**
 * Auth callback handler for OAuth (Google, Microsoft) and email confirmations.
 * Uses a fresh Supabase client for code exchange to avoid blocking issues.
 */
export const AuthCallback = () => {
  const navigate = useNavigate()
  const { setOwnerRezConnected } = useAuth()
  const [status, setStatus] = useState<AuthStatus>('loading')
  const [message, setMessage] = useState('')
  const hasCompleted = useRef(false)
  const hasStarted = useRef(false)
  const isOwnerRezFlow = useRef(false)

  const handleSuccess = useCallback(
    (type: string | null) => {
      if (hasCompleted.current) return
      hasCompleted.current = true

      if (type === 'recovery') {
        setStatus('success')
        setMessage('Email verified! You can now reset your password.')
        setTimeout(() => navigate('/reset-password', { replace: true }), 1500)
      } else if (type === 'email_change') {
        setStatus('success')
        setMessage('Email changed successfully!')
        setTimeout(() => navigate('/settings', { replace: true }), 1500)
      } else {
        setStatus('success')
        setMessage('Signed in successfully!')
        setTimeout(() => navigate('/dashboard/overview', { replace: true }), 1500)
      }
    },
    [navigate],
  )

  const handleError = useCallback(
    (msg: string, redirectTo = '/login') => {
      if (hasCompleted.current) return
      hasCompleted.current = true

      // clear any corrupted auth state so user can retry with clean slate
      clearAuthStorage()

      setStatus('error')
      setMessage(msg)
      setTimeout(() => navigate(redirectTo, { replace: true }), 3000)
    },
    [navigate],
  )

  useEffect(() => {
    // one-time codes must not be exchanged twice (StrictMode double-invokes effects)
    if (hasStarted.current) return
    hasStarted.current = true

    const searchParams = new URLSearchParams(window.location.search)
    const hashParams = new URLSearchParams(window.location.hash.substring(1))

    const code = searchParams.get('code')
    const state = searchParams.get('state')
    const error = searchParams.get('error') || hashParams.get('error')
    const errorDescription = searchParams.get('error_description') || hashParams.get('error_description')
    const type = hashParams.get('type') || searchParams.get('type')
    const hashAccessToken = hashParams.get('access_token')
    const hashRefreshToken = hashParams.get('refresh_token')

    const isOwnerRezState = !!state && /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(state)

    // OwnerRez denial/error: the user is still signed in, so keep their session
    if (error && isOwnerRezState) {
      hasCompleted.current = true
      setStatus('error')
      setMessage(errorDescription || 'OwnerRez connection was not completed')
      setTimeout(() => navigate('/settings', { replace: true }), 3000)
      return
    }

    // Handle URL errors
    if (error) {
      handleError(errorDescription || error)
      return
    }

    // Implicit flow — admin impersonation magic link lands here with tokens in the hash.
    // supabase.auth.admin.generateLink returns an action_link that verifies on Supabase's
    // side and redirects back with #access_token + #refresh_token. Persist via setSession
    // so the main client (storageKey: baileys-auth) picks it up on the next load.
    if (hashAccessToken && hashRefreshToken) {
      handleImplicitFlow(hashAccessToken, hashRefreshToken, type)
      return
    }

    // OwnerRez OAuth (has both code and UUID state)
    if (code && state && isOwnerRezState) {
      isOwnerRezFlow.current = true
      handleOwnerRezOAuth(code, state)
      return
    }

    // Supabase auth (OAuth or email confirmation)
    handleSupabaseAuth(code, type)

    async function handleImplicitFlow(accessToken: string, refreshToken: string, type: string | null) {
      try {
        const { error: sessionError } = await supabaseAuth.setSession({
          access_token: accessToken,
          refresh_token: refreshToken,
        })

        if (sessionError) {
          handleError(sessionError.message || 'Failed to establish session')
          return
        }

        // scrub tokens from the URL so they aren't left in history
        window.history.replaceState(null, '', window.location.pathname + window.location.search)

        if (hasCompleted.current) return
        hasCompleted.current = true

        // impersonation flows set ?impersonate=1 on redirectTo; reset-sync also sets ?sync=initial
        const isImpersonation = searchParams.get('impersonate') === '1'
        const wantsInitialSync = searchParams.get('sync') === 'initial'

        setStatus('success')
        setMessage(isImpersonation ? 'Impersonation session started' : 'Signed in successfully!')

        const target = isImpersonation
          ? `/dashboard/overview${wantsInitialSync ? '?sync=initial' : ''}`
          : type === 'recovery'
            ? '/reset-password'
            : type === 'email_change'
              ? '/settings'
              : '/dashboard/overview'

        setTimeout(() => navigate(target, { replace: true }), 500)
      } catch {
        handleError('Authentication failed. Please try again.')
      }
    }

    async function handleSupabaseAuth(code: string | null, type: string | null) {
      // If we have a code, go straight to exchange - don't call getSession() first
      // as it can hang when there's partial auth state
      if (code) {
        await exchangeCode(code, type)
        return
      }

      // No code - check for existing session with timeout
      try {
        const sessionPromise = supabaseAuth.getSession()
        const timeoutPromise = new Promise((_, reject) => setTimeout(() => reject(new Error('getSession timeout')), 5000))
        const {
          data: { session: existingSession },
        } = (await Promise.race([sessionPromise, timeoutPromise])) as Awaited<typeof sessionPromise>

        if (existingSession) {
          handleSuccess(type)
          return
        }
      } catch {
        // getSession timed out or failed
      }

      handleError('No authentication code found.')
    }

    async function exchangeCode(code: string, type: string | null) {
      try {
        // Use fresh client - it reads PKCE verifier from shared localStorage but has clean internal state
        const callbackClient = createCallbackClient()
        const { data, error: exchangeError } = await callbackClient.exchangeCodeForSession(code)

        if (exchangeError) {
          const msg = exchangeError.message?.toLowerCase() || ''
          if (msg.includes('verifier') || msg.includes('pkce') || msg.includes('code challenge')) {
            handleError('Please open this link in the same browser where you started sign-in.')
          } else {
            handleError(exchangeError.message || 'Authentication failed.')
          }
          return
        }

        if (data?.session) {
          handleSuccess(type)
          return
        }

        handleError('Authentication failed. Please try again.')
      } catch {
        handleError('Authentication failed. Please try again.')
      }
    }

    async function handleOwnerRezOAuth(code: string, state: string) {
      try {
        // getSession may return null right after a page reload because the
        // Supabase client hasn't finished initializing from localStorage yet.
        // Retry with progressive delays to handle this race condition.
        let session = (await supabaseAuth.getSession()).data.session
        if (!session) {
          const delays = [500, 1000, 1500, 2000]
          for (const delay of delays) {
            await new Promise((resolve) => setTimeout(resolve, delay))
            session = (await supabaseAuth.getSession()).data.session
            if (session) break
          }
        }

        if (!session) {
          // No session even after retry — this IS an auth issue
          handleError('Not authenticated. Please log in first.', '/login')
          return
        }

        const { api } = await import('@/lib/api')
        api.setAccessToken(session.access_token)
        const result = await api.oauth.callback(code, state)

        if (result.success) {
          if (hasCompleted.current) return
          hasCompleted.current = true

          // Update auth state directly - no database polling needed
          setOwnerRezConnected()

          setStatus('success')
          setMessage('Successfully connected to OwnerRez!')

          // Navigate after a brief moment to ensure state propagates
          setTimeout(() => navigate('/dashboard/overview?sync=initial', { replace: true }), 500)
        } else {
          // OwnerRez-specific failure — do NOT clear auth storage.
          // The user is still authenticated; redirect them to settings to retry.
          if (hasCompleted.current) return
          hasCompleted.current = true
          setStatus('error')
          setMessage(result.error || 'Failed to connect to OwnerRez')
          setTimeout(() => navigate('/settings', { replace: true }), 3000)
        }
      } catch {
        // OwnerRez-specific failure — do NOT clear auth storage.
        if (hasCompleted.current) return
        hasCompleted.current = true
        setStatus('error')
        setMessage('Failed to complete OwnerRez connection')
        setTimeout(() => navigate('/settings', { replace: true }), 3000)
      }
    }
  }, [handleSuccess, handleError, navigate, setOwnerRezConnected])

  // timeout safeguard - if still loading after 15 seconds, show error
  useEffect(() => {
    const timeout = setTimeout(() => {
      if (!hasCompleted.current) {
        if (isOwnerRezFlow.current) {
          // OwnerRez timeout — don't clear auth storage, redirect to settings
          hasCompleted.current = true
          setStatus('error')
          setMessage('OwnerRez connection timed out. Please try again from settings.')
          setTimeout(() => navigate('/settings', { replace: true }), 3000)
        } else {
          handleError('Authentication timed out. Please try again.')
        }
      }
    }, 15000)

    return () => clearTimeout(timeout)
  }, [handleError, navigate])

  return (
    <div className="min-h-screen bg-background flex items-center justify-center">
      <div className="max-w-md w-full px-8">
        <div className="bg-card rounded-xl shadow-sm border p-8">
          <div className="flex items-center justify-center mb-6">
            <Logo />
            <h1 className="text-xl font-semibold text-foreground ml-3">{BRAND.name}</h1>
          </div>

          {status === 'loading' && (
            <div className="text-center">
              <LoadingState message="Processing authentication..." />
            </div>
          )}

          {status === 'success' && (
            <div className="text-center">
              <div className="w-16 h-16 bg-success-subtle rounded-full flex items-center justify-center mx-auto mb-4">
                <CheckCircle className="w-8 h-8 text-success" />
              </div>
              <h2 className="text-xl font-bold text-foreground mb-2">Success</h2>
              <p className="text-muted-foreground">{message}</p>
            </div>
          )}

          {status === 'error' && (
            <div className="text-center">
              <div className="w-16 h-16 bg-danger-subtle rounded-full flex items-center justify-center mx-auto mb-4">
                <AlertCircle className="w-8 h-8 text-danger" />
              </div>
              <h2 className="text-xl font-bold text-foreground mb-2">Authentication Error</h2>
              <p className="text-muted-foreground mb-2">{message}</p>
              <p className="text-sm text-muted-foreground mb-4">Redirecting...</p>
              <Link to="/login" className="text-sm text-primary hover:text-primary/80 font-medium">
                Go to login →
              </Link>
            </div>
          )}
        </div>
      </div>
    </div>
  )
}
