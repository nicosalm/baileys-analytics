import { Link } from 'react-router-dom'
import { useAuth } from '@/contexts/auth'
import { Footer } from '@/components/Footer'
import { ArrowLeft } from 'lucide-react'
import { BRAND } from '@/constants'

export const NotFound = () => {
  const { state } = useAuth()
  const isAuthenticated = state.status === 'authenticated'

  return (
    <div className="min-h-screen bg-background flex flex-col">
      {/* Header */}
      <header className="bg-background/80 backdrop-blur-sm border-b">
        <div className="max-w-7xl mx-auto px-6 py-4">
          <div className="flex justify-between items-center">
            <Link to="/" className="flex items-center hover:opacity-80 transition-opacity">
              <img src="/baileysanalytics.svg" alt={BRAND.name} className="w-9 h-9" />
              <h1 className="text-xl font-semibold text-foreground ml-3">{BRAND.name}</h1>
            </Link>
            <div className="flex items-center gap-3">
              {isAuthenticated ? (
                <Link to="/dashboard/overview" className={`px-5 py-2.5 bg-primary text-primary-foreground rounded-lg hover:opacity-90 transition-opacity font-medium`}>
                  Open Dashboard
                </Link>
              ) : (
                <>
                  <Link to="/login" className="px-5 py-2.5 text-foreground/80 hover:text-foreground font-medium transition-colors hover:bg-muted/70 rounded-lg">
                    Login
                  </Link>
                  <Link to="/signup" className={`px-5 py-2.5 bg-primary text-primary-foreground rounded-lg hover:opacity-90 transition-opacity font-medium`}>
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
          <h2 className="text-6xl font-light text-muted-foreground/40 mb-4">404</h2>
          <h3 className="text-xl font-semibold text-foreground mb-2">Page Not Found</h3>
          <p className="text-muted-foreground mb-8 text-sm">
            The page you're looking for doesn't exist or has been moved.
          </p>
          
          {/* Action Buttons */}
          <div className="flex items-center justify-center gap-3">
            <Link
              to="/"
              className="inline-flex items-center gap-2 px-4 py-2 text-muted-foreground hover:text-foreground transition-colors text-sm font-medium"
            >
              <ArrowLeft className="w-4 h-4" />
              Back to Home
            </Link>
            {isAuthenticated ? (
              <Link
                to="/dashboard/overview"
                className="inline-flex items-center gap-2 px-4 py-2 bg-primary text-primary-foreground rounded-lg hover:opacity-90 transition-opacity text-sm font-medium"
              >
                Go to Dashboard
              </Link>
            ) : (
              <Link
                to="/login"
                className="inline-flex items-center gap-2 px-4 py-2 bg-primary text-primary-foreground rounded-lg hover:opacity-90 transition-opacity text-sm font-medium"
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