import { useAuth } from '@/contexts/auth'
import { cn } from '@/lib/utils'
import { useDashboard } from '@/contexts/dashboard'
import { useNavigate, Link, useLocation, useSearchParams } from 'react-router-dom'
import { Menu } from 'lucide-react'
import { lazy, Suspense, useState, useEffect, useRef } from 'react'
import { Sheet, SheetTrigger, SheetContent, SheetTitle } from '@/components/ui/sheet'

const OverviewDashboard = lazy(() => import('@/components/dashboards/OverviewDashboard').then((m) => ({ default: m.OverviewDashboard })))
const FinancialDashboard = lazy(() => import('@/components/dashboards/FinancialDashboard').then((m) => ({ default: m.FinancialDashboard })))
const PropertiesDashboard = lazy(() =>
  import('@/components/dashboards/PropertiesDashboard').then((m) => ({ default: m.PropertiesDashboard })),
)
const OccupancyDashboard = lazy(() => import('@/components/dashboards/OccupancyDashboard').then((m) => ({ default: m.OccupancyDashboard })))
const GuestsDashboard = lazy(() => import('@/components/dashboards/GuestsDashboard').then((m) => ({ default: m.GuestsDashboard })))

import { FilterBar, MobileFilterControls } from '@/components/FilterBar'
import { LoadingState } from '@/components/LoadingState'
import type { DashboardTab } from '@/types/dashboard'
import { api } from '@/lib/api'
import { Footer } from '@/components/Footer'
import { ErrorBoundary } from '@/components/ErrorBoundary'
import { InitialSyncModal } from '@/components/InitialSyncModal'
import { Button } from '@/components/ui/button'
import { AppHeader } from '@/components/AppHeader'
import { usePageTitle } from '@/hooks/use-page-title'
import { useToast } from '@/contexts/toast'

const tabConfig: Array<{ id: DashboardTab; label: string }> = [
  { id: 'overview', label: 'Overview' },
  { id: 'financial', label: 'Financials' },
  { id: 'properties', label: 'Properties' },
  { id: 'occupancy', label: 'Occupancy' },
  { id: 'guests', label: 'Guests' },
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
        <Suspense fallback={<LoadingState />}>{renderContent()}</Suspense>
      </div>
    </ErrorBoundary>
  )
}

const DashboardNav = () => {
  const { activeTab } = useDashboard()
  const location = useLocation()

  return (
    <nav className="flex items-stretch gap-1 overflow-x-auto scrollbar-hide" aria-label="Dashboards">
      {tabConfig.map(({ id, label }) => {
        const active = activeTab === id
        return (
          <Link
            key={id}
            to={`/dashboard/${id}${location.search}`}
            aria-current={active ? 'page' : undefined}
            className={cn(
              'relative inline-flex items-center whitespace-nowrap px-3 text-sm font-medium transition-colors',
              'after:absolute after:inset-x-3 after:-bottom-px after:h-0.5 after:rounded-full after:transition-colors',
              active ? 'text-foreground after:bg-primary' : 'text-muted-foreground hover:text-foreground after:bg-transparent',
            )}
          >
            {label}
          </Link>
        )
      })}
    </nav>
  )
}

export const DashboardLayout = () => {
  const { activeTab } = useDashboard()
  const tabLabel = tabConfig.find((t) => t.id === activeTab)?.label || 'Dashboard'
  usePageTitle(tabLabel)
  const { state } = useAuth()
  const navigate = useNavigate()
  const location = useLocation()
  const [searchParams, setSearchParams] = useSearchParams()
  const [showInitialSync, setShowInitialSync] = useState(false)
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

  // detect incomplete initial sync (e.g. user refreshed mid-sync)
  useEffect(() => {
    if (syncChecked.current || showInitialSync) return
    if (state.status !== 'authenticated') return
    if (!state.user.hasOwnerRezConnection || state.user.isDemo) return

    syncChecked.current = true
    api
      .request<{ needed: boolean; completed: boolean }>('/sync/status')
      .then((result) => {
        if (result.success && result.data.needed && !result.data.completed) {
          setShowInitialSync(true)
        }
      })
      .catch(() => {})
  }, [state.status, showInitialSync])

  if (state.status !== 'authenticated') return null

  const { user } = state
  const isDemo = user.isDemo === true

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
          addToast('error', 'Failed to start the OwnerRez connection')
          setConnectLoading(false)
        }
      } catch {
        addToast('error', 'Failed to start the OwnerRez connection')
        setConnectLoading(false)
      }
    }

    return (
      <div className="min-h-screen bg-background flex flex-col">
        <AppHeader subtitle={null} />

        <main className="flex-1 flex items-center justify-center px-4 py-12">
          <div className="w-full max-w-md rounded-lg border border-border bg-card p-6 shadow-sm sm:p-8">
            <picture>
              <source srcSet="/logos/ownerrez-wide.avif" type="image/avif" />
              <img src="/logos/ownerrez-wide.png" alt="OwnerRez" className="h-7 w-auto -ml-1 brightness-0 dark:invert" />
            </picture>
            <h2 className="mt-5 text-xl font-semibold text-foreground">Connect OwnerRez</h2>
            <p className="mt-2 text-sm text-muted-foreground leading-relaxed">
              Baileys imports four years of properties, bookings and guests, then stays current through webhooks. You sign in on OwnerRez,
              so Baileys never sees your password.
            </p>
            <Button onClick={handleConnect} loading={connectLoading} loadingText="Connecting..." className="mt-6 w-full">
              Connect OwnerRez
            </Button>
          </div>
        </main>

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
        <AppHeader
          nav={<DashboardNav />}
          menu={
            <Sheet open={mobileMenuOpen} onOpenChange={setMobileMenuOpen}>
              <SheetTrigger asChild>
                <button
                  type="button"
                  className="md:hidden p-2 text-muted-foreground hover:text-foreground rounded-lg hover:bg-muted transition-colors cursor-pointer"
                  aria-label="Open menu"
                >
                  <Menu className="w-5 h-5" />
                </button>
              </SheetTrigger>
              <SheetContent side="right" className="w-80 overflow-y-auto p-0 gap-0 pt-10">
                <SheetTitle className="sr-only">Menu</SheetTitle>
                <div className="px-5 py-3">
                  <p className="text-xs font-medium text-muted-foreground mb-1.5 px-2">Dashboards</p>
                  <nav className="flex flex-col gap-0.5" aria-label="Dashboard tabs">
                    {tabConfig.map(({ id, label }) => (
                      <button
                        type="button"
                        key={id}
                        onClick={() => handleMobileTabClick(id)}
                        className={cn(
                          'flex items-center gap-3 px-2 py-2 rounded-md text-sm font-medium transition-colors cursor-pointer text-left',
                          activeTab === id ? 'bg-primary/10 text-primary' : 'text-muted-foreground hover:text-foreground hover:bg-muted/50',
                        )}
                      >
                        {label}
                      </button>
                    ))}
                  </nav>
                </div>

                <div className="h-px bg-border" />

                <div className="px-5 py-3">
                  <p className="text-xs font-medium text-muted-foreground mb-1.5 px-2">Filters</p>
                  <MobileFilterControls />
                </div>
              </SheetContent>
            </Sheet>
          }
        >
          {isDemo && (
            <Button asChild className="hidden sm:inline-flex">
              <Link to="/signup">Sign Up</Link>
            </Button>
          )}
        </AppHeader>

        <FilterBar />

        <main className="max-w-7xl mx-auto px-4 md:px-6 py-4 md:py-6 flex-1 w-full">
          <DashboardContent />
        </main>

        <Footer />
      </div>
    </>
  )
}
