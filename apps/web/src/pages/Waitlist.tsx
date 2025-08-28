import { useState } from 'react'
import { useNavigate, Link } from 'react-router-dom'
import { useToast } from '@/contexts/toast'
import { LoadingButton } from '@/components/LoadingButton'
import { ArrowLeft, Mail, BarChart3, CheckCircle, Home, Sparkles } from 'lucide-react'
import { BRAND } from '@/constants'

export const Waitlist = () => {
  const navigate = useNavigate()
  const { addToast } = useToast()
  const [email, setEmail] = useState('')
  const [company, setCompany] = useState('')
  const [properties, setProperties] = useState('')
  const [loading, setLoading] = useState(false)

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    
    setLoading(true)
    
    try {
      // Use environment variable for API URL
      const apiUrl = import.meta.env.VITE_API_URL || 'http://localhost:7071/api'
      
      const response = await fetch(`${apiUrl}/waitlist`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          email,
          company,
          properties,
        }),
      })
      
      const data = await response.json()
      
      if (response.ok) {
        addToast('success', '🎉 You\'re on the list! Check your email for confirmation.')
        
        // Clear form
        setEmail('')
        setCompany('')
        setProperties('')
      } else {
        throw new Error(data.error || 'Failed to join waitlist')
      }
    } catch (error) {
      console.error('Error joining waitlist:', error)
      addToast('error', 'Something went wrong. Please try again or email us directly at hello@baileysanalytics.com')
      
      // Fallback: Store in localStorage if API fails
      const waitlistEntry = {
        email,
        company,
        properties,
        timestamp: new Date().toISOString()
      }
      
      const waitlist = JSON.parse(localStorage.getItem('earlyAccessWaitlist') || '[]')
      if (!waitlist.find((entry: any) => entry.email === email)) {
        waitlist.push(waitlistEntry)
        localStorage.setItem('earlyAccessWaitlist', JSON.stringify(waitlist))
      }
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-blue-50 via-white to-purple-50 flex">
      {/* Left side - Waitlist Form */}
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
            <h2 className="text-3xl font-bold text-gray-900 mb-2">Join the Early Access List</h2>
            <p className="text-gray-600 mb-3">Be among the first to transform your rental data.</p>
            <p className="text-sm text-gray-500">
              Baileys Analytics provides comprehensive vacation rental analytics and reporting 
              by integrating with your OwnerRez account. Track revenue, taxes, occupancy, and guest data.
            </p>
            <div className="mt-4 p-3 bg-amber-50 border border-amber-200 rounded-lg">
              <p className="text-sm text-amber-800">
                <strong>🚀 Launching October 2025</strong> - Early access members get 15% off for life!
              </p>
            </div>
          </div>

          {/* Waitlist form */}
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

            {/* Optional: Company field for waitlist */}
            <div>
              <label htmlFor="company" className="block text-sm font-medium text-gray-700 mb-2">
                Company (optional)
              </label>
              <div className="relative">
                <Home className="absolute left-3 top-1/2 transform -translate-y-1/2 w-5 h-5 text-gray-400" />
                <input
                  id="company"
                  type="text"
                  value={company}
                  onChange={(e) => setCompany(e.target.value)}
                  placeholder="Your property management company"
                  className="w-full pl-10 pr-3 py-3 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500 transition-colors"
                />
              </div>
            </div>

            {/* Optional: Property count for waitlist prioritization */}
            <div>
              <label htmlFor="properties" className="block text-sm font-medium text-gray-700 mb-2">
                Number of properties (optional)
              </label>
              <select
                id="properties"
                value={properties}
                onChange={(e) => setProperties(e.target.value)}
                className="w-full px-3 py-3 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500 transition-colors"
              >
                <option value="">Select range</option>
                <option value="1-5">1-5 properties</option>
                <option value="6-20">6-20 properties</option>
                <option value="21-50">21-50 properties</option>
                <option value="50+">50+ properties</option>
              </select>
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
              loadingText="Joining waitlist..."
              className={`w-full py-3 ${BRAND.buttonGradient} text-white rounded-lg font-medium hover:shadow-lg transition-all transform hover:scale-[1.02]`}
            >
              Join Early Access List
            </LoadingButton>
          </form>

          {/* Sign in link */}
          <div className="mt-8 text-center">
            <p className="text-gray-600 mb-2">
              Already have early access?{' '}
              <Link to="/login" className="font-medium text-blue-600 hover:text-blue-700">
                Sign in
              </Link>
            </p>
            <p className="text-xs text-gray-500">
              Full registration will open when we launch in October 2025
            </p>
          </div>
        </div>
      </div>

      {/* Right side - Benefits */}
      <div className="hidden lg:flex lg:w-1/2 bg-gradient-to-br from-blue-600 to-purple-600 relative overflow-hidden items-center justify-center">
        {/* Floating shapes */}
        <div className="absolute top-20 left-10 w-72 h-72 bg-blue-500 rounded-full mix-blend-multiply filter blur-xl opacity-20 animate-blob" />
        <div className="absolute top-40 right-10 w-72 h-72 bg-purple-500 rounded-full mix-blend-multiply filter blur-xl opacity-20 animate-blob animation-delay-2000" />
        <div className="absolute -bottom-8 left-20 w-72 h-72 bg-pink-500 rounded-full mix-blend-multiply filter blur-xl opacity-20 animate-blob animation-delay-4000" />
        
        <div className="relative z-10 text-white p-12 max-w-lg">
          <div className="mb-8 inline-flex items-center px-4 py-2 bg-white/20 backdrop-blur-sm rounded-full text-sm font-medium">
            <Sparkles className="w-4 h-4 mr-2" />
            Early Access Benefits
          </div>
          
          <h3 className="text-3xl font-bold mb-6">Why Join Early?</h3>
          
          <div className="space-y-4">
            <div className="flex items-start">
              <CheckCircle className="w-6 h-6 text-green-400 mr-3 flex-shrink-0 mt-0.5" />
              <div>
                <p className="font-semibold">15% Off Forever</p>
                <p className="text-sm opacity-90">Lock in lifetime savings as an early supporter</p>
              </div>
            </div>
            
            <div className="flex items-start">
              <CheckCircle className="w-6 h-6 text-green-400 mr-3 flex-shrink-0 mt-0.5" />
              <div>
                <p className="font-semibold">Priority Onboarding</p>
                <p className="text-sm opacity-90">Get white-glove setup assistance from our team</p>
              </div>
            </div>
            
            <div className="flex items-start">
              <CheckCircle className="w-6 h-6 text-green-400 mr-3 flex-shrink-0 mt-0.5" />
              <div>
                <p className="font-semibold">Shape the Product</p>
                <p className="text-sm opacity-90">Your feedback will directly influence features</p>
              </div>
            </div>
            
            <div className="flex items-start">
              <CheckCircle className="w-6 h-6 text-green-400 mr-3 flex-shrink-0 mt-0.5" />
              <div>
                <p className="font-semibold">Exclusive Access</p>
                <p className="text-sm opacity-90">Be first to try new features as we launch them</p>
              </div>
            </div>
          </div>
        </div>
      </div>
      
      <style>{`
        @keyframes blob {
          0% { transform: translate(0px, 0px) scale(1); }
          33% { transform: translate(30px, -50px) scale(1.1); }
          66% { transform: translate(-20px, 20px) scale(0.9); }
          100% { transform: translate(0px, 0px) scale(1); }
        }
        .animate-blob {
          animation: blob 7s infinite;
        }
        .animation-delay-2000 {
          animation-delay: 2s;
        }
        .animation-delay-4000 {
          animation-delay: 4s;
        }
      `}</style>
    </div>
  )
}