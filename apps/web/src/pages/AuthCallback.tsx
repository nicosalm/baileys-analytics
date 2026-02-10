import { useEffect, useState, useRef, useCallback } from 'react'
import { useNavigate, Link } from 'react-router-dom'
import { createClient } from '@supabase/supabase-js'
import { supabase, clearAuthStorage } from '@/lib/supabase'
import { useAuth } from '@/contexts/auth'
import { LoadingState } from '@/components/LoadingState'
import { AlertCircle, CheckCircle } from 'lucide-react'
import { BRAND } from '@/constants'

type AuthStatus = 'loading' | 'success' | 'error'

// Create a fresh Supabase client for code exchange.
// The main client's internal state can get corrupted, but a fresh instance
// can still read the PKCE verifier from shared localStorage.
const createCallbackClient = () => createClient(
  import.meta.env.VITE_SUPABASE_URL,
  import.meta.env.VITE_SUPABASE_ANON_KEY,
  {
    auth: {
      autoRefreshToken: false,  // Don't need this for one-time exchange
      persistSession: true,
      detectSessionInUrl: false,
      flowType: 'pkce',
      storageKey: 'baileys-auth', // Same key as main client for shared PKCE verifier
    }
  }
)

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

  const handleSuccess = useCallback((type: string | null) => {
    if (hasCompleted.current) return
    hasCompleted.current = true

    if (type === 'recovery') {
      setStatus('success')
      setMessage('Email verified! You can now reset your password.')
      setTimeout(() => navigate('/reset-password', { replace: true }), 1500)
    } else if (type === 'email_change') {
      setStatus('success')
      setMessage('Email changed successfully!')
      setTimeout(() => navigate('/dashboard/settings', { replace: true }), 1500)
    } else {
      setStatus('success')
      setMessage('Signed in successfully!')
      setTimeout(() => navigate('/dashboard/overview', { replace: true }), 1500)
    }
  }, [navigate])

  const handleError = useCallback((msg: string, redirectTo = '/login') => {
    if (hasCompleted.current) return
    hasCompleted.current = true

    // clear any corrupted auth state so user can retry with clean slate
    clearAuthStorage()

    setStatus('error')
    setMessage(msg)
    setTimeout(() => navigate(redirectTo, { replace: true }), 3000)
  }, [navigate])

  useEffect(() => {
    const searchParams = new URLSearchParams(window.location.search)
    const hashParams = new URLSearchParams(window.location.hash.substring(1))

    const code = searchParams.get('code')
    const state = searchParams.get('state')
    const error = searchParams.get('error') || hashParams.get('error')
    const errorDescription = searchParams.get('error_description') || hashParams.get('error_description')
    const type = hashParams.get('type') || searchParams.get('type')

    // DEBUG: log what we received
    // console.log('[AuthCallback] URL:', window.location.href)
    // console.log('[AuthCallback] code:', code ? 'present' : 'missing')
    // console.log('[AuthCallback] state:', state)
    // console.log('[AuthCallback] type:', type)
    // console.log('[AuthCallback] error:', error)
    // console.log('[AuthCallback] hash:', window.location.hash)

    // Handle URL errors
    if (error) {
      handleError(errorDescription || error)
      return
    }

    // OwnerRez OAuth (has both code and UUID state)
    const isOwnerRezOAuth = code && state &&
      /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(state)

    if (isOwnerRezOAuth) {
      handleOwnerRezOAuth(code, state)
      return
    }

    // Supabase auth (OAuth or email confirmation)
    handleSupabaseAuth(code, type)

    async function handleSupabaseAuth(code: string | null, type: string | null) {
      // console.log('[AuthCallback] handleSupabaseAuth starting, code:', code ? 'present' : 'missing')

      // If we have a code, go straight to exchange - don't call getSession() first
      // as it can hang when there's partial auth state
      if (code) {
        // console.log('[AuthCallback] Have code, going straight to exchange...')
        await exchangeCode(code, type)
        return
      }

      // No code - check if there's an access_token in hash (implicit flow)
      const accessToken = hashParams.get('access_token')
      if (accessToken) {
        // console.log('[AuthCallback] Found access_token in hash, setting session...')
        try {
          const { data, error } = await supabase.auth.setSession({
            access_token: accessToken,
            refresh_token: hashParams.get('refresh_token') || '',
          })
          if (!error && data.session) {
            handleSuccess(type)
            return
          }
          // console.log('[AuthCallback] setSession error:', error)
        } catch (e) {
          // console.log('[AuthCallback] setSession exception:', e)
        }
      }

      // No code and no access_token - check for existing session with timeout
      try {
        // console.log('[AuthCallback] No code/token, checking existing session with timeout...')
        const sessionPromise = supabase.auth.getSession()
        const timeoutPromise = new Promise((_, reject) =>
          setTimeout(() => reject(new Error('getSession timeout')), 5000)
        )
        const { data: { session: existingSession } } = await Promise.race([sessionPromise, timeoutPromise]) as any

        if (existingSession) {
          // console.log('[AuthCallback] Found existing session')
          handleSuccess(type)
          return
        }
      } catch (e) {
        // console.log('[AuthCallback] getSession error/timeout:', e)
      }

      // console.log('[AuthCallback] No code found, showing error')
      handleError('No authentication code found.')
    }

    async function exchangeCode(code: string, type: string | null) {
      try {
        // console.log('[AuthCallback] Creating fresh client for exchange...')
        const callbackClient = createCallbackClient()

        // console.log('[AuthCallback] Exchanging code for session...')
        // use fresh client - it reads PKCE verifier from shared localStorage but has clean internal state
        const { data, error: exchangeError } = await callbackClient.auth.exchangeCodeForSession(code)

        // console.log('[AuthCallback] Exchange result - data:', !!data?.session, 'error:', exchangeError?.message)

        if (exchangeError) {
          const msg = exchangeError.message?.toLowerCase() || ''
          console.log('[AuthCallback] Exchange error:', exchangeError.message)
          if (msg.includes('verifier') || msg.includes('pkce') || msg.includes('code challenge')) {
            handleError('Please open this link in the same browser where you started sign-in.')
          } else {
            handleError(exchangeError.message || 'Authentication failed.')
          }
          return
        }

        if (data?.session) {
          // console.log('[AuthCallback] Session obtained successfully')
          handleSuccess(type)
          return
        }

        console.log('[AuthCallback] No session in exchange response')
        handleError('Authentication failed. Please try again.')
      } catch (e) {
        console.log('[AuthCallback] Exchange exception:', e)
        handleError('Authentication failed. Please try again.')
      }
    }

    async function handleOwnerRezOAuth(code: string, state: string) {
      try {
        const { data: { session } } = await supabase.auth.getSession()
        const { api } = await import('@/lib/api')

        if (!session) {
          handleError('Not authenticated. Please log in first.', '/login')
          return
        }

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
          handleError(result.error || 'Failed to connect to OwnerRez', '/dashboard/settings')
        }
      } catch {
        handleError('Failed to complete OwnerRez connection', '/dashboard/settings')
      }
    }
  }, [handleSuccess, handleError, navigate, setOwnerRezConnected])

  // timeout safeguard - if still loading after 15 seconds, show error
  useEffect(() => {
    const timeout = setTimeout(() => {
      if (!hasCompleted.current) {
        handleError('Authentication timed out. Please try again.')
      }
    }, 15000)

    return () => clearTimeout(timeout)
  }, [handleError])

  return (
    <div className="min-h-screen bg-gradient-to-br from-blue-50 via-white to-blue-50 flex items-center justify-center">
      <div className="max-w-md w-full px-8">
        <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-8">
          <div className="flex items-center justify-center mb-6">
            <img src="/baileysanalytics.svg" alt={BRAND.name} className="w-9 h-9" />
            <h1 className="text-xl font-semibold text-gray-900 ml-3">{BRAND.name}</h1>
          </div>

          {status === 'loading' && (
            <div className="text-center">
              <LoadingState message="Processing authentication..." />
            </div>
          )}

          {status === 'success' && (
            <div className="text-center">
              <div className="w-16 h-16 bg-green-50 rounded-full flex items-center justify-center mx-auto mb-4">
                <CheckCircle className="w-8 h-8 text-green-600" />
              </div>
              <h2 className="text-xl font-bold text-gray-900 mb-2">Success</h2>
              <p className="text-gray-600">{message}</p>
            </div>
          )}

          {status === 'error' && (
            <div className="text-center">
              <div className="w-16 h-16 bg-red-50 rounded-full flex items-center justify-center mx-auto mb-4">
                <AlertCircle className="w-8 h-8 text-red-600" />
              </div>
              <h2 className="text-xl font-bold text-gray-900 mb-2">Authentication Error</h2>
              <p className="text-gray-600 mb-2">{message}</p>
              <p className="text-sm text-gray-500 mb-4">Redirecting to login...</p>
              <Link to="/login" className="text-sm text-blue-600 hover:text-blue-700 font-medium">
                Go to login →
              </Link>
            </div>
          )}
        </div>
      </div>
    </div>
  )
}
