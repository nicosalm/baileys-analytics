import { Link } from 'react-router-dom'
import { useAuth } from '@/contexts/auth'
import { Footer } from '@/components/Footer'
import { Compass, ArrowLeft } from 'lucide-react'
import { BRAND } from '@/constants'

export const NotFound = () => {
  const { state } = useAuth()
  const isAuthenticated = state.status === 'authenticated'

  return (
    <div className="min-h-screen bg-gradient-to-b from-slate-50 via-white to-slate-50 flex flex-col">
      {/* Header */}
      <header className="bg-white/80 backdrop-blur-sm border-b border-gray-200">
        <div className="max-w-7xl mx-auto px-6 py-4">
          <div className="flex justify-between items-center">
            <Link to="/" className="flex items-center hover:opacity-80 transition-opacity">
              <div className={`w-9 h-9 ${BRAND.logoGradient} rounded-xl flex items-center justify-center shadow-sm`}>
                <Compass className="w-5 h-5 text-white" />
              </div>
              <h1 className="text-xl font-semibold text-gray-900 ml-3">{BRAND.name}</h1>
            </Link>
            <div className="flex items-center gap-3">
              {isAuthenticated ? (
                <Link to="/dashboard/overview" className={`px-5 py-2.5 ${BRAND.buttonGradient} text-white rounded-lg hover:shadow-lg transition-all hover:scale-[1.02] font-medium`}>
                  Open Dashboard
                </Link>
              ) : (
                <>
                  <Link to="/login" className="px-5 py-2.5 text-gray-700 hover:text-gray-900 font-medium transition-all hover:bg-gray-100/70 rounded-lg">
                    Login
                  </Link>
                  <Link to="/signup" className={`px-5 py-2.5 ${BRAND.buttonGradient} text-white rounded-lg hover:shadow-lg transition-all hover:scale-[1.02] font-medium`}>
                    Start Free Trial
                  </Link>
                </>
              )}
            </div>
          </div>
        </div>
      </header>

      <main className="flex-1 max-w-7xl mx-auto px-6 py-12 w-full flex items-center justify-center">
        <div className="text-center max-w-lg">
          {/* Error Message */}
          <h2 className="text-6xl font-light text-gray-300 mb-4">404</h2>
          <h3 className="text-xl font-semibold text-gray-900 mb-2">Page Not Found</h3>
          <p className="text-gray-600 mb-8 text-sm">
            The page you're looking for doesn't exist or has been moved.
          </p>
          
          {/* Action Buttons */}
          <div className="flex items-center justify-center gap-3">
            <Link 
              to="/" 
              className="inline-flex items-center gap-2 px-4 py-2 text-gray-600 hover:text-gray-900 transition-colors text-sm font-medium"
            >
              <ArrowLeft className="w-4 h-4" />
              Back to Home
            </Link>
            {isAuthenticated ? (
              <Link 
                to="/dashboard/overview" 
                className="inline-flex items-center gap-2 px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-all text-sm font-medium"
              >
                Go to Dashboard
              </Link>
            ) : (
              <Link 
                to="/login" 
                className="inline-flex items-center gap-2 px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-all text-sm font-medium"
              >
                Sign In
              </Link>
            )}
          </div>
        </div>
      </main>
      
      <Footer />
    </div>
  )
}