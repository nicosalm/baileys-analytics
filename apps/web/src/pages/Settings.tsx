import { Link, useSearchParams } from 'react-router-dom'
import { useAuth } from '@/contexts/auth'
import { useState, useEffect, lazy, Suspense } from 'react'
import { useToast } from '@/contexts/toast'
import { useSyncStatus, manualSync, historicalSync } from '@/hooks/use-api'
import { LoadingState } from '@/components/LoadingState'
import { RefreshCw, Calendar, AlertCircle, Calculator } from 'lucide-react'
import { formatDateDisplay } from '@baileys/utils'

// Lazy load the tax management panel
const TaxManagementPanel = lazy(() => 
  import('@/components/settings/TaxManagementPanel').then(m => ({ default: m.TaxManagementPanel }))
)

type SyncStatus = {
  lastPropertySync: string | null
  lastBookingSync: string | null
  propertyCount: number
  bookingCount: number
}

type SyncState =
  | { type: 'idle' }
  | { type: 'syncing'; mode: 'recent' | 'historical' }
  | { type: 'complete' }

const formatDate = (dateString: string | null): string =>
  dateString ? formatDateDisplay(new Date(dateString)) : 'Never'

const SyncButton = ({
  label,
  icon: Icon,
  onClick,
  disabled,
  loading
}: {
  label: string
  icon: React.ComponentType<{ className?: string }>
  onClick: () => void
  disabled: boolean
  loading: boolean
}) => (
  <button
    onClick={onClick}
    disabled={disabled}
    className="flex items-center px-4 py-2 bg-blue-600 text-white rounded-sm disabled:opacity-50"
  >
    {loading ? <LoadingState /> : <Icon className="w-4 h-4 mr-2" />}
    {label}
  </button>
)

const SyncStatusDisplay = ({ status }: { status: SyncStatus | null }) => {
  if (!status) return null

  return (
    <div className="bg-gray-50 p-4 rounded-sm space-y-2">
      <div className="text-sm">
        <span className="text-gray-600">Properties:</span> {status.propertyCount}
      </div>
      <div className="text-sm">
        <span className="text-gray-600">Total Bookings:</span> {status.bookingCount}
        <span className="text-xs text-gray-500 ml-1">(excluding canceled)</span>
      </div>
      <div className="text-sm">
        <span className="text-gray-600">Last Property Sync:</span> {formatDate(status.lastPropertySync)}
      </div>
      <div className="text-sm">
        <span className="text-gray-600">Last Booking Sync:</span> {formatDate(status.lastBookingSync)}
      </div>
    </div>
  )
}

const AccountInfo = ({ email, createdAt, companyName }: {
  email: string
  createdAt: string
  companyName?: string | null
}) => (
  <div className="bg-white p-6 rounded-lg shadow-sm">
    <h2 className="text-xl font-bold mb-4">Your Account</h2>
    <div className="space-y-2">
      <div>
        <span className="text-gray-600">Email:</span> {email}
      </div>
      <div>
        <span className="text-gray-600">Account Created:</span> {formatDateDisplay(new Date(createdAt))}
      </div>
      {companyName && (
        <div>
          <span className="text-gray-600">Company:</span> {companyName}
        </div>
      )}
    </div>
  </div>
)

const OwnerRezConnection = ({
  isConnected,
  syncStatus,
  onRecentSync,
  onHistoricalSync,
  syncState
}: {
  isConnected: boolean
  syncStatus: SyncStatus | null
  onRecentSync: () => void
  onHistoricalSync: () => void
  syncState: SyncState
}) => {
  if (!isConnected) {
    return (
      <div className="p-4 border rounded-sm">
        <h2 className="text-xl font-bold mb-4">OwnerRez Connection</h2>
        <p className="text-gray-600">Not connected</p>
      </div>
    )
  }

  const isSyncing = syncState.type === 'syncing'

  return (
    <div className="bg-white p-6 rounded-lg shadow-sm">
      <h2 className="text-xl font-bold mb-4">Property Management Connection</h2>
      <div className="space-y-4">
        <p className="text-green-600 flex items-center">
          ✓ Connected to OwnerRez
        </p>

        <SyncStatusDisplay status={syncStatus} />

        <div className="space-y-2">
          <SyncButton
            label="Sync Recent Updates"
            icon={RefreshCw}
            onClick={onRecentSync}
            disabled={isSyncing}
            loading={isSyncing && syncState.mode === 'recent'}
          />

          <SyncButton
            label="Sync Historical Data (4 Years)"
            icon={Calendar}
            onClick={onHistoricalSync}
            disabled={isSyncing}
            loading={isSyncing && syncState.mode === 'historical'}
          />

          <div className="flex items-start space-x-2 text-sm text-gray-600 mt-2">
            <AlertCircle className="w-4 h-4 mt-0.5" />
            <div>
              <p>Recent sync updates data from the last 30 days.</p>
              <p>Historical sync retrieves all bookings from the past 4 years.</p>
              <p>Data syncs automatically every 12 hours.</p>
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}

export const Settings = () => {
  const { state } = useAuth()
  const { addToast } = useToast()
  const [searchParams] = useSearchParams()
  const [syncState, setSyncState] = useState<SyncState>({ type: 'idle' })
  const [activeTab, setActiveTab] = useState<'account' | 'tax'>('account')
  
  const { data: syncStatus } = useSyncStatus()
  
  // Handle URL parameter for tab selection
  useEffect(() => {
    const tab = searchParams.get('tab')
    if (tab === 'tax') {
      setActiveTab('tax')
    }
  }, [searchParams])

  if (state.status !== 'authenticated') return null

  const { user } = state

  const handleSync = async (type: 'recent' | 'historical') => {
    if (type === 'historical' && !window.confirm(
      'This will download all your booking history (up to 4 years). It may take a few minutes. Continue?'
    )) {
      return
    }

    setSyncState({ type: 'syncing', mode: type })

    const result = type === 'historical'
      ? await historicalSync()
      : await manualSync()

    if (result.success) {
      let message: string

      if (type === 'historical') {
        // Check if we have the new response format with bookingsFound
        const bookingsFound = result.data.bookingsFound || result.data.totalBookingsFetched
        const bookingsSynced = result.data.bookingsSynced

        if (bookingsFound && bookingsFound !== bookingsSynced) {
          message = `Historical sync completed: ${bookingsSynced} bookings saved out of ${bookingsFound} fetched`
        } else {
          message = `Historical sync completed: ${bookingsSynced} bookings synced`
        }
      } else {
        // For recent sync, check if it's full sync or just bookings
        if (result.data.bookings) {
          // Full sync response
          const bookingInfo = result.data.bookings
          if (bookingInfo.status === 'success') {
            const totalFetched = bookingInfo.totalFetched || bookingInfo.synced
            if (totalFetched !== bookingInfo.synced) {
              message = `Sync completed: ${result.data.properties?.synced || 0} properties, ${bookingInfo.synced} bookings saved out of ${totalFetched} fetched`
            } else {
              message = `Sync completed: ${result.data.properties?.synced || 0} properties, ${bookingInfo.synced} bookings`
            }
          } else {
            message = 'Sync completed with errors'
          }
        } else {
          // Simple sync response
          message = 'Sync completed successfully'
        }
      }

      addToast('success', message)
      // Sync status will automatically refresh via SWR
    } else {
      addToast('error', `${type === 'historical' ? 'Historical' : 'Recent'} sync failed`)
    }

    setSyncState({ type: 'complete' })
    setTimeout(() => setSyncState({ type: 'idle' }), 1000)
  }


  return (
    <div className="min-h-screen">
      <nav className="p-4 border-b">
        <div className="max-w-6xl mx-auto">
          <Link to="/dashboard/overview" className="text-blue-600">← Back to Dashboard</Link>
        </div>
      </nav>

      <div className="max-w-6xl mx-auto p-4">
        <h1 className="text-2xl font-bold mb-6">Settings</h1>

        <div className="mb-6 border-b">
          <nav className="flex space-x-8">
            <button
              onClick={() => setActiveTab('account')}
              className={`pb-2 border-b-2 transition-colors ${
                activeTab === 'account'
                  ? 'border-blue-600 text-blue-600'
                  : 'border-transparent text-gray-600 hover:text-gray-900'
              }`}
            >
              Account
            </button>
            <button
              onClick={() => setActiveTab('tax')}
              className={`pb-2 border-b-2 transition-colors flex items-center ${
                activeTab === 'tax'
                  ? 'border-blue-600 text-blue-600'
                  : 'border-transparent text-gray-600 hover:text-gray-900'
              }`}
            >
              <Calculator className="w-4 h-4 mr-2" />
              Tax Configuration
            </button>
          </nav>
        </div>

        {activeTab === 'account' ? (
          <div className="space-y-6">
            <AccountInfo
              email={user.email}
              createdAt={user.createdAt}
              companyName={user.companyName}
            />

            <OwnerRezConnection
              isConnected={user.hasOwnerRezConnection}
              syncStatus={syncStatus}
              onRecentSync={() => handleSync('recent')}
              onHistoricalSync={() => handleSync('historical')}
              syncState={syncState}
            />
          </div>
        ) : (
          <Suspense fallback={
            <div className="bg-white p-6 rounded-lg shadow-sm">
              <div className="flex justify-center py-12">
                <LoadingState />
              </div>
            </div>
          }>
            <div className="bg-white p-6 rounded-lg shadow-sm">
              <TaxManagementPanel />
            </div>
          </Suspense>
        )}
        
      </div>
    </div>
  )
}
