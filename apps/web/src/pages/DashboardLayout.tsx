import { useAuth } from '@/contexts/auth'
import { DashboardProvider, useDashboard } from '@/contexts/dashboard'
import { useNavigate, Link, useLocation, useSearchParams } from 'react-router-dom'
import { LogOut, Home, Calendar, Users, DollarSign, Settings, LayoutDashboard, FileText, Compass } from 'lucide-react'
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
        <nav className="flex gap-1 px-6" aria-label="Tabs">
          {tabConfig.map(({ id, label, icon: Icon }) => (
            <button
              key={id}
              onClick={() => handleTabClick(id)}
              className={`
                py-3 px-4 border-b-2 font-medium text-sm flex items-center transition-all
                ${displayActiveTab === id
                  ? 'border-blue-600 text-blue-600 bg-blue-50/30'
                  : 'border-transparent text-gray-600 hover:text-gray-900 hover:bg-gray-50/50'
                }
              `}
              aria-current={displayActiveTab === id ? 'page' : undefined}
            >
              <Icon className="w-4 h-4 mr-2" />
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

  if (state.status !== 'authenticated') return null

  const { user } = state

  useEffect(() => {
    // Check if we should show initial sync (from OAuth callback or manual trigger)
    const syncParam = searchParams.get('sync')
    const pendingSync = localStorage.getItem('pendingInitialSync')
    
    if (syncParam === 'initial') {
      setShowInitialSync(true)
      // Remove the query parameter to clean up the URL after a short delay
      setTimeout(() => {
        const newParams = new URLSearchParams(searchParams)
        newParams.delete('sync')
        setSearchParams(newParams, { replace: true })
      }, 100)
    } else if (pendingSync === 'true' && user.hasOwnerRezConnection) {
      // Handle case where we lost the sync param but still need to sync
      localStorage.removeItem('pendingInitialSync')
      setShowInitialSync(true)
    }
  }, [searchParams, setSearchParams, user?.hasOwnerRezConnection])

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
        <nav className="bg-white shadow-xs border-b">
          <div className="max-w-7xl mx-auto px-6 py-4">
            <div className="flex justify-between items-center">
              <h1 className="text-2xl font-bold text-gray-900">Baileys Analytics</h1>
              <button onClick={handleLogout} className="text-gray-600 hover:text-gray-800 flex items-center text-sm transition-all px-3 py-1.5 rounded-md hover:bg-gray-100 cursor-pointer">
                <LogOut className="w-4 h-4 mr-1.5" />
                Logout
              </button>
            </div>
          </div>
        </nav>
        <div className="max-w-7xl mx-auto p-8 flex-1">
          <div className="bg-white rounded-lg shadow-xs p-12 text-center">
            <div className="max-w-md mx-auto">
              <div className="w-16 h-16 bg-blue-100 rounded-full flex items-center justify-center mx-auto mb-6">
                <DollarSign className="w-8 h-8 text-blue-600" />
              </div>
              <h2 className="text-2xl font-bold mb-4">Connect Your OwnerRez Account</h2>
              <p className="text-gray-600 mb-8">
                To start using the analytics dashboard and view your property data, please connect your OwnerRez account.
              </p>
              <button
                onClick={handleConnect}
                className="px-6 py-3 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-all font-medium"
              >
                Connect OwnerRez Account
              </button>
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
      <DashboardProvider>
        <div className="min-h-screen bg-gradient-to-b from-slate-50 via-white to-slate-50 flex flex-col">
          <header className="bg-white/80 backdrop-blur-sm border-b border-gray-200 sticky top-0 z-50">
            <div className="max-w-7xl mx-auto px-6 py-4">
              <div className="flex justify-between items-center">
                <div className="flex items-center">
                  <div className="flex items-center">
                    <div className={`w-10 h-10 ${BRAND.logoGradient} rounded-xl flex items-center justify-center shadow-sm`}>
                      <Compass className="w-6 h-6 text-white" />
                    </div>
                    <div className="ml-3">
                      <h1 className="text-xl font-semibold text-gray-900">{BRAND.name}</h1>
                      {user.companyName && (
                        <p className="text-xs text-gray-500 -mt-0.5">for {user.companyName}</p>
                      )}
                    </div>
                  </div>
                </div>
                <div className="flex items-center gap-3">
                  <span className="text-sm text-gray-500 hidden sm:inline">{user.email}</span>
                  <div className="flex items-center gap-2 pl-3 border-l border-gray-200">
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

          <main className="max-w-7xl mx-auto px-6 py-6 flex-1 w-full">
            <DashboardContent />
          </main>

          <Footer />
        </div>
      </DashboardProvider>
    </>
  )
}
