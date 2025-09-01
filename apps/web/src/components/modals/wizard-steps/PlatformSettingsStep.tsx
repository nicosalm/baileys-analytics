import { Calendar, Info, Building2, AlertCircle } from 'lucide-react'
import useSWR from 'swr'
import { api } from '@/lib/api'
import { LoadingState } from '@/components/LoadingState'
import { useTips } from '@/hooks/use-tips'

interface PlatformSettingsStepProps {
  propertyId: string
  platformSettings: Record<string, { remitsTax: boolean; remittedRate?: number }>
  effectiveFrom: string
  onUpdate: (updates: any) => void
}

export const PlatformSettingsStep = ({ 
  propertyId,
  platformSettings, 
  effectiveFrom,
  onUpdate 
}: PlatformSettingsStepProps) => {
  const { showTips } = useTips()
  
  const { data: platformsResponse, isLoading, error } = useSWR(
    propertyId ? `/tax/platforms?propertyId=${propertyId}` : null,
    async () => {
      const result = await api.getPropertyPlatforms(propertyId)
      if (!result.success) throw new Error(result.error)
      return result.data?.data || result.data || []
    }
  )
  
  const platforms = platformsResponse || []
  
  const handlePlatformChange = (platform: string, remitsTax: boolean) => {
    const platformKey = platform.toLowerCase().replace(/[^a-z0-9]/g, '')
    onUpdate({
      platformSettings: {
        ...platformSettings,
        [platformKey]: { remitsTax }
      }
    })
  }
  
  return (
    <div className="space-y-6">
      
      <div>
        <h3 className="text-sm font-medium text-gray-700 mb-3 flex items-center">
          <Building2 className="w-4 h-4 mr-2" />
          Platform Tax Remittance Settings
        </h3>
        <p className="text-xs text-gray-600 mb-3">
          Configure which platforms automatically remit taxes on their service fees for this property.
        </p>
        {isLoading ? (
          <LoadingState message="Loading platforms..." size="sm" />
        ) : platforms.length === 0 ? (
          <div className="bg-amber-50 border border-amber-200 rounded-lg p-3">
            <div className="flex items-start">
              <AlertCircle className="w-4 h-4 text-amber-600 mr-2 mt-0.5" />
              <div className="text-sm text-amber-800">
                <strong>No platforms found</strong>
                <p className="text-xs mt-1">Import bookings for this property first</p>
              </div>
            </div>
          </div>
        ) : (
          <div className="space-y-3">
            {platforms.map((platform: string) => {
            const platformKey = platform.toLowerCase().replace(/[^a-z0-9]/g, '')
            const settings = platformSettings[platformKey]
            const remitsTax = settings?.remitsTax ?? false
            
            return (
              <div 
                key={platformKey}
                className={`p-4 rounded-lg border-2 transition-all ${
                  remitsTax 
                    ? 'bg-green-50 border-green-200' 
                    : 'bg-gray-50 border-gray-200'
                }`}
              >
                <label className="flex items-start cursor-pointer">
                  <input
                    type="checkbox"
                    checked={remitsTax}
                    onChange={(e) => handlePlatformChange(platform, e.target.checked)}
                    className="mt-1 mr-3"
                  />
                  <div className="flex-1">
                    <p className="font-medium text-gray-900">
                      {platform}
                      {remitsTax && (
                        <span className="ml-2 px-2 py-0.5 bg-green-100 text-green-700 text-xs rounded-full">
                          Remits taxes
                        </span>
                      )}
                    </p>
                  </div>
                </label>
              </div>
            )
          })}
          </div>
        )}
      </div>
      
      <div>
        <label className="block text-sm font-medium text-gray-700 mb-2 flex items-center">
          <Calendar className="w-4 h-4 mr-2" />
          Effective Date
        </label>
        <input
          type="date"
          value={effectiveFrom}
          onChange={(e) => onUpdate({ effectiveFrom: e.target.value })}
          className="w-full px-3 py-2 border border-gray-300 rounded-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
          required
        />
        <p className="text-xs text-gray-500 mt-1">
          This configuration will apply to bookings starting from this date
        </p>
      </div>
    </div>
  )
}