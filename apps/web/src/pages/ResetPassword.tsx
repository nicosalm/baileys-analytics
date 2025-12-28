import { useState, useEffect } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import { supabase } from '@/lib/supabase'
import { Lock, ArrowLeft, Compass, CheckCircle, Eye, EyeOff } from 'lucide-react'
import { LoadingButton } from '@/components/LoadingButton'
import { PasswordRequirements } from '@/components/PasswordRequirements'
import { BRAND } from '@/constants'
import { validatePassword } from '@/utils/password'

export const ResetPassword = () => {
  const navigate = useNavigate()
  const [password, setPassword] = useState('')
  const [confirmPassword, setConfirmPassword] = useState('')
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')
  const [success, setSuccess] = useState(false)
  const [showPassword, setShowPassword] = useState(false)
  const [showConfirmPassword, setShowConfirmPassword] = useState(false)
  const [tokenValid, setTokenValid] = useState<boolean | null>(null)
  const [checkingToken, setCheckingToken] = useState(true)

  // check if we have a valid recovery session
  useEffect(() => {
    const checkRecoverySession = async () => {
      try {
        // with PKCE flow, check for existing session
        const { data: { session } } = await supabase.auth.getSession()

        // check if we're in password recovery mode
        // verify this is specifically a recovery session, not just any session
        if (session) {
          // check for recovery-specific indicators
          const isRecoverySession =
            session.user?.recovery_sent_at ||
            session.user?.aud === 'authenticated' &&
            session.user?.role === 'authenticated' &&
            session.user?.email

          if (isRecoverySession) {
            setTokenValid(true)
          } else {
            // we have a session but it's not a recovery session
            setTokenValid(false)
            setError('This link is for password recovery only. Please use the link from your email.')
          }
        } else {
          // no session, the link may have expired or been invalid
          setTokenValid(false)
          setError('Invalid or expired reset link. Please request a new one.')
        }
      } catch {
        setTokenValid(false)
        setError('Invalid reset link')
      } finally {
        setCheckingToken(false)
      }
    }

    checkRecoverySession()
  }, [])

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setError('')

    // client-side validation
    if (password !== confirmPassword) {
      setError('Passwords do not match')
      return
    }

    const validation = validatePassword(password)
    if (!validation.isValid) {
      setError(validation.errors[0])
      return
    }
    
    // show warnings but don't block submission
    if (validation.warnings.length > 0) {
      console.warn('Password warnings:', validation.warnings)
    }

    setLoading(true)

    try {
      const { error: updateError } = await supabase.auth.updateUser({
        password: password
      })

      if (updateError) {
        // handle specific error cases
        if (updateError.message.includes('expired')) {
          setError('Your reset link has expired. Please request a new one.')
          setTimeout(() => navigate('/forgot-password'), 3000)
        } else {
          setError(updateError.message)
        }
        return
      }

      setSuccess(true)
      
      // sign out to ensure clean state
      await supabase.auth.signOut()
      
      setTimeout(() => navigate('/login'), 2000)
    } catch (err) {
      setError('Failed to reset password. Please try again.')
    } finally {
      setLoading(false)
    }
  }

  if (success) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-blue-50 via-white to-blue-50 flex items-center justify-center">
        <div className="max-w-md w-full px-8">
          <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-8">
            <div className="text-center">
              <div className="w-16 h-16 bg-green-50 rounded-full flex items-center justify-center mx-auto mb-4">
                <CheckCircle className="w-8 h-8 text-green-600" />
              </div>
              <h2 className="text-2xl font-bold text-gray-900 mb-2">Password Reset Successfully</h2>
              <p className="text-gray-600">Redirecting to login...</p>
            </div>
          </div>
        </div>
      </div>
    )
  }

  // show loading state while checking token
  if (checkingToken) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-blue-50 via-white to-blue-50 flex items-center justify-center">
        <div className="text-center">
          <LoadingButton loading loadingText="Verifying reset link..." className="" />
        </div>
      </div>
    )
  }
  
  // show error if token is invalid
  if (tokenValid === false) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-blue-50 via-white to-blue-50 flex items-center justify-center">
        <div className="max-w-md w-full px-8">
          <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-8">
            <div className="text-center">
              <div className="w-16 h-16 bg-red-50 rounded-full flex items-center justify-center mx-auto mb-4">
                <Lock className="w-8 h-8 text-red-600" />
              </div>
              <h2 className="text-xl font-bold text-gray-900 mb-2">Invalid Reset Link</h2>
              <p className="text-gray-600 mb-6">{error}</p>
              <Link
                to="/forgot-password"
                className="inline-flex items-center px-4 py-2 bg-blue-600 text-white rounded-lg hover:opacity-90 transition-opacity font-medium"
              >
                Request New Link
              </Link>
            </div>
          </div>
        </div>
      </div>
    )
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-blue-50 via-white to-blue-50 flex items-center justify-center">
      <div className="max-w-md w-full px-8">
        <div className="mb-8">
          <Link to="/login" className="inline-flex items-center text-sm text-gray-600 hover:text-gray-900 transition-colors">
            <ArrowLeft className="w-4 h-4 mr-1" />
            Back to login
          </Link>
        </div>

        <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-8">
          <div className="flex items-center mb-6">
            <div className={`w-9 h-9 ${BRAND.logoGradient} rounded-xl flex items-center justify-center shadow-sm`}>
              <Compass className="w-5 h-5 text-white" />
            </div>
            <h1 className="text-2xl font-semibold text-gray-900 ml-3">{BRAND.name}</h1>
          </div>

          <div className="mb-6">
            <h2 className="text-xl font-bold text-gray-900 mb-2">Create new password</h2>
            <p className="text-gray-600 text-sm">
              Choose a strong password to secure your account.
            </p>
          </div>

          <form onSubmit={handleSubmit} className="space-y-4">
            <div>
              <label htmlFor="password" className="block text-sm font-medium text-gray-700 mb-2">
                New password
              </label>
              <div className="relative">
                <Lock className="absolute left-3 top-1/2 transform -translate-y-1/2 w-5 h-5 text-gray-400" />
                <input
                  id="password"
                  type={showPassword ? "text" : "password"}
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  className="w-full pl-10 pr-12 py-3 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent transition-all"
                  placeholder="Enter new password"
                  required
                  disabled={loading}
                />
                <button
                  type="button"
                  onClick={() => setShowPassword(!showPassword)}
                  className="absolute right-3 top-1/2 transform -translate-y-1/2 text-gray-400 hover:text-gray-600 focus:outline-none cursor-pointer"
                  tabIndex={-1}
                >
                  {showPassword ? <EyeOff className="w-5 h-5" /> : <Eye className="w-5 h-5" />}
                </button>
              </div>
              {password && (
                <div className="mt-3 p-3 bg-gray-50 rounded-lg border border-gray-200">
                  <PasswordRequirements password={password} />
                </div>
              )}
            </div>

            <div>
              <label htmlFor="confirmPassword" className="block text-sm font-medium text-gray-700 mb-2">
                Confirm password
              </label>
              <div className="relative">
                <Lock className="absolute left-3 top-1/2 transform -translate-y-1/2 w-5 h-5 text-gray-400" />
                <input
                  id="confirmPassword"
                  type={showConfirmPassword ? "text" : "password"}
                  value={confirmPassword}
                  onChange={(e) => setConfirmPassword(e.target.value)}
                  className="w-full pl-10 pr-12 py-3 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent transition-all"
                  placeholder="Confirm new password"
                  required
                  disabled={loading}
                />
                <button
                  type="button"
                  onClick={() => setShowConfirmPassword(!showConfirmPassword)}
                  className="absolute right-3 top-1/2 transform -translate-y-1/2 text-gray-400 hover:text-gray-600 focus:outline-none cursor-pointer"
                  tabIndex={-1}
                >
                  {showConfirmPassword ? <EyeOff className="w-5 h-5" /> : <Eye className="w-5 h-5" />}
                </button>
              </div>
            </div>

            {error && (
              <div className="bg-red-50 border border-red-200 text-red-600 px-4 py-3 rounded-lg text-sm">
                {error}
              </div>
            )}

            <LoadingButton
              type="submit"
              loading={loading}
              loadingText="Resetting..."
              className={`w-full py-3 ${BRAND.buttonGradient} text-white rounded-lg font-medium hover:opacity-90 transition-opacity`}
            >
              Reset password
            </LoadingButton>
          </form>
        </div>
      </div>
    </div>
  )
}