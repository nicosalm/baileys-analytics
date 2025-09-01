import { Link, useSearchParams, useNavigate } from 'react-router-dom'
import { useAuth } from '@/contexts/auth'
import { useState, useEffect, lazy, Suspense, ComponentType } from 'react'
import { useToast } from '@/contexts/toast'
import { useSyncStatus, manualSync, historicalSync, syncGuestDetails } from '@/hooks/use-api'
import { useTips } from '@/hooks/use-tips'
import { LoadingState } from '@/components/LoadingState'
import { 
  RefreshCw, Calendar, AlertCircle, Calculator, Check,
  Building2, Loader2, UserCheck, Lightbulb, Trash2, BarChart3, 
  LogOut, User, Home
} from 'lucide-react'
import { formatDateDisplay } from '@baileys/utils'
import { Footer } from '@/components/Footer'
import { BRAND } from '@/constants'
import { ConfirmModal } from '@/components/ConfirmModal'

const TaxManagementPanel = lazy(() => 
  import('@/components/settings/TaxManagementPanel').then(m => ({ default: m.TaxManagementPanel }))
)

const SeasonManagementPanel = lazy(() => 
  import('@/components/settings/SeasonManagementPanel').then(m => ({ default: m.SeasonManagementPanel }))
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

type SettingsTab = 'account' | 'tax' | 'seasons'

const formatDate = (dateString: string | null): string =>
  dateString ? formatDateDisplay(new Date(dateString)) : 'Never'

const tabConfig: { id: SettingsTab; label: string; icon: ComponentType<{ className?: string }> }[] = [
  { 
    id: 'account', 
    label: 'Account & Sync', 
    icon: User
  },
  { 
    id: 'tax', 
    label: 'Tax Configuration', 
    icon: Calculator
  },
  { 
    id: 'seasons', 
    label: 'Seasons', 
    icon: Calendar
  }
]

const SyncButton = ({
  label,
  icon: Icon,
  onClick,
  disabled,
  loading,
  variant = 'primary'
}: {
  label: string
  icon: ComponentType<{ className?: string }>
  onClick: () => void
  disabled: boolean
  loading: boolean
  variant?: 'primary' | 'secondary'
}) => (
  <button
    onClick={onClick}
    disabled={disabled}
    className={`flex items-center gap-2 px-4 py-2 rounded-lg font-medium text-sm transition-all disabled:opacity-50 disabled:cursor-not-allowed ${
      variant === 'primary' 
        ? 'bg-blue-600 text-white hover:bg-blue-700' 
        : 'bg-white text-gray-700 hover:bg-gray-50 border border-gray-200'
    }`}
  >
    {loading ? <Loader2 className="w-4 h-4 animate-spin" /> : <Icon className="w-4 h-4" />}
    {label}
  </button>
)

const AccountTab = ({ 
  email, 
  createdAt, 
  companyName, 
  isConnected,
  syncStatus,
  onRecentSync,
  onHistoricalSync,
  onGuestDetailsSync,
  syncState,
  onDeleteAccount 
}: {
  email: string
  createdAt: string
  companyName?: string | null
  isConnected: boolean
  syncStatus: SyncStatus | null
  onRecentSync: () => void
  onHistoricalSync: () => void
  onGuestDetailsSync: () => void
  syncState: SyncState
  onDeleteAccount: () => void
}) => {
  const { showTips, toggleTips } = useTips()
  const { addToast } = useToast()
  
  const handleToggleTips = () => {
    toggleTips()
    addToast('success', showTips ? 'Tips & hints disabled' : 'Tips & hints enabled')
  }

  const isSyncing = syncState.type === 'syncing'
  
  return (
    <div className="space-y-6">
      <div className="bg-gradient-to-r from-blue-50 to-indigo-50 rounded-xl p-6">
        <div className="flex items-start justify-between">
          <div>
            <h2 className="text-2xl font-bold text-gray-900 mb-2">Account & Sync</h2>
            <p className="text-gray-600">
              Manage your account settings and sync data from OwnerRez
            </p>
          </div>
          {isConnected && syncStatus && (
            <div className="flex gap-3">
              <div className="bg-white rounded-lg px-4 py-3 shadow-sm">
                <div className="text-2xl font-bold text-blue-600">
                  {syncStatus.propertyCount}
                </div>
                <div className="text-xs text-gray-500 mt-1">Properties</div>
              </div>
              <div className="bg-white rounded-lg px-4 py-3 shadow-sm">
                <div className="text-2xl font-bold text-blue-600">
                  {syncStatus.bookingCount}
                </div>
                <div className="text-xs text-gray-500 mt-1">Bookings</div>
              </div>
            </div>
          )}
        </div>
      </div>

      <div className="grid lg:grid-cols-2 gap-6">
        <div className="bg-white rounded-lg border border-gray-200 hover:border-blue-200 transition-all">
          <div className="p-4">
            <div className="flex items-center gap-3 mb-4">
              <div className="p-2 bg-gray-50 rounded-lg">
                <User className="w-5 h-5 text-gray-600" />
              </div>
              <h3 className="text-lg font-semibold text-gray-900">Account Information</h3>
            </div>
          <div className="space-y-3">
            <div className="flex justify-between items-center">
              <span className="text-sm text-gray-600">Email</span>
              <span className="text-sm font-medium text-gray-900">{email}</span>
            </div>
            {companyName && (
              <div className="flex justify-between items-center pt-3 border-t">
                <span className="text-sm text-gray-600">Company</span>
                <span className="text-sm font-medium text-gray-900">{companyName}</span>
              </div>
            )}
            <div className="flex justify-between items-center pt-3 border-t">
              <span className="text-sm text-gray-600">Member Since</span>
              <span className="text-sm font-medium text-gray-900">{formatDateDisplay(new Date(createdAt))}</span>
            </div>
          </div>
          </div>
        </div>

        <div className="bg-white rounded-lg border border-gray-200 hover:border-blue-200 transition-all">
          <div className="p-4">
            <div className="flex items-center gap-3 mb-4">
              <div className="p-2 bg-gray-50 rounded-lg">
                <Lightbulb className="w-5 h-5 text-gray-600" />
              </div>
              <h3 className="text-lg font-semibold text-gray-900">Preferences</h3>
            </div>
          <div className="space-y-4">
            <div className="flex justify-between items-center">
              <div>
                <span className="text-sm font-medium text-gray-700">Tips & Hints</span>
                <p className="text-xs text-gray-500 mt-0.5">Show helpful tips throughout the dashboard</p>
              </div>
              <button
                onClick={handleToggleTips}
                className={`relative inline-flex h-6 w-11 items-center rounded-full transition-colors ${
                  showTips ? 'bg-blue-600' : 'bg-gray-300'
                }`}
              >
                <span
                  className={`inline-block h-4 w-4 transform rounded-full bg-white shadow-sm transition-transform ${
                    showTips ? 'translate-x-6' : 'translate-x-1'
                  }`}
                />
              </button>
            </div>

          </div>

          <div className="mt-6 pt-6 border-t">
            <button
              onClick={onDeleteAccount}
              className="w-full px-4 py-2 bg-red-50 text-red-600 text-sm font-medium rounded-lg hover:bg-red-100 transition-all flex items-center justify-center gap-2 border border-red-200"
            >
              <Trash2 className="w-4 h-4" />
              Delete Account
            </button>
          </div>
          </div>
        </div>
      </div>

      <div className="bg-white rounded-lg border border-gray-200 hover:border-blue-200 transition-all">
        <div className="p-4">
          <div className="flex items-center justify-between mb-4">
            <div className="flex items-center gap-3">
              <div className="p-2 bg-gray-50 rounded-lg">
                <Building2 className="w-5 h-5 text-gray-600" />
              </div>
              <h3 className="text-lg font-semibold text-gray-900">OwnerRez Connection</h3>
            </div>
          {isConnected && (
            <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-xs font-medium bg-green-50 text-green-700 border border-green-200">
              <Check className="w-3 h-3" />
              Connected
            </span>
          )}
          </div>
          {!isConnected ? (
            <div className="text-center py-8">
              <div className="w-12 h-12 bg-gray-100 rounded-full flex items-center justify-center mx-auto mb-3">
                <AlertCircle className="w-6 h-6 text-gray-400" />
              </div>
              <p className="text-gray-600 mb-4">No property management system connected</p>
              <button className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-all font-medium">
                Connect OwnerRez
              </button>
            </div>
          ) : (
            <div className="space-y-4">
              <div className="grid grid-cols-2 gap-4">
                <div className="bg-gray-50 p-4 rounded-lg">
                  <div className="flex items-center gap-1 text-xs text-gray-600 mb-1">
                    <Building2 className="w-3 h-3" />
                    Properties
                  </div>
                  <div className="text-2xl font-semibold text-gray-900">{syncStatus?.propertyCount || 0}</div>
                  <div className="text-xs text-gray-500 mt-1">
                    Last: {formatDate(syncStatus?.lastPropertySync || null)}
                  </div>
                </div>
                <div className="bg-gray-50 p-4 rounded-lg">
                  <div className="flex items-center gap-1 text-xs text-gray-600 mb-1">
                    <Calendar className="w-3 h-3" />
                    Bookings
                  </div>
                  <div className="text-2xl font-semibold text-gray-900">{syncStatus?.bookingCount || 0}</div>
                  <div className="text-xs text-gray-500 mt-1">
                    Last: {formatDate(syncStatus?.lastBookingSync || null)}
                  </div>
                </div>
              </div>

              <div className="flex flex-wrap gap-2">
                <SyncButton
                  label="Sync Recent"
                  icon={RefreshCw}
                  onClick={onRecentSync}
                  disabled={isSyncing}
                  loading={isSyncing && syncState.mode === 'recent'}
                  variant="primary"
                />
                <SyncButton
                  label="Historical (4 Years)"
                  icon={Calendar}
                  onClick={onHistoricalSync}
                  disabled={isSyncing}
                  loading={isSyncing && syncState.mode === 'historical'}
                  variant="secondary"
                />
                <SyncButton
                  label="Guest Contacts"
                  icon={UserCheck}
                  onClick={onGuestDetailsSync}
                  disabled={isSyncing}
                  loading={isSyncing && syncState.mode === 'guest-details'}
                  variant="secondary"
                />
              </div>

              <div className="bg-blue-50 border border-blue-200 rounded-lg p-3">
                <div className="flex items-start gap-2">
                  <AlertCircle className="w-4 h-4 text-blue-600 mt-0.5 flex-shrink-0" />
                  <div className="text-xs text-blue-700 space-y-0.5">
                    <p>• Recent: Updates last 30 days</p>
                    <p>• Historical: All bookings from past 4 years</p>
                    <p>• Guest: Contact details from OwnerRez</p>
                    <p>• Auto-syncs every 12 hours</p>
                  </div>
                </div>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  )
}

export const Settings = () => {
  const { state, logout } = useAuth()
  const { addToast } = useToast()
  const navigate = useNavigate()
  const [searchParams, setSearchParams] = useSearchParams()
  const [syncState, setSyncState] = useState<SyncState>({ type: 'idle' })
  const [activeTab, setActiveTab] = useState<SettingsTab>('account')
  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false)
  const [deleteConfirmText, setDeleteConfirmText] = useState('')
  const [isDeleting, setIsDeleting] = useState(false)
  const [confirmModal, setConfirmModal] = useState<{
    isOpen: boolean
    type?: 'historical' | 'guest-details'
  }>({ isOpen: false })
  
  const { data: syncStatus } = useSyncStatus()
  
  useEffect(() => {
    const tab = searchParams.get('tab') as SettingsTab | null
    if (tab && tabConfig.some(t => t.id === tab)) {
      setActiveTab(tab)
    }
  }, [searchParams])

  const handleTabChange = (tab: SettingsTab) => {
    setActiveTab(tab)
    setSearchParams({ tab })
  }

  if (state.status !== 'authenticated') return null

  const { user } = state

  const handleSync = async (type: 'recent' | 'historical' | 'guest-details') => {
    if (type === 'historical' || type === 'guest-details') {
      setConfirmModal({ isOpen: true, type })
      return
    }

    await performSync(type)
  }

  const performSync = async (type: 'recent' | 'historical' | 'guest-details') => {
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
        const bookingsFound = result.data.bookingsFound || result.data.totalBookingsFetched
        const bookingsSynced = result.data.bookingsSynced

        if (bookingsFound && bookingsFound !== bookingsSynced) {
          message = `Historical sync completed: ${bookingsSynced} bookings saved out of ${bookingsFound} fetched`
        } else {
          message = `Historical sync completed: ${bookingsSynced} bookings synced`
        }
      } else {
        if (result.data.bookings) {
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
          message = 'Sync completed successfully'
        }
      }

      addToast('success', message)
    } else {
      const typeLabel = type === 'historical' ? 'Historical' : type === 'guest-details' ? 'Guest details' : 'Recent'
      addToast('error', `${typeLabel} sync failed`)
    }

    setSyncState({ type: 'complete' })
    setTimeout(() => setSyncState({ type: 'idle' }), 1000)
  }

  const handleLogout = async () => {
    await logout()
    navigate('/')
  }

  const handleDeleteAccount = async () => {
    if (deleteConfirmText !== 'DELETE') {
      addToast('error', 'Please type DELETE to confirm')
      return
    }

    setIsDeleting(true)
    
    try {
      const response = await fetch('/api/account/delete', {
        method: 'DELETE',
        headers: {
          'Authorization': `Bearer ${localStorage.getItem('accessToken')}`,
          'Content-Type': 'application/json'
        }
      })

      if (response.ok) {
        addToast('success', 'Account deleted successfully')
        await logout()
        window.location.href = '/'
      } else {
        const error = await response.json().catch(() => ({ error: 'Failed to delete account' }))
        addToast('error', error.error || 'Failed to delete account')
      }
    } catch (error) {
      addToast('error', 'Network error while deleting account')
    } finally {
      setIsDeleting(false)
      setShowDeleteConfirm(false)
      setDeleteConfirmText('')
    }
  }

  return (
    <div className="min-h-screen bg-gradient-to-b from-slate-50 via-white to-slate-50 flex flex-col">
      <header className="bg-white/80 backdrop-blur-sm border-b border-gray-200 sticky top-0 z-40">
        <div className="max-w-7xl mx-auto px-6 py-4">
          <div className="flex justify-between items-center">
            <div className="flex items-center">
              <Link to="/dashboard/overview" className="flex items-center hover:opacity-80 transition-opacity">
                <div className={`w-10 h-10 ${BRAND.logoGradient} rounded-xl flex items-center justify-center shadow-sm`}>
                  <BarChart3 className="w-6 h-6 text-white" />
                </div>
                <div className="ml-3">
                  <h1 className="text-xl font-semibold text-gray-900">{BRAND.name}</h1>
                  {user.companyName && (
                    <p className="text-xs text-gray-500 -mt-0.5">for {user.companyName}</p>
                  )}
                </div>
              </Link>
            </div>
            <div className="flex items-center gap-3">
              <span className="text-sm text-gray-500 hidden sm:inline">{user.email}</span>
              <div className="flex items-center gap-2 pl-3 border-l border-gray-200">
                <Link
                  to="/dashboard/overview"
                  className="p-2 text-gray-500 hover:text-gray-700 hover:bg-gray-100 rounded-lg transition-all"
                  title="Dashboard"
                >
                  <Home className="w-5 h-5" />
                </Link>
                <button
                  onClick={handleLogout}
                  className="flex items-center gap-2 px-3 py-1.5 text-sm font-medium text-gray-600 hover:text-gray-900 hover:bg-gray-100 rounded-lg transition-all"
                >
                  <LogOut className="w-4 h-4" />
                  <span className="hidden sm:inline">Logout</span>
                </button>
              </div>
            </div>
          </div>
        </div>
      </header>

      <div className="bg-white/90 backdrop-blur-sm border-b border-gray-200">
        <div className="max-w-7xl mx-auto">
          <nav className="flex gap-1 px-6" aria-label="Tabs">
            {tabConfig.map(({ id, label, icon: Icon }) => (
              <button
                key={id}
                onClick={() => handleTabChange(id)}
                className={`
                  py-3 px-4 border-b-2 font-medium text-sm flex items-center transition-all
                  ${activeTab === id
                    ? 'border-blue-600 text-blue-600 bg-blue-50/30'
                    : 'border-transparent text-gray-600 hover:text-gray-900 hover:bg-gray-50/50'
                  }
                `}
                aria-current={activeTab === id ? 'page' : undefined}
              >
                <Icon className="w-4 h-4 mr-2" />
                {label}
              </button>
            ))}
          </nav>
        </div>
      </div>

      <main className="max-w-7xl mx-auto px-6 py-6 flex-1 w-full">
        {activeTab === 'account' ? (
          <AccountTab
            email={user.email}
            createdAt={user.createdAt}
            companyName={user.companyName}
            isConnected={user.hasOwnerRezConnection}
            syncStatus={syncStatus}
            onRecentSync={() => handleSync('recent')}
            onHistoricalSync={() => handleSync('historical')}
            onGuestDetailsSync={() => handleSync('guest-details')}
            syncState={syncState}
            onDeleteAccount={() => setShowDeleteConfirm(true)}
          />
        ) : activeTab === 'tax' ? (
          <Suspense fallback={
            <div className="bg-white p-8 rounded-xl border border-gray-200">
              <div className="flex justify-center py-12">
                <LoadingState />
              </div>
            </div>
          }>
            <TaxManagementPanel />
          </Suspense>
        ) : (
          <Suspense fallback={
            <div className="bg-white p-8 rounded-xl border border-gray-200">
              <div className="flex justify-center py-12">
                <LoadingState />
              </div>
            </div>
          }>
            <SeasonManagementPanel />
          </Suspense>
        )}
      </main>

      <ConfirmModal
        isOpen={confirmModal.isOpen}
        onClose={() => setConfirmModal({ isOpen: false })}
        onConfirm={async () => {
          const type = confirmModal.type
          if (!type) return
          await performSync(type)
        }}
        title={confirmModal.type === 'historical' ? 'Sync Historical Data' : 'Sync Guest Details'}
        message={
          confirmModal.type === 'historical'
            ? 'This will fetch all bookings from the past 4 years. This operation may take several minutes.'
            : 'This will fetch contact details (email/phone) for all guests. This operation may take a few minutes.'
        }
        confirmText="Start Sync"
        variant="warning"
      />
      
      {showDeleteConfirm && (
        <div className="fixed inset-0 z-50 overflow-y-auto">
          <div className="fixed inset-0 bg-black/20 backdrop-blur-sm" onClick={() => {
            setShowDeleteConfirm(false)
            setDeleteConfirmText('')
          }} />
          <div className="flex min-h-screen items-center justify-center p-4">
          <div className="relative bg-white rounded-lg shadow-2xl ring-1 ring-gray-200 max-w-md w-full p-6">
            <div className="flex items-start mb-4">
              <div className="w-12 h-12 bg-red-100 rounded-full flex items-center justify-center flex-shrink-0">
                <AlertCircle className="w-6 h-6 text-red-600" />
              </div>
              <div className="ml-4">
                <h3 className="text-lg font-semibold text-gray-900">Delete Account</h3>
                <p className="text-sm text-gray-600 mt-1">
                  This will permanently delete your account and all associated data including:
                </p>
                <ul className="text-sm text-gray-600 mt-2 space-y-1 list-disc list-inside">
                  <li>All property and booking data</li>
                  <li>Tax configurations and reports</li>
                  <li>Historical analytics data</li>
                  <li>Account settings and preferences</li>
                </ul>
              </div>
            </div>
            
            <div className="bg-red-50 border border-red-200 rounded-lg p-3 mb-4">
              <p className="text-sm text-red-800">
                <strong>Warning:</strong> This action cannot be undone. Your data will be permanently deleted within 30 days.
              </p>
            </div>
            
            <div className="mb-4">
              <label className="block text-sm font-medium text-gray-700 mb-2">
                Type <span className="font-bold">DELETE</span> to confirm
              </label>
              <input
                type="text"
                value={deleteConfirmText}
                onChange={(e) => setDeleteConfirmText(e.target.value)}
                className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-red-500 focus:border-red-500"
                placeholder="Type DELETE here"
                disabled={isDeleting}
              />
            </div>
            
            <div className="flex justify-end space-x-3">
              <button
                onClick={() => {
                  setShowDeleteConfirm(false)
                  setDeleteConfirmText('')
                }}
                className="px-4 py-2 text-gray-700 hover:text-gray-900 transition-all"
                disabled={isDeleting}
              >
                Cancel
              </button>
              <button
                onClick={handleDeleteAccount}
                disabled={deleteConfirmText !== 'DELETE' || isDeleting}
                className="px-4 py-2 bg-red-600 text-white rounded-lg hover:bg-red-700 transition-all font-medium disabled:opacity-50 disabled:cursor-not-allowed flex items-center"
              >
                {isDeleting ? (
                  <>
                    <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                    Deleting...
                  </>
                ) : (
                  <>
                    <Trash2 className="w-4 h-4 mr-2" />
                    Delete Account
                  </>
                )}
              </button>
            </div>
          </div>
          </div>
        </div>
      )}
      
      <Footer />
    </div>
  )
}