import { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { RefreshCw, Link2 } from 'lucide-react'
import { useAuth } from '@/contexts/auth'
import { useToast } from '@/contexts/toast'
import { useSyncStatus, useWebhookHealth } from '@/hooks/use-api'
import { api } from '@/lib/api'
import { formatDateDisplay } from '@baileys/utils'
import { LoadingState } from '@/components/LoadingState'
import { ConfirmModal } from '@/components/ConfirmModal'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { SettingsSection, SettingsRow } from './SettingsSection'

const formatAgo = (hours: number) => {
  if (hours < 1) return 'under an hour ago'
  if (hours < 48) return `${Math.round(hours)}h ago`
  return `${Math.round(hours / 24)}d ago`
}

const webhookBadge = (hours: number | null | undefined) => {
  if (hours == null) return <Badge variant="neutral">Checking</Badge>
  if (hours < 24) return <Badge variant="success">Active</Badge>
  if (hours < 72) return <Badge variant="warning">Quiet</Badge>
  return <Badge variant="danger">No events</Badge>
}

export const IntegrationsTab = () => {
  const { state, refreshUser } = useAuth()
  const { addToast } = useToast()
  const navigate = useNavigate()
  const [disconnectModalOpen, setDisconnectModalOpen] = useState(false)
  const [isDisconnecting, setIsDisconnecting] = useState(false)

  const { data: syncStatus, isLoading, mutate } = useSyncStatus()
  const { data: webhookHealth } = useWebhookHealth()

  if (state.status === 'loading' || isLoading) {
    return <LoadingState />
  }

  if (state.status !== 'authenticated') {
    return null
  }

  const isConnected = state.user.hasOwnerRezConnection

  const handleConnect = async () => {
    try {
      const result = await api.initiateOAuth()
      if (result.success) {
        window.location.href = result.data.authUrl
      } else {
        addToast('error', result.error || 'Failed to start the connection')
      }
    } catch {
      addToast('error', 'Failed to start the connection')
    }
  }

  const handleDisconnect = async () => {
    setIsDisconnecting(true)
    try {
      const result = await api.disconnectOwnerRez()
      if (result.success) {
        addToast('success', 'OwnerRez disconnected')
        await refreshUser()
        mutate()
      } else {
        addToast('error', 'Failed to disconnect OwnerRez')
      }
    } catch {
      addToast('error', 'Failed to disconnect OwnerRez')
    } finally {
      setIsDisconnecting(false)
      setDisconnectModalOpen(false)
    }
  }

  const handleResync = async () => {
    try {
      const result = await api.request('/sync/reset', { method: 'POST' })
      if (result.success) {
        navigate('/dashboard/overview?sync=initial')
      } else {
        addToast('error', 'Failed to start sync')
      }
    } catch {
      addToast('error', 'Failed to start sync')
    }
  }

  const hours = webhookHealth?.lastWebhookHoursAgo
  const lastSync = syncStatus?.lastBookingSync ?? syncStatus?.lastPropertySync

  return (
    <div className="space-y-6">
      <SettingsSection
        title={
          <picture>
            <source srcSet="/logos/ownerrez-wide.avif" type="image/avif" />
            <img src="/logos/ownerrez-wide.png" alt="OwnerRez" className="h-7 w-auto -ml-1 brightness-0 dark:invert" />
          </picture>
        }
        description="Properties, bookings, guests and inquiries sync from OwnerRez and stay current through webhooks."
        action={
          isConnected ? (
            <>
              <Badge variant="success">Connected</Badge>
              <Button variant="ghost" size="sm" onClick={() => setDisconnectModalOpen(true)} className="text-muted-foreground">
                Disconnect
              </Button>
            </>
          ) : (
            <Button onClick={handleConnect}>
              <Link2 className="w-4 h-4" />
              Connect
            </Button>
          )
        }
      >
        {isConnected && syncStatus && (
          <>
            <SettingsRow label="Webhooks">
              {webhookBadge(hours)}
              {hours != null && <span className="text-muted-foreground font-normal">last event {formatAgo(hours)}</span>}
            </SettingsRow>
            <SettingsRow label="Synced">
              <span className="tabular-nums">
                {syncStatus.propertyCount.toLocaleString()} properties, {syncStatus.bookingCount.toLocaleString()} bookings,{' '}
                {syncStatus.guestCount.toLocaleString()} guests
              </span>
            </SettingsRow>
            <SettingsRow label="Full sync">
              {lastSync && <span className="text-muted-foreground font-normal">{formatDateDisplay(lastSync)}</span>}
              <Button variant="outline" size="sm" onClick={handleResync}>
                <RefreshCw className="w-3.5 h-3.5" />
                Re-sync 4 years
              </Button>
            </SettingsRow>
            <p className="pt-3 text-xs text-muted-foreground">
              Guest-paid platform fees are estimated: Vrbo 8%, Airbnb 14.2% for bookings made before October 27, 2025 and 0% after.
            </p>
          </>
        )}
      </SettingsSection>

      <ConfirmModal
        isOpen={disconnectModalOpen}
        onClose={() => setDisconnectModalOpen(false)}
        onConfirm={handleDisconnect}
        title="Disconnect OwnerRez?"
        message="Syncing stops. Existing data stays in Baileys but will no longer update until you reconnect."
        confirmText="Disconnect"
        variant="danger"
        isLoading={isDisconnecting}
      />
    </div>
  )
}
