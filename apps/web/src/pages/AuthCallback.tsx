import { useEffect, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { supabase } from '@/lib/supabase'
import { LoadingState } from '@/components/LoadingState'
import { AlertCircle, CheckCircle, BarChart3 } from 'lucide-react'
import { BRAND } from '@/constants'

export const AuthCallback = () => {
  const navigate = useNavigate()
  const [status, setStatus] = useState<'loading' | 'success' | 'error'>('loading')
  const [message, setMessage] = useState('')

  useEffect(() => {
    const handleCallback = async () => {
      try {
        const hashParams = new URLSearchParams(window.location.hash.substring(1))
        const searchParams = new URLSearchParams(window.location.search)
        
        const error = searchParams.get('error') || hashParams.get('error')
        const errorDescription = searchParams.get('error_description') || hashParams.get('error_description')
        
        if (error) {
          setStatus('error')
          setMessage(errorDescription || 'Authentication failed')
          setTimeout(() => navigate('/login'), 3000)
          return
        }

        const type = hashParams.get('type') || searchParams.get('type')
        
        if (!type) {
          setStatus('error')
          setMessage('Invalid callback parameters')
          setTimeout(() => navigate('/login'), 3000)
          return
        }

        switch (type) {
          case 'signup':
            setStatus('success')
            setMessage('Email confirmed successfully! Redirecting to login...')
            setTimeout(() => navigate('/login'), 2000)
            break
            
          case 'recovery':
            setStatus('success')
            setMessage('Email verified! You can now reset your password.')
            setTimeout(() => navigate('/reset-password'), 2000)
            break
            
          case 'email_change':
            setStatus('success')
            setMessage('Email changed successfully!')
            setTimeout(() => navigate('/dashboard/overview'), 2000)
            break
            
          case 'magiclink':
            const { data: { session }, error: sessionError } = await supabase.auth.getSession()
            
            if (sessionError || !session) {
              setStatus('error')
              setMessage('Failed to establish session')
              setTimeout(() => navigate('/login'), 3000)
              return
            }
            
            setStatus('success')
            setMessage('Logged in successfully!')
            setTimeout(() => navigate('/dashboard/overview'), 1500)
            break
            
          default:
            const { data: { session: defaultSession } } = await supabase.auth.getSession()
            
            if (defaultSession) {
              setStatus('success')
              setMessage('Authentication successful!')
              setTimeout(() => navigate('/dashboard/overview'), 1500)
            } else {
              setStatus('error')
              setMessage('Unknown authentication type')
              setTimeout(() => navigate('/login'), 3000)
            }
        }
      } catch (err) {
        console.error('Auth callback error:', err)
        setStatus('error')
        setMessage('An unexpected error occurred')
        setTimeout(() => navigate('/login'), 3000)
      }
    }

    handleCallback()
  }, [navigate])

  return (
    <div className="min-h-screen bg-gradient-to-br from-blue-50 via-white to-purple-50 flex items-center justify-center">
      <div className="max-w-md w-full px-8">
        <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-8">
          <div className="flex items-center justify-center mb-6">
            <div className={`w-10 h-10 ${BRAND.logoGradient} rounded-xl flex items-center justify-center shadow-sm`}>
              <BarChart3 className="w-6 h-6 text-white" />
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
              <p className="text-sm text-gray-500">Redirecting...</p>
            </div>
          )}
        </div>
      </div>
    </div>
  )
}