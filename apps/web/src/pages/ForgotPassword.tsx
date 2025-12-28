import { useState } from 'react'
import { Link } from 'react-router-dom'
import { supabase } from '@/lib/supabase'
import { Mail, ArrowLeft, Compass } from 'lucide-react'
import { LoadingButton } from '@/components/LoadingButton'
import { BRAND } from '@/constants'

export const ForgotPassword = () => {
  const [email, setEmail] = useState('')
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')
  const [success, setSuccess] = useState(false)

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setError('')
    
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/
    if (!emailRegex.test(email)) {
      setError('Please enter a valid email address')
      return
    }
    
    setLoading(true)

    try {
      const { error: resetError } = await supabase.auth.resetPasswordForEmail(email, {
        redirectTo: `${window.location.origin}/auth/callback?type=recovery`,
      })

      if (resetError) {
        if (resetError.message.includes('rate') || resetError.message.includes('limit')) {
          setError('Too many requests. Please try again in a few minutes.')
        } else {
          // always show success for security (don't reveal if email exists)
          setSuccess(true)
        }
        return
      }

      setSuccess(true)
    } catch (err) {
      setError('Failed to send reset email. Please try again.')
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
                <Mail className="w-8 h-8 text-green-600" />
              </div>
              <h2 className="text-2xl font-bold text-gray-900 mb-2">Check Your Email</h2>
              <p className="text-gray-600 mb-4">
                We've sent a password reset link to
              </p>
              <p className="font-medium text-gray-900 mb-6">{email}</p>
              <p className="text-sm text-gray-500 mb-6">
                Click the link in the email to reset your password. If you don't see it, check your spam folder.
              </p>
              <Link
                to="/login"
                className="inline-flex items-center text-sm text-blue-600 hover:text-blue-700 font-medium transition-colors"
              >
                <ArrowLeft className="w-4 h-4 mr-1" />
                Back to login
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
            <h2 className="text-xl font-bold text-gray-900 mb-2">Reset your password</h2>
            <p className="text-gray-600 text-sm">
              Enter your email address and we'll send you a link to reset your password.
            </p>
          </div>

          <form onSubmit={handleSubmit} className="space-y-4">
            <div>
              <label htmlFor="email" className="block text-sm font-medium text-gray-700 mb-2">
                Email address
              </label>
              <div className="relative">
                <Mail className="absolute left-3 top-1/2 transform -translate-y-1/2 w-5 h-5 text-gray-400" />
                <input
                  id="email"
                  type="email"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  className="w-full pl-10 pr-3 py-3 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent transition-all"
                  placeholder="you@example.com"
                  required
                  disabled={loading}
                />
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
              loadingText="Sending..."
              className={`w-full py-3 ${BRAND.buttonGradient} text-white rounded-lg font-medium hover:opacity-90 transition-opacity`}
            >
              Send reset link
            </LoadingButton>
          </form>
        </div>
      </div>
    </div>
  )
}