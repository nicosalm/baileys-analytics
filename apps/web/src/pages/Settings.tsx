import { Link, useSearchParams } from 'react-router-dom'
import { useAuth } from '@/contexts/auth'
import { useState, useEffect, lazy, Suspense } from 'react'
import { useToast } from '@/contexts/toast'
import { useSyncStatus, manualSync, historicalSync, syncGuestDetails } from '@/hooks/use-api'
import { LoadingState } from '@/components/LoadingState'
import { RefreshCw, Calendar, AlertCircle, Calculator, ArrowLeft, Check, Clock, Building2, Loader2, UserCheck } from 'lucide-react'
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
  | { type: 'syncing'; mode: 'recent' | 'historical' | 'guest-details' }
  | { type: 'complete' }

const formatDate = (dateString: string | null): string =>
  dateString ? formatDateDisplay(new Date(dateString)) : 'Never'

const SyncButton = ({
  label,
  icon: Icon,
  onClick,
  disabled,
  loading,
  variant = 'primary'
}: {
  label: string
  icon: React.ComponentType<{ className?: string }>
  onClick: () => void
  disabled: boolean
  loading: boolean
  variant?: 'primary' | 'secondary'
}) => (
  <button
    onClick={onClick}
    disabled={disabled}
    className={`flex items-center px-4 py-2.5 rounded-lg font-medium transition-all disabled:opacity-50 disabled:cursor-not-allowed ${
      variant === 'primary' 
        ? 'bg-blue-600 text-white hover:bg-blue-700 hover:shadow-md' 
        : 'bg-gray-100 text-gray-700 hover:bg-gray-200 border border-gray-200'
    }`}
  >
    {loading ? <Loader2 className="w-4 h-4 mr-2 animate-spin" /> : <Icon className="w-4 h-4 mr-2" />}
    {label}
  </button>
)

const SyncStatusDisplay = ({ status }: { status: SyncStatus | null }) => {
  if (!status) return null

  return (
    <div className="bg-gray-50 p-4 rounded-lg space-y-3 border border-gray-100">
      <div className="grid grid-cols-2 gap-4">
        <div>
          <div className="flex items-center text-xs text-gray-500 mb-1">
            <Building2 className="w-3 h-3 mr-1" />
            Properties
          </div>
          <div className="text-lg font-semibold text-gray-900">{status.propertyCount}</div>
        </div>
        <div>
          <div className="flex items-center text-xs text-gray-500 mb-1">
            <Calendar className="w-3 h-3 mr-1" />
            Total Bookings
          </div>
          <div className="text-lg font-semibold text-gray-900">
            {status.bookingCount}
            <span className="text-xs text-gray-500 ml-1 font-normal">(excl. canceled)</span>
          </div>
        </div>
      </div>
      <div className="pt-3 border-t border-gray-200 space-y-2">
        <div className="flex items-center justify-between text-sm">
          <span className="text-gray-600 flex items-center">
            <Clock className="w-3 h-3 mr-1.5" />
            Last Property Sync
          </span>
          <span className="font-medium text-gray-900">{formatDate(status.lastPropertySync)}</span>
        </div>
        <div className="flex items-center justify-between text-sm">
          <span className="text-gray-600 flex items-center">
            <Clock className="w-3 h-3 mr-1.5" />
            Last Booking Sync
          </span>
          <span className="font-medium text-gray-900">{formatDate(status.lastBookingSync)}</span>
        </div>
      </div>
    </div>
  )
}

const AccountInfo = ({ email, createdAt, companyName }: {
  email: string
  createdAt: string
  companyName?: string | null
}) => (
  <div className="bg-white p-6 rounded-lg shadow-sm border border-gray-100">
    <h2 className="text-lg font-semibold text-gray-900 mb-4">Account Information</h2>
    <div className="space-y-3">
      <div className="flex justify-between items-center py-2 border-b border-gray-50">
        <span className="text-sm text-gray-600">Email Address</span>
        <span className="text-sm font-medium text-gray-900">{email}</span>
      </div>
      <div className="flex justify-between items-center py-2 border-b border-gray-50">
        <span className="text-sm text-gray-600">Member Since</span>
        <span className="text-sm font-medium text-gray-900">{formatDateDisplay(new Date(createdAt))}</span>
      </div>
      {companyName && (
        <div className="flex justify-between items-center py-2">
          <span className="text-sm text-gray-600">Company</span>
          <span className="text-sm font-medium text-gray-900">{companyName}</span>
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
  onGuestDetailsSync,
  syncState
}: {
  isConnected: boolean
  syncStatus: SyncStatus | null
  onRecentSync: () => void
  onHistoricalSync: () => void
  onGuestDetailsSync: () => void
  syncState: SyncState
}) => {
  if (!isConnected) {
    return (
      <div className="bg-white p-6 rounded-lg shadow-sm border border-gray-100">
        <h2 className="text-lg font-semibold text-gray-900 mb-4">Property Management Connection</h2>
        <div className="text-center py-8">
          <div className="w-12 h-12 bg-gray-100 rounded-full flex items-center justify-center mx-auto mb-3">
            <AlertCircle className="w-6 h-6 text-gray-400" />
          </div>
          <p className="text-gray-600 mb-4">No property management system connected</p>
          <button className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors font-medium">
            Connect OwnerRez
          </button>
        </div>
      </div>
    )
  }

  const isSyncing = syncState.type === 'syncing'

  return (
    <div className="bg-white p-6 rounded-lg shadow-sm border border-gray-100">
      <div className="flex items-center justify-between mb-4">
        <h2 className="text-lg font-semibold text-gray-900">Property Management Connection</h2>
        <span className="inline-flex items-center px-2.5 py-1 rounded-full text-xs font-medium bg-green-100 text-green-800">
          <Check className="w-3 h-3 mr-1" />
          Connected
        </span>
      </div>
      <div className="space-y-4">

        <SyncStatusDisplay status={syncStatus} />

        <div className="flex gap-3">
          <SyncButton
            label="Sync Recent"
            icon={RefreshCw}
            onClick={onRecentSync}
            disabled={isSyncing}
            loading={isSyncing && syncState.mode === 'recent'}
            variant="primary"
          />

          <SyncButton
            label="Sync Historical (4 Years)"
            icon={Calendar}
            onClick={onHistoricalSync}
            disabled={isSyncing}
            loading={isSyncing && syncState.mode === 'historical'}
            variant="secondary"
          />

          <SyncButton
            label="Sync Guest Contacts"
            icon={UserCheck}
            onClick={onGuestDetailsSync}
            disabled={isSyncing}
            loading={isSyncing && syncState.mode === 'guest-details'}
            variant="secondary"
          />

        </div>

        <div className="bg-blue-50 border border-blue-200 rounded-lg p-3">
          <div className="flex items-start">
            <AlertCircle className="w-4 h-4 text-blue-600 mr-2 mt-0.5 flex-shrink-0" />
            <div className="text-xs text-blue-800 space-y-1">
              <p>• Recent sync updates data from the last 30 days</p>
              <p>• Historical sync retrieves all bookings from the past 4 years</p>
              <p>• Guest sync fetches contact details (email/phone) from OwnerRez</p>
              <p>• Data syncs automatically every 12 hours</p>
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

  const handleSync = async (type: 'recent' | 'historical' | 'guest-details') => {
    if (type === 'historical' && !window.confirm(
      'This will download all your booking history (up to 4 years). It may take a few minutes. Continue?'
    )) {
      return
    }

    if (type === 'guest-details' && !window.confirm(
      'This will fetch and update contact information (emails and phone numbers) for all guests. Continue?'
    )) {
      return
    }

    setSyncState({ type: 'syncing', mode: type })

    const result = type === 'historical'
      ? await historicalSync()
      : type === 'guest-details'
      ? await syncGuestDetails()
      : await manualSync()

    if (result.success) {
      let message: string

      if (type === 'guest-details') {
        const guestsUpdated = result.data?.guestsUpdated || 0
        const errors = result.data?.errors || 0
        const totalProcessed = result.data?.totalProcessed || 0
        
        if (errors > 0) {
          message = `Guest sync completed: ${guestsUpdated} contacts updated, ${errors} errors out of ${totalProcessed} processed`
        } else if (guestsUpdated === 0) {
          message = 'No guests needed contact information updates'
        } else {
          message = `Guest sync completed: ${guestsUpdated} contacts updated successfully`
        }
      } else if (type === 'historical') {
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
      const typeLabel = type === 'historical' ? 'Historical' : type === 'guest-details' ? 'Guest details' : 'Recent'
      addToast('error', `${typeLabel} sync failed`)
    }

    setSyncState({ type: 'complete' })
    setTimeout(() => setSyncState({ type: 'idle' }), 1000)
  }


  return (
    <div className="min-h-screen bg-gray-50">
      <nav className="bg-white border-b border-gray-200">
        <div className="max-w-7xl mx-auto px-6 py-4">
          <Link to="/dashboard/overview" className="inline-flex items-center text-sm text-gray-600 hover:text-gray-900 transition-colors">
            <ArrowLeft className="w-4 h-4 mr-1" />
            Back to Dashboard
          </Link>
        </div>
      </nav>

      <div className="max-w-7xl mx-auto px-6 py-8">
        <div className="mb-8">
          <h1 className="text-2xl font-bold text-gray-900">Settings</h1>
          <p className="text-sm text-gray-600 mt-1">Manage your account, connections, and tax configurations</p>
        </div>

        <div className="bg-white rounded-lg shadow-sm border border-gray-100 mb-6">
          <nav className="flex">
            <button
              onClick={() => setActiveTab('account')}
              className={`flex-1 px-6 py-4 font-medium text-sm border-b-2 transition-all ${
                activeTab === 'account'
                  ? 'border-blue-600 text-blue-600 bg-blue-50/50'
                  : 'border-transparent text-gray-600 hover:text-gray-900 hover:bg-gray-50'
              }`}
            >
              Account & Sync
            </button>
            <button
              onClick={() => setActiveTab('tax')}
              className={`flex-1 px-6 py-4 font-medium text-sm border-b-2 transition-all flex items-center justify-center ${
                activeTab === 'tax'
                  ? 'border-blue-600 text-blue-600 bg-blue-50/50'
                  : 'border-transparent text-gray-600 hover:text-gray-900 hover:bg-gray-50'
              }`}
            >
              <Calculator className="w-4 h-4 mr-2" />
              Tax Configuration
            </button>
          </nav>
        </div>

        {activeTab === 'account' ? (
          <div className="grid gap-6">
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
              onGuestDetailsSync={() => handleSync('guest-details')}
              syncState={syncState}
            />
          </div>
        ) : (
          <Suspense fallback={
            <div className="bg-white p-8 rounded-lg shadow-sm border border-gray-100">
              <div className="flex justify-center py-12">
                <LoadingState />
              </div>
            </div>
          }>
            <TaxManagementPanel />
          </Suspense>
        )}
        
      </div>
    </div>
  )
}
