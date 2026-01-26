import { useEffect, useState, useRef, useCallback } from 'react'
import { useNavigate, Link } from 'react-router-dom'
import { createClient } from '@supabase/supabase-js'
import { supabase } from '@/lib/supabase'
import { useAuth } from '@/contexts/auth'
import { LoadingState } from '@/components/LoadingState'
import { AlertCircle, CheckCircle, Compass } from 'lucide-react'
import { BRAND } from '@/constants'

type AuthStatus = 'loading' | 'success' | 'error'

// Create a fresh Supabase client WITHOUT detectSessionInUrl for manual code exchange.
// This avoids the race condition where the main client's detectSessionInUrl blocks everything.
// Uses the SAME storage key so the session is available to the main client.
const createCallbackClient = () => createClient(
  import.meta.env.VITE_SUPABASE_URL,
  import.meta.env.VITE_SUPABASE_ANON_KEY,
  {
    auth: {
      autoRefreshToken: true,
      persistSession: true,
      detectSessionInUrl: false,
      flowType: 'pkce',
      storageKey: 'baileys-auth', // Same key as main client
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
      // First, check if main client already has a session (e.g., page refresh)
      try {
        const { data: { session: existingSession } } = await supabase.auth.getSession()
        if (existingSession) {
          handleSuccess(type)
          return
        }
      } catch {
        // Continue with fresh client
      }

      // No existing session - exchange the code using a fresh client
      if (!code) {
        handleError('No authentication code found.')
        return
      }

      try {
        const callbackClient = createCallbackClient()
        const { data, error: exchangeError } = await callbackClient.auth.exchangeCodeForSession(code)

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
          // Session is persisted by the callback client to 'baileys-auth' storage.
          // Verify the main client can now read it.
          const { data: mainSession } = await supabase.auth.getSession()
          if (!mainSession?.session) {
            await new Promise(resolve => setTimeout(resolve, 100))
          }
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

  return (
    <div className="min-h-screen bg-gradient-to-br from-blue-50 via-white to-blue-50 flex items-center justify-center">
      <div className="max-w-md w-full px-8">
        <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-8">
          <div className="flex items-center justify-center mb-6">
            <div className={`w-9 h-9 ${BRAND.logoGradient} rounded-xl flex items-center justify-center shadow-sm`}>
              <Compass className="w-5 h-5 text-white" />
            </div>
            <h1 className="text-2xl font-semibold text-gray-900 ml-3">{BRAND.name}</h1>
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
