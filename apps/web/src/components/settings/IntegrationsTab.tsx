import { useState } from 'react'
import { useAuth } from '@/contexts/auth'
import { useToast } from '@/contexts/toast'
import { useSyncStatus, manualSync, historicalSync, syncGuestDetails } from '@/hooks/use-api'
import { api } from '@/lib/api'
import { LoadingState } from '@/components/LoadingState'
import { 
  RefreshCw, AlertCircle, Check, Link2, Link2Off,
  Building2, Loader2, UserCheck, Clock, Database, Users, Calendar
} from 'lucide-react'
import { formatDateDisplay } from '@baileys/utils'
import { ConfirmModal } from '@/components/ConfirmModal'

type SyncState =
  | { type: 'idle' }
  | { type: 'syncing'; mode: 'recent' | 'historical' | 'guest-details' }
  | { type: 'complete' }

export const IntegrationsTab = () => {
  const { state, refreshUser } = useAuth()
  const { addToast } = useToast()
  const [syncState, setSyncState] = useState<SyncState>({ type: 'idle' })
  const [disconnectModalOpen, setDisconnectModalOpen] = useState(false)
  const [isDisconnecting, setIsDisconnecting] = useState(false)
  
  const { data: syncStatus, isLoading, mutate } = useSyncStatus()
  
  if (state.status === 'loading' || isLoading) {
    return <LoadingState />
  }
  
  if (state.status !== 'authenticated') {
    return null
  }
  
  const { user } = state
  const isConnected = user.hasOwnerRezConnection
  
  const handleConnect = async () => {
    try {
      const result = await api.initiateOAuth()
      if (result.success) {
        window.location.href = result.data.authUrl
      }
    } catch (error) {
      addToast('error', 'Failed to initiate connection')
    }
  }
  
  const handleDisconnect = async () => {
    setIsDisconnecting(true)
    try {
      const result = await api.disconnectOwnerRez()
      if (result.success) {
        addToast('success', 'OwnerRez disconnected successfully')
        await refreshUser()
        mutate()
      } else {
        addToast('error', 'Failed to disconnect OwnerRez')
      }
    } catch (error) {
      addToast('error', 'Failed to disconnect OwnerRez')
    } finally {
      setIsDisconnecting(false)
      setDisconnectModalOpen(false)
    }
  }
  
  const handleRecentSync = async () => {
    setSyncState({ type: 'syncing', mode: 'recent' })
    try {
      const result = await manualSync()
      if (result.success) {
        addToast('success', 'Recent data synced successfully')
        mutate()
      } else {
        addToast('error', 'Sync failed')
      }
    } catch (error) {
      addToast('error', 'Sync failed')
    } finally {
      setSyncState({ type: 'complete' })
      setTimeout(() => setSyncState({ type: 'idle' }), 2000)
    }
  }
  
  const handleHistoricalSync = async () => {
    setSyncState({ type: 'syncing', mode: 'historical' })
    try {
      const result = await historicalSync()
      if (result.success) {
        addToast('success', 'Historical data synced successfully')
        mutate()
      } else {
        addToast('error', 'Historical sync failed')
      }
    } catch (error) {
      addToast('error', 'Historical sync failed')
    } finally {
      setSyncState({ type: 'complete' })
      setTimeout(() => setSyncState({ type: 'idle' }), 2000)
    }
  }
  
  const handleGuestDetailsSync = async () => {
    setSyncState({ type: 'syncing', mode: 'guest-details' })
    try {
      const result = await syncGuestDetails()
      if (result.success) {
        addToast('success', `Updated ${result.data.guestsUpdated} guest records`)
        mutate()
      } else {
        addToast('error', 'Guest details sync failed')
      }
    } catch (error) {
      addToast('error', 'Guest details sync failed')
    } finally {
      setSyncState({ type: 'complete' })
      setTimeout(() => setSyncState({ type: 'idle' }), 2000)
    }
  }
  
  const formatDate = (dateString: string | null): string =>
    dateString ? formatDateDisplay(new Date(dateString)) : 'Never'
  
  return (
    <div className="space-y-6">
      {/* ownerrez integration card */}
      <div className="bg-white rounded-lg shadow-sm border border-gray-200 overflow-hidden">
        <div className="p-6">
          <div className="flex items-start justify-between mb-6">
            <div className="flex items-start gap-4">
              <div className="w-12 h-12 bg-blue-100 rounded-lg flex items-center justify-center">
                <Building2 className="w-6 h-6 text-blue-600" />
              </div>
              <div>
                <h2 className="text-xl font-semibold text-gray-900 mb-1">OwnerRez</h2>
                <p className="text-gray-600">
                  Connect your OwnerRez account to sync properties, bookings, and guest data
                </p>
              </div>
            </div>
            <div className="flex items-center gap-2">
              {isConnected ? (
                <>
                  <span className="flex items-center gap-1.5 px-3 py-1 bg-green-50 text-green-700 rounded-full text-sm font-medium">
                    <Check className="w-4 h-4" />
                    Connected
                  </span>
                  <button
                    onClick={() => setDisconnectModalOpen(true)}
                    className="p-2 text-gray-400 hover:text-red-600 hover:bg-red-50 rounded-lg transition-all"
                    title="Disconnect OwnerRez"
                  >
                    <Link2Off className="w-5 h-5" />
                  </button>
                </>
              ) : (
                <button
                  onClick={handleConnect}
                  className="flex items-center gap-2 px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-all font-medium"
                >
                  <Link2 className="w-4 h-4" />
                  Connect
                </button>
              )}
            </div>
          </div>

          {isConnected && syncStatus && (
            <>
              <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-6">
                <div className="bg-gray-50 rounded-lg p-4">
                  <div className="flex items-center gap-2 text-gray-600 mb-1">
                    <Database className="w-4 h-4" />
                    <span className="text-sm font-medium">Properties</span>
                  </div>
                  <p className="text-2xl font-bold text-gray-900">{syncStatus.propertyCount}</p>
                  <p className="text-xs text-gray-500 mt-1">
                    Last sync: {formatDate(syncStatus.lastPropertySync)}
                  </p>
                </div>
                
                <div className="bg-gray-50 rounded-lg p-4">
                  <div className="flex items-center gap-2 text-gray-600 mb-1">
                    <Calendar className="w-4 h-4" />
                    <span className="text-sm font-medium">Bookings</span>
                  </div>
                  <p className="text-2xl font-bold text-gray-900">{syncStatus.bookingCount}</p>
                  <p className="text-xs text-gray-500 mt-1">
                    Last sync: {formatDate(syncStatus.lastBookingSync)}
                  </p>
                </div>
                
                <div className="bg-gray-50 rounded-lg p-4">
                  <div className="flex items-center gap-2 text-gray-600 mb-1">
                    <Users className="w-4 h-4" />
                    <span className="text-sm font-medium">Guests</span>
                  </div>
                  <p className="text-2xl font-bold text-gray-900">{syncStatus.guestCount || 0}</p>
                  <p className="text-xs text-gray-500 mt-1">
                    With contact info
                  </p>
                </div>
                
                <div className="bg-gray-50 rounded-lg p-4">
                  <div className="flex items-center gap-2 text-gray-600 mb-1">
                    <Clock className="w-4 h-4" />
                    <span className="text-sm font-medium">Last Activity</span>
                  </div>
                  <p className="text-sm font-semibold text-gray-900">
                    {formatDate(syncStatus.lastBookingSync || syncStatus.lastPropertySync)}
                  </p>
                </div>
              </div>

              <div className="border-t border-gray-200 pt-6">
                <h3 className="text-sm font-semibold text-gray-900 mb-4">Sync Options</h3>
                <div className="flex flex-wrap gap-3">
                  <button
                    onClick={handleRecentSync}
                    disabled={syncState.type === 'syncing'}
                    className="flex items-center gap-2 px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-all font-medium disabled:opacity-50 disabled:cursor-not-allowed"
                  >
                    {syncState.type === 'syncing' && syncState.mode === 'recent' ? (
                      <Loader2 className="w-4 h-4 animate-spin" />
                    ) : (
                      <RefreshCw className="w-4 h-4" />
                    )}
                    Sync Recent (7 days)
                  </button>
                  
                  <button
                    onClick={handleHistoricalSync}
                    disabled={syncState.type === 'syncing'}
                    className="flex items-center gap-2 px-4 py-2 bg-white text-gray-700 border border-gray-200 rounded-lg hover:bg-gray-50 transition-all font-medium disabled:opacity-50 disabled:cursor-not-allowed"
                  >
                    {syncState.type === 'syncing' && syncState.mode === 'historical' ? (
                      <Loader2 className="w-4 h-4 animate-spin" />
                    ) : (
                      <Clock className="w-4 h-4" />
                    )}
                    Sync Historical (2 years)
                  </button>
                  
                  <button
                    onClick={handleGuestDetailsSync}
                    disabled={syncState.type === 'syncing'}
                    className="flex items-center gap-2 px-4 py-2 bg-white text-gray-700 border border-gray-200 rounded-lg hover:bg-gray-50 transition-all font-medium disabled:opacity-50 disabled:cursor-not-allowed"
                  >
                    {syncState.type === 'syncing' && syncState.mode === 'guest-details' ? (
                      <Loader2 className="w-4 h-4 animate-spin" />
                    ) : (
                      <UserCheck className="w-4 h-4" />
                    )}
                    Sync Guest Details
                  </button>
                </div>
                
                {syncState.type === 'syncing' && (
                  <div className="mt-4 p-3 bg-blue-50 text-blue-700 rounded-lg flex items-center gap-2">
                    <Loader2 className="w-4 h-4 animate-spin" />
                    <span className="text-sm">
                      {syncState.mode === 'recent' && 'Syncing recent bookings...'}
                      {syncState.mode === 'historical' && 'Syncing historical data (this may take a while)...'}
                      {syncState.mode === 'guest-details' && 'Updating guest contact information...'}
                    </span>
                  </div>
                )}
                
                {syncState.type === 'complete' && (
                  <div className="mt-4 p-3 bg-green-50 text-green-700 rounded-lg flex items-center gap-2">
                    <Check className="w-4 h-4" />
                    <span className="text-sm">Sync completed successfully</span>
                  </div>
                )}
              </div>
            </>
          )}
          
          {!isConnected && (
            <div className="border-t border-gray-200 pt-6">
              <div className="bg-amber-50 border border-amber-200 rounded-lg p-4">
                <div className="flex gap-3">
                  <AlertCircle className="w-5 h-5 text-amber-600 flex-shrink-0 mt-0.5" />
                  <div>
                    <p className="text-sm text-amber-800 font-medium mb-1">
                      Connection Required
                    </p>
                    <p className="text-sm text-amber-700">
                      Connect your OwnerRez account to start syncing property and booking data. 
                      You'll be redirected to OwnerRez to authorize the connection.
                    </p>
                  </div>
                </div>
              </div>
            </div>
          )}
        </div>
      </div>

      {/* future integrations placeholder */}
      <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-6 opacity-60">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-4">
            <div className="w-12 h-12 bg-gray-100 rounded-lg flex items-center justify-center">
              <Link2 className="w-6 h-6 text-gray-400" />
            </div>
            <div>
              <h3 className="text-lg font-semibold text-gray-900">More Integrations Coming Soon</h3>
              <p className="text-gray-600 text-sm">
                Additional property management platforms and services will be available in future updates
              </p>
            </div>
          </div>
        </div>
      </div>
      
      <ConfirmModal
        isOpen={disconnectModalOpen}
        onClose={() => setDisconnectModalOpen(false)}
        onConfirm={handleDisconnect}
        title="Disconnect OwnerRez?"
        message="This will stop syncing data from OwnerRez. Your existing data will remain, but won't be updated. You can reconnect at any time."
        confirmText="Disconnect"
        variant="danger"
        isLoading={isDisconnecting}
      />
    </div>
  )
}