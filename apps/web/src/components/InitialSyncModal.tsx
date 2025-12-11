import { useState, useEffect } from 'react'
import { useNavigate } from 'react-router-dom'
import { api } from '@/lib/api'
import { LoadingState } from '@/components/LoadingState'
import { CheckCircle, Home, Calendar, Users } from 'lucide-react'
import { BRAND } from '@/constants'

interface SyncProgress {
  step: 'checking' | 'properties' | 'bookings' | 'guests' | 'complete'
  currentProperty?: number
  totalProperties?: number
  propertiesLoaded?: number
  bookingsLoaded?: number
  blocksLoaded?: number
  guestsLoaded?: number
}

interface InitialSyncModalProps {
  onComplete?: () => void
}

export const InitialSyncModal = ({ onComplete }: InitialSyncModalProps = {}) => {
  const navigate = useNavigate()
  const [progress, setProgress] = useState<SyncProgress>({ step: 'checking' })
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    performInitialSync()
  }, [])

  const performInitialSync = async () => {
    try {
      // Step 1: Check if sync is needed
      setProgress({ step: 'checking' })
      const statusResult = await api.request<{ needed: boolean; completed: boolean }>(
        '/initial-sync-chunked/status'
      )
      
      if (!statusResult.success) {
        throw new Error('Failed to check sync status')
      }
      
      if (!statusResult.data.needed || statusResult.data.completed) {
        // Sync not needed or already completed
        setProgress({ step: 'complete' })
        setTimeout(() => {
          if (onComplete) {
            onComplete()
          }
          navigate('/dashboard/overview')
        }, 1000)
        return
      }

      // Step 2: Sync properties
      setProgress({ step: 'properties' })
      
      const propertiesResult = await api.request<{ 
        success: boolean; 
        propertiesCount: number;
        properties: Array<{ id: string; name: string }>
      }>('/initial-sync-chunked/properties', { method: 'POST' })
      
      if (!propertiesResult.success) {
        const errorMessage = propertiesResult.error || 'Failed to sync properties'

        // check if it's an authentication error
        if (errorMessage.toLowerCase().includes('unauthorized') || errorMessage.toLowerCase().includes('expired')) {
          throw new Error('OwnerRez authentication failed. Please reconnect to OwnerRez in Settings.')
        }
        throw new Error(errorMessage)
      }
      
      const properties = propertiesResult.data.properties || []
      const totalProperties = properties.length
      
      // Step 3: Sync bookings for each property
      setProgress({ 
        step: 'bookings', 
        currentProperty: 0, 
        totalProperties,
        propertiesLoaded: totalProperties,
        bookingsLoaded: 0,
        blocksLoaded: 0
      })
      
      let totalBookings = 0
      let totalBlocks = 0
      
      for (let i = 0; i < properties.length; i++) {
        const property = properties[i]
        
        setProgress(prev => ({
          ...prev,
          currentProperty: i + 1
        }))
        
        const bookingsResult = await api.request<{
          success: boolean;
          bookingsCount: number;
          blocksCount: number;
        }>(`/initial-sync-chunked/bookings/${property.id}`, { method: 'POST' })
        
        if (bookingsResult.success) {
          totalBookings += bookingsResult.data.bookingsCount
          totalBlocks += bookingsResult.data.blocksCount
          
          setProgress(prev => ({
            ...prev,
            bookingsLoaded: totalBookings,
            blocksLoaded: totalBlocks
          }))
        }
      }
      
      // Step 4: Sync guests
      setProgress({ 
        step: 'guests',
        currentProperty: totalProperties,
        totalProperties,
        propertiesLoaded: totalProperties,
        bookingsLoaded: totalBookings,
        blocksLoaded: totalBlocks
      })
      
      const guestsResult = await api.request<{
        success: boolean;
        guestsCount: number;
      }>('/initial-sync-chunked/guests', { method: 'POST' })
      
      const totalGuests = guestsResult.success ? guestsResult.data.guestsCount : 0
      
      setProgress(prev => ({
        ...prev,
        guestsLoaded: totalGuests
      }))
      
      // Step 5: Mark as complete
      await api.request('/initial-sync-chunked/complete', {
        method: 'POST',
        body: JSON.stringify({
          totalProperties,
          totalBookings,
          totalBlocks,
          totalGuests
        })
      })
      
      setProgress({ 
        step: 'complete',
        propertiesLoaded: totalProperties,
        bookingsLoaded: totalBookings,
        blocksLoaded: totalBlocks
      })
      
      // Redirect to dashboard after a moment
      setTimeout(() => {
        if (onComplete) {
          onComplete()
        }
        navigate('/dashboard/overview')
      }, 2000)
      
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to sync data')
    }
  }

  const getProgressPercentage = () => {
    if (progress.step === 'checking') return 10
    if (progress.step === 'properties') return 25
    if (progress.step === 'bookings' && progress.totalProperties) {
      const propertyProgress = ((progress.currentProperty || 0) / progress.totalProperties) * 45
      return 25 + propertyProgress
    }
    if (progress.step === 'guests') return 85
    if (progress.step === 'complete') return 100
    return 0
  }

  const getStatusMessage = () => {
    switch (progress.step) {
      case 'checking':
        return 'Connecting to OwnerRez...'
      case 'properties':
        return 'Loading your properties...'
      case 'bookings':
        if (progress.currentProperty && progress.totalProperties) {
          return `Syncing bookings (${progress.currentProperty} of ${progress.totalProperties} properties)...`
        }
        return 'Syncing bookings...'
      case 'guests':
        return 'Syncing guest information and tags...'
      case 'complete':
        return 'Sync complete!'
      default:
        return 'Initializing...'
    }
  }

  if (error) {
    return (
      <div className="fixed inset-0 bg-black/50 backdrop-blur-sm z-50 flex items-center justify-center">
        <div className="bg-white rounded-xl shadow-xl p-8 max-w-md w-full mx-4">
          <h2 className="text-xl font-bold text-red-600 mb-4">Sync Error</h2>
          <p className="text-gray-600 mb-6">{error}</p>
          <button
            onClick={() => navigate('/dashboard/settings')}
            className="w-full px-4 py-2 bg-gray-900 text-white rounded-lg hover:bg-gray-800"
          >
            Go to Settings
          </button>
        </div>
      </div>
    )
  }

  return (
    <div className="fixed inset-0 bg-gradient-to-br from-blue-50 via-white to-blue-50 z-50 flex items-center justify-center">
      <div className="bg-white rounded-xl shadow-xl p-8 max-w-lg w-full mx-4">
        <div className="text-center">
          <div className={`w-16 h-16 ${BRAND.logoGradient} rounded-xl flex items-center justify-center mx-auto mb-6 shadow-lg`}>
            {progress.step === 'complete' ? (
              <CheckCircle className="w-8 h-8 text-white" />
            ) : (
              <LoadingState size="sm" />
            )}
          </div>
          
          <h2 className="text-2xl font-bold text-gray-900 mb-2">
            {progress.step === 'complete' ? 'Welcome to Baileys!' : 'Setting Up Your Dashboard'}
          </h2>
          
          <p className="text-gray-600 mb-6">
            {progress.step === 'complete' 
              ? 'Your data has been synced successfully.'
              : 'We\'re importing your historical data from OwnerRez. This will only take a moment.'}
          </p>
          
          {/* Progress Bar */}
          <div className="mb-6">
            <div className="bg-gray-200 rounded-full h-2 overflow-hidden">
              <div 
                className={`h-full ${BRAND.buttonGradient} transition-all duration-500`}
                style={{ width: `${getProgressPercentage()}%` }}
              />
            </div>
            <p className="text-sm text-gray-500 mt-2">{getStatusMessage()}</p>
          </div>
          
          {/* Stats */}
          {(progress.propertiesLoaded !== undefined || 
            progress.bookingsLoaded !== undefined || 
            progress.blocksLoaded !== undefined || 
            progress.guestsLoaded !== undefined) && (
            <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mt-6 pt-6 border-t">
              {progress.propertiesLoaded !== undefined && (
                <div className="text-center">
                  <div className="flex justify-center mb-2">
                    <Home className="w-5 h-5 text-blue-600" />
                  </div>
                  <div className="text-2xl font-bold text-gray-900">
                    {progress.propertiesLoaded}
                  </div>
                  <div className="text-xs text-gray-500">Properties</div>
                </div>
              )}
              
              {progress.bookingsLoaded !== undefined && (
                <div className="text-center">
                  <div className="flex justify-center mb-2">
                    <Calendar className="w-5 h-5 text-green-600" />
                  </div>
                  <div className="text-2xl font-bold text-gray-900">
                    {progress.bookingsLoaded}
                  </div>
                  <div className="text-xs text-gray-500">Bookings</div>
                </div>
              )}
              
              {progress.blocksLoaded !== undefined && (
                <div className="text-center">
                  <div className="flex justify-center mb-2">
                    <Calendar className="w-5 h-5 text-purple-600" />
                  </div>
                  <div className="text-2xl font-bold text-gray-900">
                    {progress.blocksLoaded}
                  </div>
                  <div className="text-xs text-gray-500">Blocks</div>
                </div>
              )}
              
              {progress.guestsLoaded !== undefined && (
                <div className="text-center">
                  <div className="flex justify-center mb-2">
                    <Users className="w-5 h-5 text-orange-600" />
                  </div>
                  <div className="text-2xl font-bold text-gray-900">
                    {progress.guestsLoaded}
                  </div>
                  <div className="text-xs text-gray-500">Guests</div>
                </div>
              )}
            </div>
          )}
        </div>
      </div>
    </div>
  )
}