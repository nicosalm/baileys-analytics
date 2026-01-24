import { useEffect, useState, useRef } from 'react'
import { useNavigate, Link } from 'react-router-dom'
import { supabase } from '@/lib/supabase'
import { useAuth } from '@/contexts/auth'
import { LoadingState } from '@/components/LoadingState'
import { AlertCircle, CheckCircle, Compass } from 'lucide-react'
import { BRAND } from '@/constants'

export const AuthCallback = () => {
  const navigate = useNavigate()
  const { setOwnerRezConnected } = useAuth()
  const [status, setStatus] = useState<'loading' | 'success' | 'error'>('loading')
  const [message, setMessage] = useState('')
  const hasHandled = useRef(false)

  useEffect(() => {
    const searchParams = new URLSearchParams(window.location.search)
    const hashParams = new URLSearchParams(window.location.hash.substring(1))

    const code = searchParams.get('code')
    const state = searchParams.get('state')
    const error = searchParams.get('error') || hashParams.get('error')
    const errorDescription = searchParams.get('error_description') || hashParams.get('error_description')
    const type = hashParams.get('type') || searchParams.get('type')

    // handle URL errors immediately
    if (error && !hasHandled.current) {
      hasHandled.current = true
      setStatus('error')
      setMessage(errorDescription || error)
      setTimeout(() => navigate('/login'), 3000)
      return
    }

    // ownerrez oauth (has both code and UUID state)
    const isOwnerRezOAuth = code && state &&
      state.match(/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i)

    if (isOwnerRezOAuth && !hasHandled.current) {
      hasHandled.current = true
      handleOwnerRezOAuth(code, state)
      return
    }

    // supabase auth flow
    handleSupabaseAuth(code, type)

    // cleanup handled by handleSupabaseAuth's internal cleanup
  }, [navigate])

  const handleSupabaseAuth = async (code: string | null, type: string | null) => {
    // set up auth state listener first
    const { data: { subscription } } = supabase.auth.onAuthStateChange((event, session) => {
      if (hasHandled.current) return

      if (event === 'SIGNED_IN' && session) {
        hasHandled.current = true
        handleSuccess(type)
      }
    })

    // small delay to let Supabase's detectSessionInUrl process first
    await new Promise(resolve => setTimeout(resolve, 100))

    // check if session already exists
    const { data: { session: existingSession } } = await supabase.auth.getSession()
    if (existingSession && !hasHandled.current) {
      hasHandled.current = true
      subscription.unsubscribe()
      handleSuccess(type)
      return
    }

    // if we have a code and no session yet, manually exchange it
    if (code && !hasHandled.current) {
      try {
        const { data, error: exchangeError } = await supabase.auth.exchangeCodeForSession(code)

        if (exchangeError) {
          // check if session was established despite error (race condition)
          const { data: { session: retrySession } } = await supabase.auth.getSession()
          if (retrySession && !hasHandled.current) {
            hasHandled.current = true
            subscription.unsubscribe()
            handleSuccess(type)
            return
          }

          if (!hasHandled.current) {
            hasHandled.current = true
            subscription.unsubscribe()
            setStatus('error')
            setMessage(exchangeError.message || 'Failed to verify authentication')
            setTimeout(() => navigate('/login'), 3000)
          }
          return
        }

        if (data?.session && !hasHandled.current) {
          hasHandled.current = true
          subscription.unsubscribe()
          handleSuccess(type)
          return
        }
      } catch (err) {
        // check if session was established despite error
        const { data: { session: fallbackSession } } = await supabase.auth.getSession()
        if (fallbackSession && !hasHandled.current) {
          hasHandled.current = true
          subscription.unsubscribe()
          handleSuccess(type)
          return
        }

        if (!hasHandled.current) {
          hasHandled.current = true
          subscription.unsubscribe()
          setStatus('error')
          setMessage('Authentication failed. Please try again.')
          setTimeout(() => navigate('/login'), 3000)
        }
        return
      }
    }

    // timeout fallback
    setTimeout(() => {
      if (!hasHandled.current) {
        // one final session check
        supabase.auth.getSession().then(({ data: { session } }) => {
          if (session && !hasHandled.current) {
            hasHandled.current = true
            subscription.unsubscribe()
            handleSuccess(type)
          } else if (!hasHandled.current) {
            hasHandled.current = true
            subscription.unsubscribe()
            setStatus('error')
            setMessage('Authentication timed out. Please try again.')
            setTimeout(() => navigate('/login'), 3000)
          }
        })
      }
    }, 8000)
  }

  const handleSuccess = (type: string | null) => {
    if (type === 'recovery') {
      setStatus('success')
      setMessage('Email verified! You can now reset your password.')
      setTimeout(() => navigate('/reset-password'), 1500)
    } else if (type === 'email_change') {
      setStatus('success')
      setMessage('Email changed successfully!')
      setTimeout(() => navigate('/dashboard/settings'), 1500)
    } else {
      setStatus('success')
      setMessage('Signed in successfully!')
      setTimeout(() => navigate('/dashboard/overview'), 1500)
    }
  }

  const handleOwnerRezOAuth = async (code: string, state: string) => {
    try {
      const { data: { session } } = await supabase.auth.getSession()
      const { api } = await import('@/lib/api')

      if (session) {
        api.setAccessToken(session.access_token)
      }

      const result = await api.oauth.callback(code, state)

      if (result.success) {
        setStatus('success')
        setMessage('Successfully connected to OwnerRez!')
        setOwnerRezConnected()
        setTimeout(() => navigate('/dashboard/overview?sync=initial'), 1000)
      } else {
        setStatus('error')
        setMessage(result.error || 'Failed to connect to OwnerRez')
        setTimeout(() => navigate('/dashboard/settings'), 3000)
      }
    } catch {
      setStatus('error')
      setMessage('Failed to complete OwnerRez connection')
      setTimeout(() => navigate('/dashboard/settings'), 3000)
    }
  }

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
