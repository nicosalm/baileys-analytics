import { useState } from 'react'
import { useAuth } from '@/contexts/auth'
import { useToast } from '@/contexts/toast'
import { useSyncStatus, useWebhookHealth } from '@/hooks/use-api'
import { api } from '@/lib/api'
import { supabase } from '@/lib/supabase'
import { LoadingState } from '@/components/LoadingState'
import { Link, useNavigate } from 'react-router-dom'
import {
  RefreshCw, AlertCircle, Check, Link2, Link2Off, Copy, Eye, EyeOff, Code2
} from 'lucide-react'
import { ConfirmModal } from '@/components/ConfirmModal'
import { Button } from '@/components/ui/button'


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

  const { user } = state
  const isConnected = user.hasOwnerRezConnection

  const handleConnect = async () => {
    try {
      const result = await api.initiateOAuth()
      if (result.success) {
        window.location.href = result.data.authUrl
      } else {
        addToast('error', result.error || 'Failed to initiate connection')
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

  return (
    <div className="space-y-6">
      {/* ownerrez integration card */}
      <div className="bg-card rounded-lg shadow-sm border overflow-hidden">
        <div className="p-6">
          <div className="flex items-start justify-between mb-6">
            <div className="flex items-start gap-4">
              <img
                src="/logos/ownerrez-app-icon.png"
                alt="OwnerRez"
                className="w-12 h-12 rounded-lg"
              />
              <div>
                <h3 className="text-lg font-semibold text-foreground mb-2">OwnerRez</h3>
                <p className="text-muted-foreground text-sm">
                  Syncs your properties, bookings, and guests. Stays up to date via webhooks.
                </p>
              </div>
            </div>
            <div className="flex items-center gap-2">
              {isConnected ? (
                <>
                  <span className="flex items-center gap-1.5 px-3 py-1 bg-success-subtle text-success-fg rounded-full text-sm font-medium">
                    <Check className="w-4 h-4" />
                    Connected
                  </span>
                  <Button
                    variant="ghost"
                    size="icon"
                    onClick={() => setDisconnectModalOpen(true)}
                    className="text-muted-foreground hover:text-danger hover:bg-danger-subtle"
                    title="Disconnect OwnerRez"
                  >
                    <Link2Off className="w-5 h-5" />
                  </Button>
                </>
              ) : (
                <Button onClick={handleConnect}>
                  <Link2 className="w-4 h-4" />
                  Connect
                </Button>
              )}
            </div>
          </div>

          {isConnected && syncStatus && (
            <>
              <div className="border-t pt-6">
                <div className="mb-6">
                  <h3 className="text-lg font-semibold text-foreground mb-2">Sync Status</h3>
                  {(() => {
                    const hours = webhookHealth?.lastWebhookHoursAgo
                    const hoursDisplay = hours != null ? (hours < 1 ? '<1 hour' : `${Math.round(hours)} hours`) : null

                    if (hours != null && hours < 24) {
                      return (
                        <div className="bg-success-subtle border border-success/30 rounded-lg p-3">
                          <p className="text-sm text-success-fg">
                            <span className="font-medium">✓ Real-time webhooks active</span> · last event {hoursDisplay} ago
                          </p>
                        </div>
                      )
                    }

                    if (hours != null && hours < 72) {
                      return (
                        <div className="bg-warning-subtle border border-warning/30 rounded-lg p-3">
                          <div className="flex items-center justify-between">
                            <p className="text-sm text-warning-fg">
                              <span className="font-medium">⚠ No webhooks received in {hoursDisplay}</span> · data may be stale
                            </p>
                            <Button variant="outline" size="sm" onClick={handleManualSync} className="ml-3 text-xs">
                              <RefreshCw className="w-3 h-3" />
                              Re-sync
                            </Button>
                          </div>
                        </div>
                      )
                    }

                    if (hours != null && hours >= 72) {
                      return (
                        <div className="bg-danger-subtle border border-danger/30 rounded-lg p-3">
                          <div className="flex items-center justify-between">
                            <p className="text-sm text-danger-fg">
                              <span className="font-medium">✗ Webhooks may be disconnected</span> · no events in {hoursDisplay}
                            </p>
                            <Button variant="outline" size="sm" onClick={handleManualSync} className="ml-3 text-xs">
                              <RefreshCw className="w-3 h-3" />
                              Re-sync
                            </Button>
                          </div>
                        </div>
                      )
                    }

                    // Loading or unknown state — show neutral/loading
                    return (
                      <div className="bg-muted/40 border rounded-lg p-3">
                        <p className="text-sm text-muted-foreground">
                          <span className="font-medium">Checking webhook status...</span>
                        </p>
                      </div>
                    )
                  })()}
                </div>

                <h3 className="text-lg font-semibold text-foreground mb-4">Manual Sync</h3>
                <div className="flex flex-wrap gap-3">
                  <Button onClick={handleManualSync}>
                    <RefreshCw className="w-4 h-4" />
                    Re-sync All Data (4 years)
                  </Button>
                  <p className="text-xs text-muted-foreground w-full mt-2">
                    This will re-run the initial sync process, refreshing all properties and bookings from the last 4 years.
                  </p>
                  <p className="text-xs text-muted-foreground/50 w-full mt-4">
                    Revenue, bookings, guests, and host service fees are synced from OwnerRez. Guest-facing OTA fees are estimated automatically (Airbnb ~15%, VRBO ~13%). Operating expenses, tax jurisdictions, and platform remittance rules must be configured manually in Settings.
                  </p>
                </div>
              </div>
            </>
          )}

          {!isConnected && (
            <div className="border-t pt-6">
              <div className="bg-warning-subtle border border-warning/30 rounded-lg p-4">
                <div className="flex gap-3">
                  <AlertCircle className="w-5 h-5 text-warning flex-shrink-0 mt-0.5" />
                  <div>
                    <p className="text-sm text-warning-fg font-medium mb-1">
                      Connection Required
                    </p>
                    <p className="text-sm text-warning-fg">
                      Connect your OwnerRez account to start syncing property and booking data.
                      Initial connection will sync 4 years of historical data and enable real-time webhook updates.
                    </p>
                  </div>
                </div>
              </div>
            </div>
          )}
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

      <ApiTokenCard />
    </div>
  )
}

const ApiTokenCard = () => {
  const { addToast } = useToast()
  const [token, setToken] = useState<string | null>(null)
  const [isGenerating, setIsGenerating] = useState(false)
  const [showToken, setShowToken] = useState(false)
  const [copied, setCopied] = useState(false)

  const generateToken = async () => {
    setIsGenerating(true)
    try {
      const { data: { session } } = await supabase.auth.getSession()
      if (session?.access_token) {
        setToken(session.access_token)
        setShowToken(true)
      } else {
        addToast('error', 'No active session. Please sign in again.')
      }
    } catch {
      addToast('error', 'Failed to generate token')
    } finally {
      setIsGenerating(false)
    }
  }

  const copyToken = () => {
    if (!token) return
    navigator.clipboard.writeText(token)
    setCopied(true)
    setTimeout(() => setCopied(false), 2000)
  }

  return (
    <div className="bg-card rounded-lg shadow-sm border overflow-hidden">
      <div className="p-6">
        <div className="flex items-start gap-4 mb-4">
          <div className="w-12 h-12 rounded-lg bg-muted/60 flex items-center justify-center">
            <Code2 className="w-6 h-6 text-muted-foreground" />
          </div>
          <div>
            <h3 className="text-lg font-semibold text-foreground mb-2">Data API</h3>
            <p className="text-muted-foreground text-sm">
              Query your data directly over HTTPS. Generate an access token to authenticate API requests.
              See the <Link to="/docs/api" className="text-primary hover:text-primary/80">API documentation</Link> for usage details.
            </p>
          </div>
        </div>

        {token ? (
          <div className="space-y-3">
            <div className="flex items-center gap-2">
              <div className="flex-1 min-w-0 cursor-pointer" onClick={copyToken} onKeyDown={(e) => e.key === 'Enter' && copyToken()} role="button" tabIndex={0} title="Click to copy">
                <pre className="bg-muted/40 border rounded-lg px-3 py-2 text-xs font-mono overflow-x-auto max-h-20 whitespace-pre-wrap break-all select-all hover:bg-muted/60 transition-colors">
                  {showToken ? token : '\u2022'.repeat(40)}
                </pre>
              </div>
              <Button
                variant="outline"
                size="icon"
                onClick={() => setShowToken(!showToken)}
                title={showToken ? 'Hide token' : 'Show token'}
              >
                {showToken ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
              </Button>
              <Button
                variant="outline"
                size="icon"
                onClick={copyToken}
                title="Copy token"
              >
                {copied ? <Check className="w-4 h-4 text-green-500" /> : <Copy className="w-4 h-4" />}
              </Button>
            </div>
            <div className="flex items-center justify-between">
              <p className="text-xs text-muted-foreground">
                This token expires in 1 hour. Generate a new one when it expires.
              </p>
              <Button variant="ghost" size="sm" onClick={generateToken} disabled={isGenerating}>
                <RefreshCw className={`w-3 h-3 ${isGenerating ? 'animate-spin' : ''}`} />
                Refresh
              </Button>
            </div>
          </div>
        ) : (
          <Button onClick={generateToken} disabled={isGenerating}>
            {isGenerating ? (
              <RefreshCw className="w-4 h-4 animate-spin" />
            ) : (
              <Code2 className="w-4 h-4" />
            )}
            Generate API Token
          </Button>
        )}
      </div>
    </div>
  )
}
