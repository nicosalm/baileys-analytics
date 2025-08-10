import { useState, useEffect } from 'react'
import { DollarSign, Hash, Save, AlertCircle } from 'lucide-react'
import { useVIPSettings, updateVIPSettings } from '@/hooks/use-api'
import { Spinner } from '@/components/Spinner'
import { useToast } from '@/contexts/toast'
import { formatCurrency } from '@baileys/utils'

export const VIPConfiguration = () => {
  const { addToast } = useToast()
  const { data: originalSettings, isLoading: loading, error } = useVIPSettings()
  const [saving, setSaving] = useState(false)
  const [settings, setSettings] = useState({
    vipSpendThreshold: 5000,
    vipBookingThreshold: 5
  })
  const [hasChanges, setHasChanges] = useState(false)

  useEffect(() => {
    if (originalSettings) {
      setSettings(originalSettings)
    }
  }, [originalSettings])

  useEffect(() => {
    if (originalSettings) {
      const changed =
        settings.vipSpendThreshold !== originalSettings.vipSpendThreshold ||
        settings.vipBookingThreshold !== originalSettings.vipBookingThreshold
      setHasChanges(changed)
    }
  }, [settings, originalSettings])

  useEffect(() => {
    if (error) {
      addToast('error', 'Failed to load VIP settings')
    }
  }, [error, addToast])

  const handleSave = async () => {
    // Validate
    if (settings.vipSpendThreshold < 0) {
      addToast('error', 'Spend threshold must be positive')
      return
    }

    if (settings.vipBookingThreshold < 1 || !Number.isInteger(settings.vipBookingThreshold)) {
      addToast('error', 'Booking threshold must be a positive integer')
      return
    }

    setSaving(true)
    const result = await updateVIPSettings(settings)

    if (result.success) {
      addToast('success', 'VIP settings updated successfully')
    } else {
      addToast('error', 'Failed to update VIP settings')
    }
    setSaving(false)
  }

  const handleReset = () => {
    if (originalSettings) {
      setSettings(originalSettings)
    }
  }

  if (loading) {
    return (
      <div className="p-4 border rounded">
        <div className="flex justify-center py-8">
          <Spinner size="lg" />
        </div>
      </div>
    )
  }

  return (
    <div className="p-4 border rounded">
      <div className="flex justify-between items-center mb-6">
        <h2 className="text-xl font-bold">VIP Guest Configuration</h2>
        {hasChanges && (
          <span className="text-sm text-orange-600 flex items-center">
            <AlertCircle className="w-4 h-4 mr-1" />
            Unsaved changes
          </span>
        )}
      </div>

      <div className="space-y-6">
        <div className="bg-blue-50 p-4 rounded-lg">
          <p className="text-sm text-blue-800">
            Configure the thresholds that determine which guests are classified as VIP.
            Guests meeting either threshold will be marked as VIP.
          </p>
        </div>

        <div className="grid md:grid-cols-2 gap-6">
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">
              <div className="flex items-center">
                <DollarSign className="w-4 h-4 mr-2" />
                Minimum Total Spend
              </div>
            </label>
            <div className="relative">
              <span className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-500">$</span>
              <input
                type="number"
                min="0"
                step="100"
                value={settings.vipSpendThreshold}
                onChange={(e) => setSettings({
                  ...settings,
                  vipSpendThreshold: parseFloat(e.target.value) || 0
                })}
                className="w-full pl-8 pr-3 py-2 border rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
                placeholder="5000"
              />
            </div>
            <p className="mt-1 text-xs text-gray-500">
              Guests who have spent at least this amount
            </p>
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">
              <div className="flex items-center">
                <Hash className="w-4 h-4 mr-2" />
                Minimum Booking Count
              </div>
            </label>
            <input
              type="number"
              min="1"
              step="1"
              value={settings.vipBookingThreshold}
              onChange={(e) => setSettings({
                ...settings,
                vipBookingThreshold: parseInt(e.target.value) || 1
              })}
              className="w-full px-3 py-2 border rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
              placeholder="5"
            />
            <p className="mt-1 text-xs text-gray-500">
              Guests who have made at least this many bookings
            </p>
          </div>
        </div>

        <div className="bg-gray-50 p-4 rounded-lg">
          <h3 className="text-sm font-medium text-gray-700 mb-3">Current VIP Criteria</h3>
          <div className="space-y-2 text-sm">
            <div className="flex items-center">
              <div className="w-2 h-2 bg-green-500 rounded-full mr-2"></div>
              <span>
                Guests who have spent {formatCurrency(settings.vipSpendThreshold)} or more
              </span>
            </div>
            <div className="flex items-center">
              <div className="w-2 h-2 bg-green-500 rounded-full mr-2"></div>
              <span>
                Guests who have made {settings.vipBookingThreshold} or more bookings
              </span>
            </div>
            <div className="text-xs text-gray-500 mt-2 pl-4">
              Note: Meeting either criterion qualifies a guest as VIP
            </div>
          </div>
        </div>

        <div className="flex justify-end space-x-3 pt-4 border-t">
          <button
            onClick={handleReset}
            disabled={!hasChanges || saving}
            className="px-4 py-2 text-gray-700 bg-gray-100 rounded-lg hover:bg-gray-200 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
          >
            Reset
          </button>
          <button
            onClick={handleSave}
            disabled={!hasChanges || saving}
            className="flex items-center px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
          >
            {saving ? (
              <Spinner size="sm" />
            ) : (
              <Save className="w-4 h-4 mr-2" />
            )}
            Save Changes
          </button>
        </div>
      </div>
    </div>
  )
}
