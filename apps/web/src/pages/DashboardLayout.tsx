import { useAuth } from '@/contexts/auth'
import { useDashboard } from '@/contexts/dashboard'
import { useNavigate, Link, useLocation, useSearchParams } from 'react-router-dom'
import { LogOut, Home, Calendar, Users, DollarSign, Settings, LayoutDashboard, FileText, Shield, ArrowLeft } from 'lucide-react'
import { OverviewDashboard } from '@/components/dashboards/OverviewDashboard'
import { PropertiesDashboard } from '@/components/dashboards/PropertiesDashboard'
import { OccupancyDashboard } from '@/components/dashboards/OccupancyDashboard'
import { GuestsDashboard } from '@/components/dashboards/GuestsDashboard'
import { FinancialDashboard } from '@/components/dashboards/FinancialDashboard'
import { ReportsModule } from '@/components/ReportsModule'
import { FilterBar } from '@/components/FilterBar'
import { DashboardTab } from '@/types/dashboard'
import { api } from '@/lib/api'
import { Footer } from '@/components/Footer'
import { BRAND } from '@/constants'
import { ErrorBoundary } from '@/components/ErrorBoundary'
import { InitialSyncModal } from '@/components/InitialSyncModal'
import { useState, useEffect } from 'react'

const tabConfig: Array<{ id: DashboardTab; label: string; icon: React.ComponentType<{ className?: string }> }> = [
  { id: 'overview', label: 'Overview', icon: LayoutDashboard },
  { id: 'financial', label: 'Financials', icon: DollarSign },
  { id: 'properties', label: 'Properties', icon: Home },
  { id: 'occupancy', label: 'Occupancy', icon: Calendar },
  { id: 'guests', label: 'Guests', icon: Users },
  { id: 'reports', label: 'Reports', icon: FileText }
]

const DashboardContent = () => {
  const { activeTab } = useDashboard()

  const renderContent = () => {
    switch (activeTab) {
      case 'overview':
        return <OverviewDashboard />
      case 'financial':
        return <FinancialDashboard />
      case 'properties':
        return <PropertiesDashboard />
      case 'occupancy':
        return <OccupancyDashboard />
      case 'guests':
        return <GuestsDashboard />
      case 'reports':
        return <ReportsModule />
      default:
        return <OverviewDashboard />
    }
  }

  return (
    <ErrorBoundary
      level="section"
      resetKeys={[activeTab]}
      onError={(error, errorInfo) => {
        console.error(`Dashboard error in ${activeTab} tab:`, error, errorInfo)
      }}
    >
      {renderContent()}
    </ErrorBoundary>
  )
}

const DashboardTabs = () => {
  const { activeTab } = useDashboard()
  const navigate = useNavigate()
  const location = useLocation()

  const handleTabClick = (tabId: DashboardTab) => {
    // Preserve query params when navigating
    const currentParams = new URLSearchParams(location.search)
    const newPath = `/dashboard/${tabId}${currentParams.toString() ? `?${currentParams.toString()}` : ''}`
    navigate(newPath)
  }

  const displayActiveTab = activeTab

  return (
    <div className="bg-white/90 backdrop-blur-sm border-b border-gray-200">
      <div className="max-w-7xl mx-auto">
        <nav className="flex gap-1 px-4 md:px-6 overflow-x-auto scrollbar-hide" aria-label="Tabs">
          {tabConfig.map(({ id, label, icon: Icon }) => (
            <button
              key={id}
              onClick={() => handleTabClick(id)}
              className={`
                py-3 px-3 md:px-4 border-b-2 font-medium text-sm flex items-center transition-all whitespace-nowrap
                ${displayActiveTab === id
                  ? 'border-blue-600 text-blue-600 bg-blue-50/30'
                  : 'border-transparent text-gray-600 hover:text-gray-900 hover:bg-gray-50/50'
                }
              `}
              aria-current={displayActiveTab === id ? 'page' : undefined}
            >
              <Icon className="w-4 h-4 mr-1.5 md:mr-2" />
              {label}
            </button>
          ))}
        </nav>
      </div>
    </div>
  )
}

export const DashboardLayout = () => {
  const { state, logout } = useAuth()
  const navigate = useNavigate()
  const [searchParams, setSearchParams] = useSearchParams()
  const [showInitialSync, setShowInitialSync] = useState(false)
  const [isAdmin, setIsAdmin] = useState(false)

  if (state.status !== 'authenticated') return null

  const { user } = state

  useEffect(() => {
    const syncParam = searchParams.get('sync')

    if (syncParam === 'initial') {
      setShowInitialSync(true)
      // clean up the URL
      setTimeout(() => {
        const newParams = new URLSearchParams(searchParams)
        newParams.delete('sync')
        setSearchParams(newParams, { replace: true })
      }, 100)
    }
  }, [searchParams, setSearchParams])

  useEffect(() => {
    const checkAdminStatus = async () => {
      try {
        const result = await api.request<{ isAdmin: boolean }>('/admin/verify', { method: 'GET' })
        if (result.success && result.data?.isAdmin) {
          setIsAdmin(true)
        }
      } catch {
        // silently ignore - user is not admin
      }
    }
    checkAdminStatus()
  }, [])

  const handleLogout = async () => {
    await logout()
    navigate('/')
  }

  if (!user.hasOwnerRezConnection) {
    const handleConnect = async () => {
      const result = await api.initiateOAuth()
      if (result.success) {
        window.location.href = result.data.authUrl
      }
    }

    return (
      <div className="min-h-screen bg-gray-50 flex flex-col">
        {/* header */}
        <header className="bg-white/80 backdrop-blur-sm border-b border-gray-200">
          <div className="max-w-7xl mx-auto px-6 py-4">
            <div className="flex justify-between items-center">
              <Link to="/" className="flex items-center hover:opacity-80 transition-opacity">
                <img src="/baileysanalytics.svg" alt={BRAND.name} className="w-9 h-9" />
                <span className="text-xl font-semibold text-gray-900 ml-3">{BRAND.name}</span>
              </Link>
              <button onClick={handleLogout} className="text-gray-600 hover:text-gray-800 flex items-center text-sm transition-all px-3 py-1.5 rounded-md hover:bg-gray-100 cursor-pointer">
                <LogOut className="w-4 h-4 mr-1.5" />
                Logout
              </button>
            </div>
          </div>
        </header>

        {/* main content */}
        <div className="flex-1 flex items-center justify-center py-12 px-4">
          <div className="w-full max-w-md">
            <div className="text-center mb-8">
              <Link to="/" className="inline-flex items-center text-sm text-gray-500 hover:text-gray-700 transition-colors mb-6">
                <ArrowLeft className="w-4 h-4 mr-1" />
                Back to home
              </Link>
              <h2 className="text-2xl font-bold text-gray-900 mb-2">Connect Your OwnerRez Account</h2>
              <p className="text-gray-600">Link your account to start syncing your property data.</p>
            </div>

            <div className="bg-white rounded-2xl border-2 border-blue-500 p-8">
              <img
                src="/logos/ownerrez-app-icon.png"
                alt="OwnerRez"
                className="w-16 h-16 rounded-xl mx-auto mb-6"
              />

              <div className="space-y-3 mb-8">
                <div className="flex items-center text-sm text-gray-700">
                  <span className="w-5 h-5 bg-green-100 rounded-full flex items-center justify-center mr-3 flex-shrink-0">
                    <span className="w-2 h-2 bg-green-500 rounded-full" />
                  </span>
                  Sync 3 years of booking history
                </div>
                <div className="flex items-center text-sm text-gray-700">
                  <span className="w-5 h-5 bg-green-100 rounded-full flex items-center justify-center mr-3 flex-shrink-0">
                    <span className="w-2 h-2 bg-green-500 rounded-full" />
                  </span>
                  Real-time property and guest updates
                </div>
                <div className="flex items-center text-sm text-gray-700">
                  <span className="w-5 h-5 bg-green-100 rounded-full flex items-center justify-center mr-3 flex-shrink-0">
                    <span className="w-2 h-2 bg-green-500 rounded-full" />
                  </span>
                  Secure OAuth connection
                </div>
              </div>

              <button
                onClick={handleConnect}
                className={`w-full py-3 ${BRAND.buttonGradient} text-white rounded-lg hover:opacity-90 transition-opacity font-medium cursor-pointer`}
              >
                Connect OwnerRez
              </button>

              <p className="text-center text-xs text-gray-500 mt-4">
                We never see your OwnerRez password
              </p>
            </div>
          </div>
        </div>

        <Footer />
      </div>
    )
  }

  return (
    <>
      {showInitialSync && (
        <InitialSyncModal
          onComplete={() => {
            setShowInitialSync(false)
          }}
        />
      )}
      <div className="min-h-screen bg-gradient-to-b from-slate-50 via-white to-slate-50 flex flex-col">
          <header className="bg-white/80 backdrop-blur-sm border-b border-gray-200 sticky top-0 z-50">
            <div className="max-w-7xl mx-auto px-4 md:px-6 py-3 md:py-4">
              <div className="flex justify-between items-center">
                <div className="flex items-center">
                  <div className="flex items-center">
                    <img src="/baileysanalytics.svg" alt={BRAND.name} className="w-9 h-9" />
                    <div className="ml-3">
                      <h1 className="text-xl font-semibold text-gray-900">{BRAND.name}</h1>
                    </div>
                  </div>
                </div>
                <div className="flex items-center gap-3">
                  <span className="text-sm text-gray-500 hidden sm:inline">{user.email}</span>
                  <div className="flex items-center gap-2 pl-3 border-l border-gray-200">
                    {isAdmin && (
                      <Link
                        to="/admin"
                        className="p-2 text-gray-500 hover:text-gray-700 hover:bg-gray-100 rounded-lg transition-all"
                        title="Admin Panel"
                      >
                        <Shield className="w-5 h-5" />
                      </Link>
                    )}
                    <Link
                      to="/settings"
                      className="p-2 text-gray-500 hover:text-gray-700 hover:bg-gray-100 rounded-lg transition-all"
                      title="Settings"
                    >
                      <Settings className="w-5 h-5" />
                    </Link>
                    <button
                      onClick={handleLogout}
                      className="relative flex items-center gap-2 px-3 py-1.5 text-sm font-medium text-gray-600 hover:text-gray-900 hover:bg-gray-100 rounded-lg transition-all cursor-pointer"
                      style={{ isolation: 'isolate' }}
                    >
                      <LogOut className="w-4 h-4" />
                      <span className="hidden sm:inline">Logout</span>
                    </button>
                  </div>
                </div>
              </div>
            </div>
          </header>

          <DashboardTabs />
          <FilterBar />

          <main className="max-w-7xl mx-auto px-4 md:px-6 py-4 md:py-6 flex-1 w-full">
            <DashboardContent />
          </main>

          <Footer />
        </div>
    </>
  )
}
