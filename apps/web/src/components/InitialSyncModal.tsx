import { useState, useEffect } from 'react'
import { useNavigate } from 'react-router-dom'
import { api } from '@/lib/api'
import { LoadingState } from '@/components/LoadingState'
import { Button } from '@/components/ui/button'
import { CheckCircle, Home, Calendar, Users } from 'lucide-react'
import { LogoCube } from '@/components/LogoCube'

interface SyncProgress {
  step: 'checking' | 'properties' | 'bookings' | 'guests' | 'guest-contacts' | 'complete'
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

  // Retry helper for transient failures (504 timeouts, network errors)
  // api.request never throws - it returns { success: false } on failure,
  // so we check the result and retry on transient errors.
  const withRetry = async <T,>(
    fn: () => Promise<{ success: true; data: T } | { success: false; error: string; status?: number }>,
    retries = 2,
    delay = 2000
  ) => {
    let lastResult: Awaited<ReturnType<typeof fn>> | null = null
    for (let attempt = 0; attempt <= retries; attempt++) {
      lastResult = await fn()
      if (lastResult.success) return lastResult
      // Don't retry on auth or client errors - only transient/server failures
      if (lastResult.status && lastResult.status >= 400 && lastResult.status < 500) return lastResult
      if (attempt < retries) {
        await new Promise(resolve => setTimeout(resolve, delay))
      }
    }
    return lastResult!
  }

  const performInitialSync = async () => {
    try {
      // Step 1: Check if sync is needed
      setProgress({ step: 'checking' })
      const statusResult = await withRetry(() =>
        api.request<{ needed: boolean; completed: boolean }>('/initial-sync-chunked/status')
      )

      if (!statusResult.success) {
        throw new Error('Failed to check sync status')
      }

      if (!statusResult.data.needed || statusResult.data.completed) {
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

      const propertiesResult = await withRetry(() =>
        api.request<{
          success: boolean;
          propertiesCount: number;
          properties: Array<{ id: string; name: string }>
        }>('/initial-sync-chunked/properties', { method: 'POST' })
      )

      if (!propertiesResult.success) {
        throw new Error(propertiesResult.error || 'Failed to sync properties')
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
        blocksLoaded: 0,
        guestsLoaded: 0
      })

      let totalBookings = 0
      let totalBlocks = 0

      for (let i = 0; i < properties.length; i++) {
        const property = properties[i]

        setProgress(prev => ({
          ...prev,
          currentProperty: i + 1
        }))

        const bookingsResult = await withRetry(() =>
          api.request<{
            success: boolean;
            bookingsCount: number;
            blocksCount: number;
          }>(`/initial-sync-chunked/bookings/${property.id}`, { method: 'POST' })
        )

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

      // Step 4: Sync guests (non-blocking - don't fail the whole sync if this times out)
      setProgress({
        step: 'guests',
        currentProperty: totalProperties,
        totalProperties,
        propertiesLoaded: totalProperties,
        bookingsLoaded: totalBookings,
        blocksLoaded: totalBlocks,
        guestsLoaded: 0
      })

      let totalGuests = 0
      try {
        const guestsResult = await withRetry(() =>
          api.request<{
            success: boolean;
            guestsCount: number;
          }>('/initial-sync-chunked/guests', { method: 'POST' })
        )
        totalGuests = guestsResult.success ? guestsResult.data.guestsCount : 0
      } catch {
        // Guest sync is supplementary - don't block completion
      }

      setProgress(prev => ({
        ...prev,
        guestsLoaded: totalGuests
      }))

      // Step 4b: Enrich guest contact details (non-blocking)
      // Loops until all guests are processed, with a safety cap to prevent infinite loops
      setProgress(prev => ({ ...prev, step: 'guest-contacts' }))
      try {
        let remaining = 1
        let iterations = 0
        const MAX_ITERATIONS = 20 // safety cap: 20 * 30 guests = 600 max
        while (remaining > 0 && iterations < MAX_ITERATIONS) {
          const contactResult = await withRetry(() =>
            api.request<{
              success: boolean
              enriched: number
              remaining: number
            }>('/initial-sync-chunked/guest-contacts', { method: 'POST' })
          )
          if (!contactResult.success) break
          remaining = contactResult.data.remaining
          iterations++
        }
      } catch {
        // Guest contact enrichment is supplementary - don't block completion
      }

      // Step 5: Mark as complete
      await withRetry(() =>
        api.request('/initial-sync-chunked/complete', {
          method: 'POST',
          body: JSON.stringify({
            totalProperties,
            totalBookings,
            totalBlocks,
            totalGuests
          })
        })
      )

      setProgress({
        step: 'complete',
        propertiesLoaded: totalProperties,
        bookingsLoaded: totalBookings,
        blocksLoaded: totalBlocks,
        guestsLoaded: totalGuests
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
    if (progress.step === 'guests') return 80
    if (progress.step === 'guest-contacts') return 90
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
      case 'guest-contacts':
        return 'Loading guest contact details...'
      case 'complete':
        return 'Sync complete!'
      default:
        return 'Initializing...'
    }
  }

  if (error) {
    return (
      <div className="fixed inset-0 bg-black/50 backdrop-blur-sm z-50 flex items-center justify-center">
        <div className="bg-card rounded-xl shadow-xl p-8 max-w-md w-full mx-4">
          <h2 className="text-xl font-semibold text-danger mb-4">Sync Error</h2>
          <p className="text-muted-foreground mb-6">{error}</p>
          <div className="flex gap-3">
            <Button
              onClick={() => {
                setError(null)
                performInitialSync()
              }}
              className="flex-1"
            >
              Try Again
            </Button>
            <Button
              variant="outline"
              onClick={() => navigate('/settings')}
              className="flex-1"
            >
              Go to Settings
            </Button>
          </div>
        </div>
      </div>
    )
  }

  return (
    <div className="fixed inset-0 bg-background z-50 flex items-center justify-center">
      <div className="bg-card rounded-xl shadow-xl p-8 max-w-lg w-full mx-4">
        <div className="text-center">
          <div className="flex flex-col items-center mb-6">
            <LogoCube className="w-12 h-12 mb-3" />
            {progress.step === 'complete' ? (
              <CheckCircle className="w-6 h-6 text-success" />
            ) : (
              <LoadingState size="sm" />
            )}
          </div>
          
          <h2 className="text-2xl font-bold text-foreground mb-2">
            {progress.step === 'complete' ? 'Welcome to Baileys!' : 'Setting Up Your Dashboard'}
          </h2>
          
          <p className="text-muted-foreground mb-6">
            {progress.step === 'complete' 
              ? 'Your data has been synced successfully.'
              : 'We\'re importing your historical data from OwnerRez. This will only take a moment.'}
          </p>
          
          {/* Progress Bar */}
          <div className="mb-6">
            <div className="bg-muted rounded-full h-2 overflow-hidden">
              <div 
                className="h-full bg-primary transition-all duration-500"
                style={{ width: `${getProgressPercentage()}%` }}
              />
            </div>
            <p className="text-sm text-muted-foreground mt-2">{getStatusMessage()}</p>
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
                    <Home className="w-5 h-5 text-info" />
                  </div>
                  <div className="text-2xl font-bold text-foreground">
                    {progress.propertiesLoaded}
                  </div>
                  <div className="text-xs text-muted-foreground">Properties</div>
                </div>
              )}
              
              {progress.bookingsLoaded !== undefined && (
                <div className="text-center">
                  <div className="flex justify-center mb-2">
                    <Calendar className="w-5 h-5 text-success" />
                  </div>
                  <div className="text-2xl font-bold text-foreground">
                    {progress.bookingsLoaded}
                  </div>
                  <div className="text-xs text-muted-foreground">Bookings</div>
                </div>
              )}
              
              {progress.blocksLoaded !== undefined && (
                <div className="text-center">
                  <div className="flex justify-center mb-2">
                    <Calendar className="w-5 h-5 text-purple-fg" />
                  </div>
                  <div className="text-2xl font-bold text-foreground">
                    {progress.blocksLoaded}
                  </div>
                  <div className="text-xs text-muted-foreground">Blocks</div>
                </div>
              )}
              
              {progress.guestsLoaded !== undefined && (
                <div className="text-center">
                  <div className="flex justify-center mb-2">
                    <Users className="w-5 h-5 text-orange-fg" />
                  </div>
                  <div className="text-2xl font-bold text-foreground">
                    {progress.guestsLoaded}
                  </div>
                  <div className="text-xs text-muted-foreground">Guests</div>
                </div>
              )}
            </div>
          )}
        </div>
      </div>
    </div>
  )
}