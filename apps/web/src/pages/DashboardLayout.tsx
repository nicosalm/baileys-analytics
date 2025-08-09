import { useAuth } from '@/contexts/auth'
import { DashboardProvider, useDashboard } from '@/contexts/dashboard'
import { DrillDownProvider, useDrillDown } from '@/contexts/drillDown'
import { useNavigate, Link } from 'react-router-dom'
import { LogOut, Home, Calendar, Users, DollarSign, BarChart3, Settings } from 'lucide-react'
import { PropertiesDashboard } from '@/components/dashboards/PropertiesDashboard'
import { OccupancyDashboard } from '@/components/dashboards/OccupancyDashboard'
import { SeasonalDashboard } from '@/components/dashboards/SeasonalDashboard'
import { GuestsDashboard } from '@/components/dashboards/GuestsDashboard'
import { FinancialDashboard } from '@/components/dashboards/FinancialDashboard' // The new unified dashboard
import { FilterBar } from '@/components/FilterBar'
import { DrillDownView } from '@/components/DrillDownView'
import { DashboardTab } from '@/types/dashboard'
import { api } from '@/lib/api'

// Updated tab config - removed separate tax and revenue tabs
const tabConfig: Array<{ id: DashboardTab; label: string; icon: React.ComponentType<{ className?: string }> }> = [
  { id: 'financial', label: 'Financials', icon: DollarSign },
  { id: 'properties', label: 'Properties', icon: Home },
  { id: 'occupancy', label: 'Occupancy', icon: Calendar },
  { id: 'seasonal', label: 'Seasonal', icon: BarChart3 },
  { id: 'guests', label: 'Guests', icon: Users }
]

const DashboardContent = () => {
  const { activeTab } = useDashboard()

  switch (activeTab) {
    case 'financial':
      return (
        <DrillDownView>
          <FinancialDashboard />
        </DrillDownView>
      )
    case 'properties':
      return (
        <DrillDownView>
          <PropertiesDashboard />
        </DrillDownView>
      )
    case 'occupancy':
      return (
        <DrillDownView>
          <OccupancyDashboard />
        </DrillDownView>
      )
    case 'seasonal':
      return (
        <DrillDownView>
          <SeasonalDashboard />
        </DrillDownView>
      )
    case 'guests':
      return (
        <DrillDownView>
          <GuestsDashboard />
        </DrillDownView>
      )
    // Handle legacy tab IDs by redirecting to financial
    case 'tax':
    case 'revenue':
      return (
        <DrillDownView>
          <FinancialDashboard />
        </DrillDownView>
      )
    default:
      return <div className="p-8 text-center text-gray-500">Select a dashboard tab to begin</div>
  }
}

const DashboardTabs = () => {
  const { activeTab, setActiveTab } = useDashboard()
  const { dispatch } = useDrillDown()

  const handleTabClick = (tabId: DashboardTab) => {
    // Reset drill-down state when switching tabs
    dispatch({ type: 'RESET' })
    setActiveTab(tabId)
  }

  // Map legacy tab IDs to the new financial tab
  const getActiveTab = () => {
    if (activeTab === 'tax' || activeTab === 'revenue') {
      return 'financial'
    }
    return activeTab
  }

  const displayActiveTab = getActiveTab()

  return (
    <div className="border-b bg-white">
      <div className="max-w-7xl mx-auto">
        <nav className="flex space-x-8 px-4" aria-label="Tabs">
          {tabConfig.map(({ id, label, icon: Icon }) => (
            <button
              key={id}
              onClick={() => handleTabClick(id)}
              className={`
                py-4 px-1 border-b-2 font-medium text-sm flex items-center transition-colors
                ${displayActiveTab === id
                  ? 'border-blue-500 text-blue-600'
                  : 'border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300'
                }
              `}
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
        <nav className="bg-white border-b">
          <div className="max-w-7xl mx-auto px-4 py-4">
            <div className="flex justify-between items-center">
              <h1 className="text-xl font-bold">Baileys Analytics</h1>
              <button onClick={handleLogout} className="text-blue-600 hover:text-blue-700 flex items-center transition-colors">
                <LogOut className="w-4 h-4 mr-1" />
                Logout
              </button>
            </div>
          </div>
        </nav>
        <div className="max-w-7xl mx-auto p-8">
          <div className="bg-white rounded-lg shadow-sm p-12 text-center">
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
      <DrillDownProvider>
        <div className="min-h-screen bg-gray-50">
          <nav className="bg-white shadow-sm">
            <div className="max-w-7xl mx-auto px-4 py-4">
              <div className="flex justify-between items-center">
                <div className="flex items-center space-x-3">
                  <h1 className="text-xl font-bold">Baileys Analytics</h1>
                  {user.companyName && (
                    <span className="text-sm text-gray-500">• {user.companyName}</span>
                  )}
                </div>
                <div className="flex items-center space-x-4">
                  <span className="text-sm text-gray-600">{user.email}</span>
                  <Link
                    to="/settings"
                    className="text-gray-600 hover:text-gray-800 transition-colors"
                    title="Settings"
                  >
                    <Settings className="w-5 h-5" />
                  </Link>
                  <button
                    onClick={handleLogout}
                    className="text-blue-600 hover:text-blue-700 flex items-center text-sm transition-colors"
                  >
                    <LogOut className="w-4 h-4 mr-1" />
                    Logout
                  </button>
                </div>
              </div>
            </div>
          </nav>

          <DashboardTabs />
          <FilterBar />

          <main className="max-w-7xl mx-auto p-4">
            <DashboardContent />
          </main>
        </div>
      </DrillDownProvider>
    </DashboardProvider>
  )
}
