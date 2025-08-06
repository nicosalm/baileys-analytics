import { useAuth } from '@/contexts/auth'
import { DashboardProvider, useDashboard } from '@/contexts/dashboard'
import { DrillDownProvider, useDrillDown } from '@/contexts/drillDown'
import { useNavigate, Link } from 'react-router-dom'
import { LogOut, FileText, Home, TrendingUp, Calendar, Users, DollarSign, BarChart3, Settings } from 'lucide-react'
import { TaxDashboard } from '@/components/dashboards/TaxDashboard'
import { PropertiesDashboard } from '@/components/dashboards/PropertiesDashboard'
import { RevenueDashboard } from '@/components/dashboards/RevenueDashboard'
import { OccupancyDashboard } from '@/components/dashboards/OccupancyDashboard'
import { SeasonalDashboard } from '@/components/dashboards/SeasonalDashboard'
import { GuestsDashboard } from '@/components/dashboards/GuestsDashboard'
import { FinancialDashboard } from '@/components/dashboards/FinancialDashboard'
import { FilterBar } from '@/components/FilterBar'
import { DrillDownView } from '@/components/DrillDownView'
import { DashboardTab } from '@/types/dashboard'
import { api } from '@/lib/api'

const tabConfig: Array<{ id: DashboardTab; label: string; icon: React.ComponentType<{ className?: string }> }> = [
  { id: 'tax', label: 'Tax Reports', icon: FileText },
  { id: 'properties', label: 'Properties', icon: Home },
  { id: 'revenue', label: 'Revenue', icon: DollarSign },
  { id: 'occupancy', label: 'Occupancy', icon: Calendar },
  { id: 'seasonal', label: 'Seasonal', icon: BarChart3 },
  { id: 'guests', label: 'Guests', icon: Users },
  { id: 'financial', label: 'Financial', icon: TrendingUp }
]

const DashboardContent = () => {
  const { activeTab } = useDashboard()

  switch (activeTab) {
    case 'tax':
      return (
        <DrillDownView>
          <TaxDashboard />
        </DrillDownView>
      )
    case 'properties':
      return (
        <DrillDownView>
          <PropertiesDashboard />
        </DrillDownView>
      )
    case 'revenue':
      return (
        <DrillDownView>
          <RevenueDashboard />
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
    case 'financial':
        return (
        <DrillDownView>
            <FinancialDashboard />
        </DrillDownView>
        )
    default:
      return <div className="p-8 text-center text-gray-500">Coming soon...</div>
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

  return (
    <div className="border-b">
      <div className="max-w-7xl mx-auto">
        <nav className="flex space-x-8 px-4" aria-label="Tabs">
          {tabConfig.map(({ id, label, icon: Icon }) => (
            <button
              key={id}
              onClick={() => handleTabClick(id)}
              className={`
                py-4 px-1 border-b-2 font-medium text-sm flex items-center
                ${activeTab === id
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
      <div className="min-h-screen">
        <nav className="p-4 border-b">
          <div className="max-w-7xl mx-auto flex justify-between items-center">
            <h1 className="text-xl font-bold">Baileys Analytics</h1>
            <button onClick={handleLogout} className="text-blue-600 flex items-center">
              <LogOut className="w-4 h-4 mr-1" />
              Logout
            </button>
          </div>
        </nav>
        <div className="max-w-7xl mx-auto p-8">
          <div className="text-center">
            <h2 className="text-2xl font-bold mb-4">Connect Your OwnerRez Account</h2>
            <p className="text-gray-600 mb-6">To start using the dashboard, connect your OwnerRez account</p>
            <button onClick={handleConnect} className="px-6 py-2 bg-blue-600 text-white rounded">
              Connect OwnerRez
            </button>
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
                <h1 className="text-xl font-bold">Baileys Analytics</h1>
                <div className="flex items-center space-x-4">
                  <span className="text-sm text-gray-600">{user.email}</span>
                  <Link
                    to="/settings"
                    className="text-gray-600 hover:text-gray-800"
                    title="Settings"
                  >
                    <Settings className="w-5 h-5" />
                  </Link>
                  <button onClick={handleLogout} className="text-blue-600 flex items-center text-sm">
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
