import { Link } from 'react-router-dom'
import { useAuth } from '@/contexts/auth'

export const NotFound = () => {
  const { state } = useAuth()
  const isAuthenticated = state.status === 'authenticated'

  return (
    <div className="min-h-screen">
      <nav className="p-4 border-b">
        <div className="max-w-6xl mx-auto flex justify-between items-center">
          <h1 className="text-xl font-bold">Baileys Analytics</h1>
          <div className="space-x-4">
            {isAuthenticated ? (
              <Link to="/dashboard/overview" className="px-4 py-2 bg-blue-600 text-white rounded-sm hover:bg-blue-700 transition-colors">
                Dashboard
              </Link>
            ) : (
              <>
                <Link to="/login" className="px-4 py-2 hover:text-blue-600 transition-colors">Login</Link>
                <Link to="/signup" className="px-4 py-2 bg-blue-600 text-white rounded-sm hover:bg-blue-700 transition-colors">
                  Sign Up
                </Link>
              </>
            )}
          </div>
        </div>
      </nav>

      <main className="max-w-6xl mx-auto p-4 py-16">
        <div className="text-center">
          <h2 className="text-6xl font-bold text-gray-200 mb-4">404</h2>
          <h3 className="text-2xl font-bold mb-4">Page Not Found</h3>
          <p className="text-gray-600 mb-8">
            The page you're looking for doesn't exist or has been moved.
          </p>
          
          <div className="space-x-4">
            <Link 
              to="/" 
              className="inline-block px-6 py-3 border border-gray-300 rounded-sm hover:bg-gray-50 transition-colors"
            >
              Go Home
            </Link>
            {isAuthenticated ? (
              <Link 
                to="/dashboard/overview" 
                className="inline-block px-6 py-3 bg-blue-600 text-white rounded-sm hover:bg-blue-700 transition-colors"
              >
                Go to Dashboard
              </Link>
            ) : (
              <Link 
                to="/login" 
                className="inline-block px-6 py-3 bg-blue-600 text-white rounded-sm hover:bg-blue-700 transition-colors"
              >
                Sign In
              </Link>
            )}
          </div>
        </div>

        <div className="mt-16 text-center">
          <p className="text-gray-600 mb-4">Need help? Here are some helpful links:</p>
          <div className="flex justify-center space-x-6 text-blue-600">
            <Link to="/dashboard/overview" className="hover:underline">Overview</Link>
            <Link to="/dashboard/financial" className="hover:underline">Financial</Link>
            <Link to="/dashboard/properties" className="hover:underline">Properties</Link>
            <Link to="/settings" className="hover:underline">Settings</Link>
          </div>
        </div>
      </main>
    </div>
  )
}