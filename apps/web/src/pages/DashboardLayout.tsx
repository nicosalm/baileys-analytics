import { useAuth } from '@/contexts/auth'
import { DashboardProvider, useDashboard } from '@/contexts/dashboard'
import { useNavigate, Link, useLocation } from 'react-router-dom'
import { LogOut, Home, Calendar, Users, DollarSign, Settings, LayoutDashboard, TrendingUp, FileText } from 'lucide-react'
import { OverviewDashboard } from '@/components/dashboards/OverviewDashboard'
import { PropertiesDashboard } from '@/components/dashboards/PropertiesDashboard'
import { OccupancyDashboard } from '@/components/dashboards/OccupancyDashboard'
import { SeasonalDashboard } from '@/components/dashboards/SeasonalDashboard'
import { GuestsDashboard } from '@/components/dashboards/GuestsDashboard'
import { FinancialDashboard } from '@/components/dashboards/FinancialDashboard'
import ReportsModule from '@/components/ReportsModule'
import { FilterBar } from '@/components/FilterBar'
import { DashboardTab } from '@/types/dashboard'
import { api } from '@/lib/api'

// Tab config with overview as first tab
const tabConfig: Array<{ id: DashboardTab; label: string; icon: React.ComponentType<{ className?: string }> }> = [
  { id: 'overview', label: 'Overview', icon: LayoutDashboard },
  { id: 'financial', label: 'Financials', icon: DollarSign },
  { id: 'properties', label: 'Properties', icon: Home },
  { id: 'occupancy', label: 'Occupancy', icon: Calendar },
  { id: 'seasonal', label: 'Seasonal', icon: TrendingUp },
  { id: 'guests', label: 'Guests', icon: Users },
  { id: 'reports', label: 'Reports', icon: FileText }
]

const DashboardContent = () => {
  const { activeTab } = useDashboard()

  switch (activeTab) {
    case 'overview':
      return <OverviewDashboard />
    case 'financial':
      return <FinancialDashboard />
    case 'properties':
      return <PropertiesDashboard />
    case 'occupancy':
      return <OccupancyDashboard />
    case 'seasonal':
      return <SeasonalDashboard />
    case 'guests':
      return <GuestsDashboard />
    case 'reports':
      return <ReportsModule />
    // No longer needed - tax and revenue merged into financial
    default:
      return <OverviewDashboard />
  }
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
    <div className="bg-white border-b">
      <div className="max-w-7xl mx-auto">
        <nav className="flex space-x-6 px-6" aria-label="Tabs">
          {tabConfig.map(({ id, label, icon: Icon }) => (
            <button
              key={id}
              onClick={() => handleTabClick(id)}
              className={`
                py-3 px-1 border-b-2 font-medium text-sm flex items-center transition-all
                ${displayActiveTab === id
                  ? 'border-blue-500 text-blue-600'
                  : 'border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300'
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

  if (state.status !== 'authenticated') return null

  const { user } = state

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
      <div className="min-h-screen bg-gray-50">
        <nav className="bg-white shadow-xs border-b">
          <div className="max-w-7xl mx-auto px-6 py-4">
            <div className="flex justify-between items-center">
              <h1 className="text-2xl font-bold text-gray-900">Baileys Analytics</h1>
              <button onClick={handleLogout} className="text-gray-600 hover:text-gray-800 flex items-center text-sm transition-colors px-3 py-1.5 rounded-md hover:bg-gray-100">
                <LogOut className="w-4 h-4 mr-1.5" />
                Logout
              </button>
            </div>
          </div>
        </nav>
        <div className="max-w-7xl mx-auto p-8">
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
                className="px-6 py-3 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors font-medium"
              >
                Connect OwnerRez Account
              </button>
            </div>
          </div>
        </div>
      </div>
    )
  }

  return (
    <DashboardProvider>
      <div className="min-h-screen bg-gray-50">
          <nav className="bg-white shadow-xs border-b">
            <div className="max-w-7xl mx-auto px-6 py-3">
              <div className="flex justify-between items-center">
                <div className="flex items-center">
                  <div className="flex flex-col">
                    <h1 className="text-2xl font-bold text-gray-900">Baileys Analytics</h1>
                    {user.companyName && (
                      <span className="text-sm text-gray-500 mt-0.5">for {user.companyName}</span>
                    )}
                  </div>
                </div>
                <div className="flex items-center space-x-4">
                  <span className="text-sm text-gray-600">{user.email}</span>
                  <div className="flex items-center space-x-2 pl-4 border-l border-gray-200">
                    <Link
                      to="/settings"
                      className="text-gray-600 hover:text-gray-800 transition-colors p-2 rounded-md hover:bg-gray-100"
                      title="Settings"
                    >
                      <Settings className="w-5 h-5" />
                    </Link>
                    <button
                      onClick={handleLogout}
                      className="text-gray-600 hover:text-gray-800 flex items-center text-sm transition-colors px-3 py-1.5 rounded-md hover:bg-gray-100"
                    >
                      <LogOut className="w-4 h-4 mr-1.5" />
                      Logout
                    </button>
                  </div>
                </div>
              </div>
            </div>
          </nav>

          <DashboardTabs />
          <FilterBar />

          <main className="max-w-7xl mx-auto px-6 py-4">
            <DashboardContent />
          </main>
        </div>
    </DashboardProvider>
  )
}
