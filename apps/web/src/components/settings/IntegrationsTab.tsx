import { useState } from 'react'
import { useAuth } from '@/contexts/auth'
import { useToast } from '@/contexts/toast'
import { useSyncStatus } from '@/hooks/use-api'
import { api } from '@/lib/api'
import { LoadingState } from '@/components/LoadingState'
import { useNavigate } from 'react-router-dom'
import { 
  RefreshCw, AlertCircle, Check, Link2, Link2Off,
  Building2, Clock, Database, Users, Calendar, Webhook
} from 'lucide-react'
import { formatDateDisplay } from '@baileys/utils'
import { ConfirmModal } from '@/components/ConfirmModal'


export const IntegrationsTab = () => {
  const { state, refreshUser } = useAuth()
  const { addToast } = useToast()
  const navigate = useNavigate()
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
  
  const handleManualSync = async () => {
    // Reset the sync status to trigger a fresh sync
    try {
      const result = await api.request('/initial-sync-chunked/reset', {
        method: 'POST'
      })
      if (result.success) {
        // Navigate to dashboard with sync parameter
        navigate('/dashboard/overview?sync=initial')
      } else {
        addToast('error', 'Failed to initiate sync')
      }
    } catch (error) {
      addToast('error', 'Failed to initiate sync')
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
                  Connect your OwnerRez account to sync properties, bookings, and guest data with real-time webhook updates
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
                <div className="mb-4">
                  <div className="flex items-center gap-2 mb-2">
                    <Webhook className="w-4 h-4 text-green-600" />
                    <h3 className="text-sm font-semibold text-gray-900">Sync Status</h3>
                  </div>
                  <div className="bg-green-50 border border-green-200 rounded-lg p-3">
                    <p className="text-sm text-green-800">
                      <span className="font-medium">✓ Real-time webhooks active</span> - Your data automatically syncs when changes occur in OwnerRez.
                      Initial connection synced 3 years of historical data.
                    </p>
                  </div>
                </div>
                
                <h3 className="text-sm font-semibold text-gray-900 mb-4">Manual Sync</h3>
                <div className="flex flex-wrap gap-3">
                  <button
                    onClick={handleManualSync}
                    className="flex items-center gap-2 px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-all font-medium"
                  >
                    <RefreshCw className="w-4 h-4" />
                    Re-sync All Data (3 years)
                  </button>
                  <p className="text-xs text-gray-500 w-full mt-2">
                    This will re-run the initial sync process, refreshing all properties and bookings from the last 3 years.
                  </p>
                </div>
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
                      Initial connection will sync 3 years of historical data and enable real-time webhook updates.
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