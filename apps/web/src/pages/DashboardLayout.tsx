import { useAuth } from '@/contexts/auth'
import { cn } from '@/lib/utils'
import { useDashboard } from '@/contexts/dashboard'
import { useNavigate, Link, useLocation, useSearchParams } from 'react-router-dom'
import { LogOut, Home, Calendar, Users, DollarSign, Settings, LayoutDashboard, Shield, ArrowLeft, Eye, Menu } from 'lucide-react'
import { lazy, Suspense, useState, useEffect, useRef } from 'react'
import {
  Sheet, SheetTrigger, SheetContent, SheetTitle
} from '@/components/ui/sheet'

const OverviewDashboard = lazy(() => import('@/components/dashboards/OverviewDashboard').then(m => ({ default: m.OverviewDashboard })))
const FinancialDashboard = lazy(() => import('@/components/dashboards/FinancialDashboard').then(m => ({ default: m.FinancialDashboard })))
const PropertiesDashboard = lazy(() => import('@/components/dashboards/PropertiesDashboard').then(m => ({ default: m.PropertiesDashboard })))
const OccupancyDashboard = lazy(() => import('@/components/dashboards/OccupancyDashboard').then(m => ({ default: m.OccupancyDashboard })))
const GuestsDashboard = lazy(() => import('@/components/dashboards/GuestsDashboard').then(m => ({ default: m.GuestsDashboard })))

import { FilterBar, MobileFilterControls } from '@/components/FilterBar'
import { LoadingState } from '@/components/LoadingState'
import { DashboardTab } from '@/types/dashboard'
import { api } from '@/lib/api'
import { Footer } from '@/components/Footer'
import { BRAND } from '@/constants'
import { ErrorBoundary } from '@/components/ErrorBoundary'
import { InitialSyncModal } from '@/components/InitialSyncModal'
import { Button } from '@/components/ui/button'
import { LogoCube } from '@/components/LogoCube'
import { usePageTitle } from '@/hooks/use-page-title'
import { useToast } from '@/contexts/toast'

const tabConfig: Array<{ id: DashboardTab; label: string; icon: React.ComponentType<{ className?: string }> }> = [
  { id: 'overview', label: 'Overview', icon: LayoutDashboard },
  { id: 'financial', label: 'Financials', icon: DollarSign },
  { id: 'properties', label: 'Properties', icon: Home },
  { id: 'occupancy', label: 'Occupancy', icon: Calendar },
  { id: 'guests', label: 'Guests', icon: Users }
]

const DashboardContent = () => {
  const { activeTab } = useDashboard()
  const { addToast } = useToast()
  const [fadeKey, setFadeKey] = useState(activeTab)
  const [visible, setVisible] = useState(true)

  useEffect(() => {
    if (activeTab !== fadeKey) {
      setVisible(false)
      const timeout = setTimeout(() => {
        setFadeKey(activeTab)
        setVisible(true)
      }, 150)
      return () => clearTimeout(timeout)
    }
  }, [activeTab, fadeKey])

  const renderContent = () => {
    switch (fadeKey) {
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
      resetKeys={[fadeKey]}
      onError={(error) => {
        addToast('error', `Failed to load ${fadeKey} dashboard. Try refreshing.`)
        if (import.meta.env.DEV) {
          console.error(`Dashboard error in ${fadeKey} tab:`, error)
        }
      }}
    >
      <div className={`transition-opacity duration-150 ${visible ? 'opacity-100' : 'opacity-0'}`}>
        <Suspense fallback={<LoadingState />}>
          {renderContent()}
        </Suspense>
      </div>
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

  return (
    <div className="hidden sm:block bg-background/90 backdrop-blur-sm border-b border-border">
      <div className="max-w-7xl mx-auto">
        <nav className="flex gap-1 px-4 md:px-6 overflow-x-auto scrollbar-hide" aria-label="Tabs">
          {tabConfig.map(({ id, label, icon: Icon }) => (
            <button
              key={id}
              onClick={() => handleTabClick(id)}
              className={`
                py-3 px-3 md:px-4 border-b-2 font-medium text-sm flex items-center transition-all whitespace-nowrap cursor-pointer
                ${activeTab === id
                  ? 'border-primary text-primary bg-primary/5'
                  : 'border-transparent text-muted-foreground hover:text-foreground hover:bg-muted/50'
                }
              `}
              aria-current={activeTab === id ? 'page' : undefined}
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
  const { activeTab } = useDashboard()
  const tabLabel = tabConfig.find(t => t.id === activeTab)?.label || 'Dashboard'
  usePageTitle(tabLabel)
  const { state, logout } = useAuth()
  const navigate = useNavigate()
  const location = useLocation()
  const [searchParams, setSearchParams] = useSearchParams()
  const [showInitialSync, setShowInitialSync] = useState(false)
  const [isAdmin, setIsAdmin] = useState(false)
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false)
  const [connectLoading, setConnectLoading] = useState(false)
  const { addToast } = useToast()
  const syncChecked = useRef(false)

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

  // detect incomplete initial sync (e.g. user refreshed mid-sync)
  useEffect(() => {
    if (syncChecked.current || showInitialSync) return
    if (state.status !== 'authenticated') return
    if (!state.user.hasOwnerRezConnection || state.user.isDemo) return

    syncChecked.current = true
    api.request<{ needed: boolean; completed: boolean }>('/sync/status').then(result => {
      if (result.success && result.data.needed && !result.data.completed) {
        setShowInitialSync(true)
      }
    }).catch(() => {})
  }, [state.status, showInitialSync])

  if (state.status !== 'authenticated') return null

  const { user } = state
  const isDemo = user.isDemo === true

  const handleLogout = async () => {
    await logout()
    navigate('/')
  }

  const handleMobileTabClick = (tabId: DashboardTab) => {
    const currentParams = new URLSearchParams(location.search)
    const newPath = `/dashboard/${tabId}${currentParams.toString() ? `?${currentParams.toString()}` : ''}`
    navigate(newPath)
    setMobileMenuOpen(false)
  }

  if (!user.hasOwnerRezConnection) {
    const handleConnect = async () => {
      setConnectLoading(true)
      try {
        const result = await api.initiateOAuth()
        if (result.success) {
          window.location.href = result.data.authUrl
        } else {
          addToast('error', 'Failed to connect to OwnerRez. Please try again.')
          setConnectLoading(false)
        }
      } catch {
        addToast('error', 'Failed to connect to OwnerRez. Please try again.')
        setConnectLoading(false)
      }
    }

    return (
      <div className="min-h-screen bg-background flex flex-col">
        {/* header */}
        <header className="bg-background/80 backdrop-blur-sm border-b border-border sticky top-0 z-40">
          <div className="max-w-7xl mx-auto px-4 md:px-6 py-3 md:py-4">
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
                  Sync 4 years of booking history
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
                loading={connectLoading}
                loadingText="Connecting..."
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
            <div className="max-w-7xl mx-auto px-3 sm:px-4 md:px-6 py-2 sm:py-3 md:py-4">
              <div className="flex justify-between items-center">
                <Link to="/" className="flex items-center shrink-0">
                  <LogoCube />
                  <div className="ml-2 sm:ml-3">
                    <h1 className="text-lg sm:text-xl font-semibold text-foreground">{BRAND.name}</h1>
                    {user.companyName && (
                      <p className="hidden sm:block text-xs text-muted-foreground -mt-0.5">for {user.companyName}</p>
                    )}
                  </div>
                </Link>
                <div className="flex items-center gap-2 sm:gap-3">
                  {isDemo ? (
                    <div className="flex items-center gap-1.5 sm:gap-2">
                      <span className="hidden sm:inline-flex items-center gap-1.5 text-xs text-muted-foreground bg-muted px-2.5 py-1.5 rounded-md whitespace-nowrap">
                        <Eye className="w-3.5 h-3.5 shrink-0" />
                        Demo
                      </span>
                      <Link
                        to="/signup"
                        className="hidden sm:inline-flex whitespace-nowrap px-4 py-1.5 bg-primary text-primary-foreground rounded-md text-sm font-medium hover:opacity-90 transition-opacity"
                      >
                        Sign Up
                      </Link>
                      <button
                        onClick={handleLogout}
                        className="hidden sm:block p-1.5 text-muted-foreground hover:text-foreground rounded-md hover:bg-muted transition-colors cursor-pointer"
                        title="Exit demo"
                        aria-label="Exit demo"
                      >
                        <LogOut className="w-4 h-4" />
                      </button>
                    </div>
                  ) : (
                    <>
                      <span className="hidden sm:inline text-sm text-muted-foreground">{user.email}</span>
                      <div className="hidden sm:flex items-center gap-2 pl-3 border-l border-border">
                        {isAdmin && (
                          <Link
                            to="/admin"
                            className="p-2 text-muted-foreground hover:text-foreground hover:bg-muted rounded-lg transition-all"
                            title="Admin Panel"
                            aria-label="Admin Panel"
                          >
                            <Shield className="w-5 h-5" />
                          </Link>
                        )}
                        <Link
                          to="/settings"
                          className="p-2 text-muted-foreground hover:text-foreground hover:bg-muted rounded-lg transition-all"
                          title="Settings"
                          aria-label="Settings"
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

                  <Sheet open={mobileMenuOpen} onOpenChange={setMobileMenuOpen}>
                    <SheetTrigger asChild>
                      <button className="sm:hidden p-2 text-muted-foreground hover:text-foreground rounded-lg hover:bg-muted transition-colors cursor-pointer" aria-label="Open menu">
                        <Menu className="w-6 h-6" />
                      </button>
                    </SheetTrigger>
                    <SheetContent side="right" className="w-80 overflow-y-auto p-0 gap-0">
                      <SheetTitle className="sr-only">Menu</SheetTitle>

                      {/* pr-10 clears the sheet close button */}
                      <div className="px-5 pr-10 pt-5 pb-3">
                        {isDemo ? (
                          <div className="flex items-center justify-between">
                            <span className="inline-flex items-center gap-1.5 text-xs text-muted-foreground bg-muted px-2.5 py-1.5 rounded-md">
                              <Eye className="w-3.5 h-3.5 shrink-0" />
                              Demo Mode
                            </span>
                            <Link
                              to="/signup"
                              onClick={() => setMobileMenuOpen(false)}
                              className="px-3 py-1.5 bg-primary text-primary-foreground rounded-md text-xs font-medium hover:opacity-90 transition-opacity"
                            >
                              Sign Up
                            </Link>
                          </div>
                        ) : (
                          <p className="text-sm text-muted-foreground truncate">{user.email}</p>
                        )}
                      </div>

                      <div className="h-px bg-border" />

                      <div className="px-5 py-3">
                        <p className="text-xs font-medium text-muted-foreground uppercase tracking-wider mb-2 px-1">Navigation</p>
                        <nav className="flex flex-col gap-0.5" aria-label="Dashboard tabs">
                          {tabConfig.map(({ id, label, icon: Icon }) => (
                            <button
                              key={id}
                              onClick={() => handleMobileTabClick(id)}
                              className={cn(
                                "flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm font-medium transition-colors cursor-pointer text-left",
                                activeTab === id
                                  ? "bg-primary/10 text-primary"
                                  : "text-muted-foreground hover:text-foreground hover:bg-muted/50"
                              )}
                            >
                              <Icon className="w-4 h-4" />
                              {label}
                            </button>
                          ))}
                        </nav>
                      </div>

                      <div className="h-px bg-border" />

                      <div className="px-5 py-3">
                        <p className="text-xs font-medium text-muted-foreground uppercase tracking-wider mb-2 px-1">Filters</p>
                        <MobileFilterControls />
                      </div>

                      {/* pushes account section to the bottom of the sheet */}
                      <div className="flex-1" />

                      <div className="h-px bg-border" />

                      <div className="px-5 py-3">
                        <div className="flex flex-col gap-0.5">
                          {isDemo ? (
                            <button
                              onClick={() => { handleLogout(); setMobileMenuOpen(false) }}
                              className="flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm font-medium text-muted-foreground hover:text-foreground hover:bg-muted/50 transition-colors cursor-pointer text-left"
                            >
                              <LogOut className="w-4 h-4" />
                              Exit Demo
                            </button>
                          ) : (
                            <>
                              {isAdmin && (
                                <Link
                                  to="/admin"
                                  onClick={() => setMobileMenuOpen(false)}
                                  className="flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm font-medium text-muted-foreground hover:text-foreground hover:bg-muted/50 transition-colors"
                                >
                                  <Shield className="w-4 h-4" />
                                  Admin
                                </Link>
                              )}
                              <Link
                                to="/settings"
                                onClick={() => setMobileMenuOpen(false)}
                                className="flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm font-medium text-muted-foreground hover:text-foreground hover:bg-muted/50 transition-colors"
                              >
                                <Settings className="w-4 h-4" />
                                Settings
                              </Link>
                              <button
                                onClick={() => { handleLogout(); setMobileMenuOpen(false) }}
                                className="flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm font-medium text-muted-foreground hover:text-foreground hover:bg-muted/50 transition-colors cursor-pointer text-left"
                              >
                                <LogOut className="w-4 h-4" />
                                Logout
                              </button>
                            </>
                          )}
                        </div>
                      </div>
                    </SheetContent>
                  </Sheet>
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
