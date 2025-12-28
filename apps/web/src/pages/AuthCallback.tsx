import { useEffect, useState, useRef } from 'react'
import { useNavigate, Link } from 'react-router-dom'
import { supabase } from '@/lib/supabase'
import { useAuth } from '@/contexts/auth'
import { LoadingState } from '@/components/LoadingState'
import { AlertCircle, CheckCircle, Compass } from 'lucide-react'
import { BRAND } from '@/constants'

export const AuthCallback = () => {
  const navigate = useNavigate()
  const { refreshUser } = useAuth()
  const [status, setStatus] = useState<'loading' | 'success' | 'error'>('loading')
  const [message, setMessage] = useState('')
  const hasHandled = useRef(false)

  // google oauth - listen for auth state changes
  useEffect(() => {
    if (hasHandled.current) return

    const { data: { subscription } } = supabase.auth.onAuthStateChange((event, session) => {
      if (hasHandled.current) return

      if (event === 'SIGNED_IN' && session) {
        hasHandled.current = true
        setStatus('success')
        setMessage('Signed in successfully!')
        navigate('/dashboard/overview')
      }
    })

    supabase.auth.getSession().then(({ data: { session } }) => {
      if (session && !hasHandled.current) {
        hasHandled.current = true
        setStatus('success')
        setMessage('Signed in successfully!')
        navigate('/dashboard/overview')
      }
    })

    return () => subscription.unsubscribe()
  }, [navigate])

  // specialized flows: errors, ownerrez, type-based
  useEffect(() => {
    if (hasHandled.current) return

    const hashParams = new URLSearchParams(window.location.hash.substring(1))
    const searchParams = new URLSearchParams(window.location.search)

    const code = searchParams.get('code')
    const state = searchParams.get('state')
    const error = searchParams.get('error') || hashParams.get('error')
    const errorDescription = searchParams.get('error_description') || hashParams.get('error_description')
    const type = hashParams.get('type') || searchParams.get('type')

    if (error) {
      hasHandled.current = true
      if (error === 'flow_state_not_found') {
        supabase.auth.getSession().then(async ({ data: { session } }) => {
          if (session) {
            setStatus('success')
            setMessage('Already authenticated, redirecting...')
            setTimeout(() => navigate('/dashboard/overview'), 1000)
          } else {
            setStatus('error')
            setMessage('Session expired. Please log in again.')
            setTimeout(() => navigate('/login'), 2000)
          }
        })
      } else {
        setStatus('error')
        setMessage(errorDescription || 'Authentication failed')
        setTimeout(() => navigate('/login'), 3000)
      }
      return
    }

    // ownerrez oauth (uuid state format)
    const isOwnerRezOAuth = code && state &&
      state.match(/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i)

    if (isOwnerRezOAuth) {
      hasHandled.current = true
      handleOwnerRezOAuth(code, state)
      return
    }

    if (type) {
      hasHandled.current = true
      handleTypeBasedFlow(type, code)
      return
    }
  }, [navigate, refreshUser])

  const handleOwnerRezOAuth = async (code: string, state: string) => {
    const oauthInitiated = sessionStorage.getItem('oauth_initiated')
    if (oauthInitiated) {
      sessionStorage.removeItem('oauth_initiated')
    }

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

        localStorage.setItem('pendingInitialSync', 'true')
        await refreshUser()
        await new Promise(resolve => setTimeout(resolve, 500))

        const { data: { session: currentSession } } = await supabase.auth.getSession()

        if (currentSession) {
          setTimeout(() => navigate('/dashboard/overview?sync=initial'), 1500)
        } else {
          setMessage('OwnerRez connected! Please log in to continue.')
          setTimeout(() => navigate('/login?oauth=success'), 2000)
        }
      } else {
        setStatus('error')
        setMessage(result.error || 'Failed to connect to OwnerRez')
        setTimeout(() => navigate('/dashboard/settings'), 3000)
      }
    } catch {
      setStatus('error')
      setMessage('Failed to complete OAuth connection')
      setTimeout(() => navigate('/dashboard/settings'), 3000)
    }
  }

  const handleTypeBasedFlow = async (type: string, code: string | null) => {
    switch (type) {
      case 'signup':
      case 'invite': {
        const { data: { session } } = await supabase.auth.getSession()
        if (session) {
          setStatus('success')
          setMessage('Email confirmed! Logging you in...')
          setTimeout(() => navigate('/dashboard/overview'), 2000)
        } else {
          setStatus('success')
          setMessage('Email confirmed successfully! Please log in.')
          setTimeout(() => navigate('/login'), 2000)
        }
        break
      }

      case 'recovery': {
        if (code) {
          try {
            const { error } = await supabase.auth.exchangeCodeForSession(code)
            if (!error) {
              setStatus('success')
              setMessage('Email verified! You can now reset your password.')
              setTimeout(() => navigate('/reset-password'), 2000)
            } else {
              setStatus('error')
              setMessage('Failed to verify recovery link')
              setTimeout(() => navigate('/forgot-password'), 3000)
            }
          } catch {
            setStatus('error')
            setMessage('Recovery link expired or invalid')
            setTimeout(() => navigate('/forgot-password'), 3000)
          }
        } else {
          setStatus('success')
          setMessage('Email verified! You can now reset your password.')
          setTimeout(() => navigate('/reset-password'), 2000)
        }
        break
      }

      case 'email_change': {
        try {
          await refreshUser()
          setStatus('success')
          setMessage('Email changed successfully!')
          setTimeout(() => navigate('/dashboard/settings'), 2000)
        } catch {
          setStatus('success')
          setMessage('Email changed! Please refresh the page to see updates.')
          setTimeout(() => navigate('/dashboard/settings'), 3000)
        }
        break
      }

      case 'magiclink': {
        const { data: { session }, error } = await supabase.auth.getSession()
        if (error || !session) {
          setStatus('error')
          setMessage('Failed to establish session')
          setTimeout(() => navigate('/login'), 3000)
          return
        }
        setStatus('success')
        setMessage('Logged in successfully!')
        setTimeout(() => navigate('/dashboard/overview'), 1500)
        break
      }

      default: {
        const { data: { session } } = await supabase.auth.getSession()
        if (session) {
          setStatus('success')
          setMessage('Authentication successful!')
          setTimeout(() => navigate('/dashboard/overview'), 1500)
        } else {
          setStatus('error')
          setMessage('Unknown authentication type')
          setTimeout(() => navigate('/login'), 3000)
        }
      }
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
              <p className="text-sm text-gray-500 mb-4">Redirecting...</p>
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
