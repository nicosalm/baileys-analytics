// apps/web/src/pages/Settings.tsx
import { Link } from 'react-router-dom'
import { useAuth } from '@/contexts/auth'
import { useState, useEffect } from 'react'
import { api } from '@/lib/api'
import { useToast } from '@/contexts/toast'
import { Spinner } from '@/components/Spinner'
import { RefreshCw, Calendar, AlertCircle } from 'lucide-react'

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
  dateString ? new Date(dateString).toLocaleString() : 'Never'

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
    className="flex items-center px-4 py-2 bg-blue-600 text-white rounded disabled:opacity-50"
  >
    {loading ? <Spinner size="sm" /> : <Icon className="w-4 h-4 mr-2" />}
    {label}
  </button>
)

const SyncStatusDisplay = ({ status }: { status: SyncStatus | null }) => {
  if (!status) return null

  return (
    <div className="bg-gray-50 p-4 rounded space-y-2">
      <div className="text-sm">
        <span className="text-gray-600">Properties:</span> {status.propertyCount}
      </div>
      <div className="text-sm">
        <span className="text-gray-600">Active Bookings:</span> {status.bookingCount}
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
  <div className="p-4 border rounded">
    <h2 className="text-xl font-bold mb-4">Account Information</h2>
    <div className="space-y-2">
      <div>
        <span className="text-gray-600">Email:</span> {email}
      </div>
      <div>
        <span className="text-gray-600">Account Created:</span> {new Date(createdAt).toLocaleDateString()}
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
      <div className="p-4 border rounded">
        <h2 className="text-xl font-bold mb-4">OwnerRez Connection</h2>
        <p className="text-gray-600">Not connected</p>
      </div>
    )
  }

  const isSyncing = syncState.type === 'syncing'

  return (
    <div className="p-4 border rounded">
      <h2 className="text-xl font-bold mb-4">OwnerRez Connection</h2>
      <div className="space-y-4">
        <p className="text-green-600">✓ Connected</p>

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
            label="Sync Historical Data (2 Years)"
            icon={Calendar}
            onClick={onHistoricalSync}
            disabled={isSyncing}
            loading={isSyncing && syncState.mode === 'historical'}
          />

          <div className="flex items-start space-x-2 text-sm text-gray-600 mt-2">
            <AlertCircle className="w-4 h-4 mt-0.5" />
            <div>
              <p>Recent sync updates data from the last 30 days.</p>
              <p>Historical sync retrieves all bookings from the past 2 years.</p>
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
  const [syncState, setSyncState] = useState<SyncState>({ type: 'idle' })
  const [syncStatus, setSyncStatus] = useState<SyncStatus | null>(null)

  if (state.status !== 'authenticated') return null

  const { user } = state

  const loadSyncStatus = async () => {
    const result = await api.getSyncStatus()
    if (result.success) {
      setSyncStatus(result.data)
    }
  }

  const handleSync = async (type: 'recent' | 'historical') => {
    if (type === 'historical' && !window.confirm(
      'This will sync 2 years of historical data. This may take several minutes. Continue?'
    )) {
      return
    }

    setSyncState({ type: 'syncing', mode: type })

    const result = type === 'historical'
      ? await api.historicalSync()
      : await api.manualSync()

    if (result.success) {
      const message = type === 'historical'
        ? `Historical sync completed: ${result.data.bookingsSynced} bookings synced`
        : 'Sync completed successfully'
      addToast('success', message)
      await loadSyncStatus()
    } else {
      addToast('error', `${type === 'historical' ? 'Historical' : 'Recent'} sync failed`)
    }

    setSyncState({ type: 'complete' })
    setTimeout(() => setSyncState({ type: 'idle' }), 1000)
  }

  useEffect(() => {
    if (user.hasOwnerRezConnection) {
      loadSyncStatus()
    }
  }, [user.hasOwnerRezConnection])

  return (
    <div className="min-h-screen">
      <nav className="p-4 border-b">
        <div className="max-w-6xl mx-auto">
          <Link to="/dashboard" className="text-blue-600">← Back to Dashboard</Link>
        </div>
      </nav>

      <div className="max-w-6xl mx-auto p-4">
        <h1 className="text-2xl font-bold mb-6">Settings</h1>

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

          <div className="p-4 border rounded">
            <h2 className="text-xl font-bold mb-4">Tax Configuration</h2>
            <p className="text-gray-600">
              Custom tax rates coming soon. Currently using rates from OwnerRez.
            </p>
          </div>
        </div>
      </div>
    </div>
  )
}
