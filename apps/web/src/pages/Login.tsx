import { useState, useEffect, useRef } from 'react'
import { useNavigate, Link, useSearchParams } from 'react-router-dom'
import { useAuth } from '@/contexts/auth'
import { useToast } from '@/contexts/toast'
import { LoadingButton } from '@/components/LoadingButton'
import { ArrowLeft, Mail, Lock, Compass, Eye, EyeOff } from 'lucide-react'
import { BRAND } from '@/constants'

export const Login = () => {
  const navigate = useNavigate()
  const [searchParams] = useSearchParams()
  const { login, state } = useAuth()
  const { addToast } = useToast()
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [loading, setLoading] = useState(false)
  const [showPassword, setShowPassword] = useState(false)
  const hasShownSuccessToast = useRef(false)
  const hasShownOAuthSuccess = useRef(false)
  
  // check for oauth success message
  useEffect(() => {
    if (searchParams.get('oauth') === 'success' && !hasShownOAuthSuccess.current) {
      addToast('success', 'OwnerRez connected successfully!')
      hasShownOAuthSuccess.current = true
      // If user is authenticated, they just connected OwnerRez, trigger sync
      if (state.status === 'authenticated') {
        navigate('/dashboard/overview?sync=initial', { replace: true })
      }
    }
  }, [searchParams, addToast, state.status, navigate])
  
  // redirect when authentication state changes
  useEffect(() => {
    if (state.status === 'authenticated') {
      // show success toast only if we just logged in
      if (loading && !hasShownSuccessToast.current) {
        addToast('success', 'Welcome back!')
        hasShownSuccessToast.current = true
      }
      setLoading(false)
      
      // Check if we need to trigger initial sync after OAuth
      if (localStorage.getItem('pendingInitialSync') === 'true') {
        // Don't remove from localStorage yet, let Dashboard handle it
        console.log('Pending initial sync detected, redirecting to dashboard')
        navigate('/dashboard/overview', { replace: true })
      } else {
        navigate('/dashboard/overview', { replace: true })
      }
    }
  }, [state.status, navigate, loading, addToast])

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    
    if (!email || !password) {
      addToast('error', 'Please enter your email and password')
      return
    }
    
    setLoading(true)
    hasShownSuccessToast.current = false
    const success = await login(email, password)
    
    if (!success) {
      setLoading(false)
      addToast('error', 'Invalid email or password. Please try again.')
    }
    // if success, the useEffect above will handle navigation
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-blue-50 via-white to-purple-50 flex">
      {/* Left side - Login Form */}
      <div className="w-full lg:w-1/2 flex flex-col justify-center px-8 lg:px-16 xl:px-24">
        <div className="max-w-md w-full mx-auto">
          {/* Back to home link */}
          <Link to="/" className="inline-flex items-center text-sm text-gray-600 hover:text-gray-900 transition-all mb-8">
            <ArrowLeft className="w-4 h-4 mr-1" />
            Back to home
          </Link>

          {/* Logo */}
          <div className="flex items-center mb-8">
            <div className={`w-10 h-10 ${BRAND.logoGradient} rounded-xl flex items-center justify-center shadow-sm`}>
              <Compass className="w-6 h-6 text-white" />
            </div>
            <h1 className="text-2xl font-semibold text-gray-900 ml-3">{BRAND.name}</h1>
          </div>

          {/* Welcome text */}
          <div className="mb-8">
            <h2 className="text-3xl font-bold text-gray-900 mb-2">Welcome back</h2>
            <p className="text-gray-600 mb-3">Enter your credentials to access your dashboard</p>
            <p className="text-sm text-gray-500">
              Baileys Analytics - Vacation rental analytics and reporting for OwnerRez users
            </p>
          </div>

          {/* Login form */}
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
                  className="w-full pl-10 pr-3 py-3 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent transition-all"
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
                  type={showPassword ? "text" : "password"}
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  required
                  className="w-full pl-10 pr-12 py-3 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent transition-all"
                  placeholder="••••••••"
                />
                <button
                  type="button"
                  onClick={() => setShowPassword(!showPassword)}
                  className="absolute right-3 top-1/2 transform -translate-y-1/2 text-gray-400 hover:text-gray-600 focus:outline-none"
                  tabIndex={-1}
                >
                  {showPassword ? <EyeOff className="w-5 h-5" /> : <Eye className="w-5 h-5" />}
                </button>
              </div>
            </div>

            <div className="flex justify-end">
              <Link to="/forgot-password" className="text-sm text-blue-600 hover:text-blue-700 font-medium">
                Forgot password?
              </Link>
            </div>

            <LoadingButton
              type="submit"
              loading={loading}
              loadingText="Signing in..."
              className={`w-full py-3 ${BRAND.buttonGradient} text-white rounded-lg font-medium hover:shadow-lg transition-all transform hover:scale-[1.02]`}
            >
              Sign in
            </LoadingButton>
          </form>

          {/* Sign up link */}
          <p className="mt-8 text-center text-gray-600">
            Don't have an account?{' '}
            <Link to="/signup" className="font-medium text-blue-600 hover:text-blue-700">
              Start your free trial
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
          <h3 className="text-4xl font-bold mb-6">Pull Back the Curtain on Your Rental Revenue</h3>
          <p className="text-lg opacity-90 mb-8">
            Join property managers who've transformed their data into actionable insights.
          </p>
          
          {/* Feature highlights */}
          <div className="space-y-4">
            <div className="flex items-start">
              <div className="w-2 h-2 bg-white rounded-full mt-2 mr-3 flex-shrink-0" />
              <p className="opacity-90">Real-time sync with OwnerRez</p>
            </div>
            <div className="flex items-start">
              <div className="w-2 h-2 bg-white rounded-full mt-2 mr-3 flex-shrink-0" />
              <p className="opacity-90">Automated tax calculations</p>
            </div>
            <div className="flex items-start">
              <div className="w-2 h-2 bg-white rounded-full mt-2 mr-3 flex-shrink-0" />
              <p className="opacity-90">Beautiful analytics dashboards</p>
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}