import { useState } from 'react'
import { useNavigate, Link } from 'react-router-dom'
import { useAuth } from '@/contexts/auth'
import { useToast } from '@/contexts/toast'
import { LoadingButton } from '@/components/LoadingButton'
import { ArrowLeft, Mail, Lock, BarChart3, CheckCircle } from 'lucide-react'
import { BRAND } from '@/constants'

export const Signup = () => {
  const navigate = useNavigate()
  const { signup } = useAuth()
  const { addToast } = useToast()
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [confirmPassword, setConfirmPassword] = useState('')
  const [loading, setLoading] = useState(false)

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    
    if (password !== confirmPassword) {
      addToast('error', 'Passwords do not match')
      return
    }

    if (password.length < 8) {
      addToast('error', 'Password must be at least 8 characters')
      return
    }

    setLoading(true)
    const success = await signup(email, password)
    setLoading(false)

    if (success) {
      addToast('success', 'Account created successfully!')
      navigate('/dashboard')
    } else {
      addToast('error', 'Failed to create account. Email may already be in use.')
    }
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-blue-50 via-white to-purple-50 flex">
      {/* Left side - Signup Form */}
      <div className="w-full lg:w-1/2 flex flex-col justify-center px-8 lg:px-16 xl:px-24">
        <div className="max-w-md w-full mx-auto">
          {/* Back to home link */}
          <Link to="/" className="inline-flex items-center text-sm text-gray-600 hover:text-gray-900 transition-colors mb-8">
            <ArrowLeft className="w-4 h-4 mr-1" />
            Back to home
          </Link>

          {/* Logo */}
          <div className="flex items-center mb-8">
            <div className={`w-10 h-10 ${BRAND.logoGradient} rounded-xl flex items-center justify-center shadow-sm`}>
              <BarChart3 className="w-6 h-6 text-white" />
            </div>
            <h1 className="text-2xl font-semibold text-gray-900 ml-3">{BRAND.name}</h1>
          </div>

          {/* Welcome text */}
          <div className="mb-8">
            <h2 className="text-3xl font-bold text-gray-900 mb-2">Start your free trial</h2>
            <p className="text-gray-600">14 days free. No credit card required.</p>
          </div>

          {/* Signup form */}
          <form onSubmit={handleSubmit} className="space-y-6">
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
                  required
                  className="w-full pl-10 pr-3 py-3 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500 transition-colors"
                  placeholder="you@example.com"
                />
              </div>
            </div>

            <div>
              <label htmlFor="password" className="block text-sm font-medium text-gray-700 mb-2">
                Password
              </label>
              <div className="relative">
                <Lock className="absolute left-3 top-1/2 transform -translate-y-1/2 w-5 h-5 text-gray-400" />
                <input
                  id="password"
                  type="password"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  required
                  minLength={8}
                  className="w-full pl-10 pr-3 py-3 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500 transition-colors"
                  placeholder="Minimum 8 characters"
                />
              </div>
            </div>

            <div>
              <label htmlFor="confirmPassword" className="block text-sm font-medium text-gray-700 mb-2">
                Confirm password
              </label>
              <div className="relative">
                <Lock className="absolute left-3 top-1/2 transform -translate-y-1/2 w-5 h-5 text-gray-400" />
                <input
                  id="confirmPassword"
                  type="password"
                  value={confirmPassword}
                  onChange={(e) => setConfirmPassword(e.target.value)}
                  required
                  minLength={8}
                  className="w-full pl-10 pr-3 py-3 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500 transition-colors"
                  placeholder="Re-enter your password"
                />
              </div>
            </div>

            <div className="flex items-start">
              <input
                id="terms"
                type="checkbox"
                required
                className="h-4 w-4 text-blue-600 border-gray-300 rounded focus:ring-blue-500 mt-1"
              />
              <label htmlFor="terms" className="ml-2 block text-sm text-gray-700">
                I agree to the{' '}
                <Link to="/terms" className="text-blue-600 hover:text-blue-700">
                  Terms of Service
                </Link>{' '}
                and{' '}
                <Link to="/privacy" className="text-blue-600 hover:text-blue-700">
                  Privacy Policy
                </Link>
              </label>
            </div>

            <LoadingButton
              type="submit"
              loading={loading}
              loadingText="Creating account..."
              className={`w-full py-3 ${BRAND.buttonGradient} text-white rounded-lg font-medium hover:shadow-lg transition-all transform hover:scale-[1.02]`}
            >
              Start free trial
            </LoadingButton>
          </form>

          {/* Sign in link */}
          <p className="mt-8 text-center text-gray-600">
            Already have an account?{' '}
            <Link to="/login" className="font-medium text-blue-600 hover:text-blue-700">
              Sign in
            </Link>
          </p>
        </div>
      </div>

      {/* Right side - Decorative */}
      <div className="hidden lg:flex lg:w-1/2 bg-gradient-to-br from-blue-600 to-purple-600 relative overflow-hidden">
        {/* Floating shapes */}
        <div className="absolute top-20 left-10 w-72 h-72 bg-blue-500 rounded-full mix-blend-multiply filter blur-xl opacity-20 animate-blob" />
        <div className="absolute top-40 right-10 w-72 h-72 bg-purple-500 rounded-full mix-blend-multiply filter blur-xl opacity-20 animate-blob animation-delay-2000" />
        <div className="absolute bottom-20 left-20 w-72 h-72 bg-pink-500 rounded-full mix-blend-multiply filter blur-xl opacity-20 animate-blob animation-delay-4000" />
        
        <div className="relative z-10 flex flex-col justify-center px-16 text-white">
          <h3 className="text-4xl font-bold mb-6">Everything You Need to Succeed</h3>
          <p className="text-lg opacity-90 mb-8">
            Get started in minutes with our powerful analytics platform.
          </p>
          
          {/* Feature list */}
          <div className="space-y-6">
            <div className="flex items-start">
              <CheckCircle className="w-6 h-6 mr-3 flex-shrink-0 mt-0.5" />
              <div>
                <h4 className="font-semibold mb-1">Connect in seconds</h4>
                <p className="opacity-90 text-sm">Seamless OwnerRez integration with OAuth</p>
              </div>
            </div>
            <div className="flex items-start">
              <CheckCircle className="w-6 h-6 mr-3 flex-shrink-0 mt-0.5" />
              <div>
                <h4 className="font-semibold mb-1">Instant insights</h4>
                <p className="opacity-90 text-sm">Your data transformed into actionable metrics</p>
              </div>
            </div>
            <div className="flex items-start">
              <CheckCircle className="w-6 h-6 mr-3 flex-shrink-0 mt-0.5" />
              <div>
                <h4 className="font-semibold mb-1">Scale with confidence</h4>
                <p className="opacity-90 text-sm">From 1 to 100+ properties, we grow with you</p>
              </div>
            </div>
          </div>

          {/* Trust badge */}
          <div className="mt-12 pt-8 border-t border-white/20">
            <p className="text-sm opacity-75">Made with 🧀 in Wisconsin</p>
          </div>
        </div>
      </div>
    </div>
  )
}