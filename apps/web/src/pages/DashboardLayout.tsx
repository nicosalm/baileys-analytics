import { useAuth } from '@/contexts/auth'
import { useDashboard } from '@/contexts/dashboard'
import { useNavigate, Link, useLocation, useSearchParams } from 'react-router-dom'
import { LogOut, Home, Calendar, Users, DollarSign, Settings, LayoutDashboard, Shield, ArrowLeft, Eye } from 'lucide-react'
import { lazy, Suspense, useState, useEffect } from 'react'

const OverviewDashboard = lazy(() => import('@/components/dashboards/OverviewDashboard').then(m => ({ default: m.OverviewDashboard })))
const FinancialDashboard = lazy(() => import('@/components/dashboards/FinancialDashboard').then(m => ({ default: m.FinancialDashboard })))
const PropertiesDashboard = lazy(() => import('@/components/dashboards/PropertiesDashboard').then(m => ({ default: m.PropertiesDashboard })))
const OccupancyDashboard = lazy(() => import('@/components/dashboards/OccupancyDashboard').then(m => ({ default: m.OccupancyDashboard })))
const GuestsDashboard = lazy(() => import('@/components/dashboards/GuestsDashboard').then(m => ({ default: m.GuestsDashboard })))

import { FilterBar } from '@/components/FilterBar'
import { LoadingState } from '@/components/LoadingState'
import { DashboardTab } from '@/types/dashboard'
import { api } from '@/lib/api'
import { Footer } from '@/components/Footer'
import { BRAND } from '@/constants'
import { ErrorBoundary } from '@/components/ErrorBoundary'
import { InitialSyncModal } from '@/components/InitialSyncModal'
import { Button } from '@/components/ui/button'
import { LogoCube } from '@/components/LogoCube'

const tabConfig: Array<{ id: DashboardTab; label: string; icon: React.ComponentType<{ className?: string }> }> = [
  { id: 'overview', label: 'Overview', icon: LayoutDashboard },
  { id: 'financial', label: 'Financials', icon: DollarSign },
  { id: 'properties', label: 'Properties', icon: Home },
  { id: 'occupancy', label: 'Occupancy', icon: Calendar },
  { id: 'guests', label: 'Guests', icon: Users }
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
      <Suspense fallback={<LoadingState />}>
        {renderContent()}
      </Suspense>
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
    <div className="bg-background/90 backdrop-blur-sm border-b border-border">
      <div className="max-w-7xl mx-auto">
        <nav className="flex gap-1 px-4 md:px-6 overflow-x-auto scrollbar-hide" aria-label="Tabs">
          {tabConfig.map(({ id, label, icon: Icon }) => (
            <button
              key={id}
              onClick={() => handleTabClick(id)}
              className={`
                py-3 px-3 md:px-4 border-b-2 font-medium text-sm flex items-center transition-all whitespace-nowrap cursor-pointer
                ${displayActiveTab === id
                  ? 'border-primary text-primary bg-primary/5'
                  : 'border-transparent text-muted-foreground hover:text-foreground hover:bg-muted/50'
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

  if (state.status !== 'authenticated') return null

  const { user } = state
  const isDemo = user.isDemo === true

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
      <div className="min-h-screen bg-background flex flex-col">
        {/* header */}
        <header className="bg-background/80 backdrop-blur-sm border-b border-border">
          <div className="max-w-7xl mx-auto px-6 py-4">
            <div className="flex justify-between items-center">
              <Link to="/" className="flex items-center">
                <LogoCube />
                <span className="text-xl font-semibold text-foreground ml-3">{BRAND.name}</span>
              </Link>
              <Button variant="ghost" onClick={handleLogout} className="text-muted-foreground hover:text-foreground text-sm">
                <LogOut className="w-4 h-4" />
                Logout
              </Button>
            </div>
          </div>
        </header>

        {/* main content */}
        <div className="flex-1 flex items-center justify-center py-12 px-4">
          <div className="w-full max-w-md">
            <div className="text-center mb-8">
              <Link to="/" className="inline-flex items-center text-sm text-muted-foreground hover:text-foreground transition-colors mb-6">
                <ArrowLeft className="w-4 h-4 mr-1" />
                Back to home
              </Link>
              <h2 className="text-2xl font-bold text-foreground mb-2">Connect Your OwnerRez Account</h2>
              <p className="text-muted-foreground">Link your account to start syncing your property data.</p>
            </div>

            <div className="bg-card rounded-2xl border-2 border-primary p-8">
              <img
                src="/logos/ownerrez-app-icon.png"
                alt="OwnerRez"
                className="w-16 h-16 rounded-xl mx-auto mb-6"
              />

              <div className="space-y-3 mb-8">
                <div className="flex items-center text-sm text-foreground">
                  <span className="w-5 h-5 bg-success-subtle rounded-full flex items-center justify-center mr-3 flex-shrink-0">
                    <span className="w-2 h-2 bg-success rounded-full" />
                  </span>
                  Sync 3 years of booking history
                </div>
                <div className="flex items-center text-sm text-foreground">
                  <span className="w-5 h-5 bg-success-subtle rounded-full flex items-center justify-center mr-3 flex-shrink-0">
                    <span className="w-2 h-2 bg-success rounded-full" />
                  </span>
                  Real-time property and guest updates
                </div>
                <div className="flex items-center text-sm text-foreground">
                  <span className="w-5 h-5 bg-success-subtle rounded-full flex items-center justify-center mr-3 flex-shrink-0">
                    <span className="w-2 h-2 bg-success rounded-full" />
                  </span>
                  Secure OAuth connection
                </div>
              </div>

              <Button
                onClick={handleConnect}
                className="w-full py-3 bg-primary text-primary-foreground rounded-lg hover:opacity-90 transition-opacity font-medium"
              >
                Connect OwnerRez
              </Button>

              <p className="text-center text-xs text-muted-foreground mt-4">
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
      <div className="min-h-screen bg-background flex flex-col">
          <header className="bg-background/80 backdrop-blur-sm border-b border-border sticky top-0 z-50">
            <div className="max-w-7xl mx-auto px-4 md:px-6 py-3 md:py-4">
              <div className="flex justify-between items-center">
                <Link to="/" className="flex items-center">
                  <LogoCube />
                  <div className="ml-3">
                    <h1 className="text-xl font-semibold text-foreground">{BRAND.name}</h1>
                    {user.companyName && (
                      <p className="text-xs text-muted-foreground -mt-0.5">for {user.companyName}</p>
                    )}
                  </div>
                </Link>
                <div className="flex items-center gap-3">
                  {isDemo ? (
                    <div className="flex items-center gap-2">
                      <span className="hidden sm:inline-flex items-center gap-1.5 text-xs text-muted-foreground bg-muted px-2.5 py-1.5 rounded-md whitespace-nowrap">
                        <Eye className="w-3.5 h-3.5 shrink-0" />
                        Demo
                      </span>
                      <Link
                        to="/signup"
                        className="px-4 py-1.5 bg-primary text-primary-foreground rounded-md text-sm font-medium hover:opacity-90 transition-opacity"
                      >
                        Sign Up
                      </Link>
                      <button
                        onClick={handleLogout}
                        className="p-1.5 text-muted-foreground hover:text-foreground rounded-md hover:bg-muted transition-colors cursor-pointer"
                        title="Exit demo"
                      >
                        <LogOut className="w-4 h-4" />
                      </button>
                    </div>
                  ) : (
                    <>
                      <span className="text-sm text-muted-foreground hidden sm:inline">{user.email}</span>
                      <div className="flex items-center gap-2 pl-3 border-l border-border">
                        {isAdmin && (
                          <Link
                            to="/admin"
                            className="p-2 text-muted-foreground hover:text-foreground hover:bg-muted rounded-lg transition-all"
                            title="Admin Panel"
                          >
                            <Shield className="w-5 h-5" />
                          </Link>
                        )}
                        <Link
                          to="/settings"
                          className="p-2 text-muted-foreground hover:text-foreground hover:bg-muted rounded-lg transition-all"
                          title="Settings"
                        >
                          <Settings className="w-5 h-5" />
                        </Link>
                        <Button
                          variant="ghost"
                          onClick={handleLogout}
                          className="text-sm font-medium text-muted-foreground hover:text-foreground"
                          style={{ isolation: 'isolate' }}
                        >
                          <LogOut className="w-4 h-4" />
                          <span className="hidden sm:inline">Logout</span>
                        </Button>
                      </div>
                    </>
                  )}
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
