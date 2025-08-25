import { Link, useLocation } from 'react-router-dom'
import { Footer } from '@/components/Footer'
import { BarChart3, FileText, Shield, ArrowLeft, ChevronRight } from 'lucide-react'

interface LegalLayoutProps {
  children: React.ReactNode
}

export const LegalLayout = ({ children }: LegalLayoutProps) => {
  const location = useLocation()
  
  const legalPages = [
    { path: '/terms', label: 'Terms of Service', icon: FileText },
    { path: '/privacy', label: 'Privacy Policy', icon: Shield }
  ]

  return (
    <div className="min-h-screen flex flex-col bg-gradient-to-b from-slate-50 via-white to-slate-50">
      {/* Header */}
      <header className="bg-white border-b sticky top-0 z-40">
        <div className="max-w-7xl mx-auto px-6">
          <div className="flex items-center justify-between h-16">
            {/* Logo */}
            <Link to="/" className="flex items-center">
              <div className="w-8 h-8 bg-gradient-to-r from-blue-600 to-blue-700 rounded-lg flex items-center justify-center mr-3">
                <BarChart3 className="w-5 h-5 text-white" />
              </div>
              <span className="text-xl font-bold text-gray-900">Baileys Analytics</span>
              <ChevronRight className="w-5 h-5 mx-2 text-gray-400" />
              <span className="text-xl text-gray-600">Legal</span>
            </Link>

            {/* Back to home */}
            <Link 
              to="/" 
              className="text-sm text-gray-600 hover:text-gray-900 transition-colors flex items-center"
            >
              <ArrowLeft className="w-4 h-4 mr-1" />
              Back to home
            </Link>
          </div>
        </div>
      </header>

      <div className="flex-1 max-w-7xl mx-auto px-6 py-12 w-full">
        <div className="grid md:grid-cols-4 gap-8">
          {/* Sidebar Navigation */}
          <aside className="md:col-span-1">
            <nav className="sticky top-24 space-y-1">
              <h3 className="text-xs font-semibold text-gray-500 uppercase tracking-wider mb-3">
                Legal Documents
              </h3>
              {legalPages.map(({ path, label, icon: Icon }) => {
                const isActive = location.pathname === path
                return (
                  <Link
                    key={path}
                    to={path}
                    className={`
                      flex items-center px-3 py-2 text-sm rounded-lg transition-all
                      ${isActive 
                        ? 'bg-blue-50 text-blue-700 font-medium' 
                        : 'text-gray-600 hover:text-gray-900 hover:bg-gray-50'
                      }
                    `}
                  >
                    <Icon className="w-4 h-4 mr-3" />
                    {label}
                  </Link>
                )
              })}
              
              <div className="pt-6 mt-6 border-t">
                <h3 className="text-xs font-semibold text-gray-500 uppercase tracking-wider mb-3">
                  Resources
                </h3>
                <a
                  href="https://status.baileysanalytics.com"
                  target="_blank"
                  rel="noopener noreferrer"
                  className="flex items-center px-3 py-2 text-sm text-gray-600 hover:text-gray-900 hover:bg-gray-50 rounded-lg transition-all"
                >
                  System Status
                  <ChevronRight className="w-3 h-3 ml-auto" />
                </a>
                <Link
                  to="/contact"
                  className="flex items-center px-3 py-2 text-sm text-gray-600 hover:text-gray-900 hover:bg-gray-50 rounded-lg transition-all"
                >
                  Contact Us
                  <ChevronRight className="w-3 h-3 ml-auto" />
                </Link>
              </div>
            </nav>
          </aside>

          {/* Main Content */}
          <main className="md:col-span-3">
            <div className="bg-white rounded-xl shadow-sm border border-gray-100 p-8 md:p-12">
              {children}
            </div>
          </main>
        </div>
      </div>

      <Footer />
    </div>
  )
}