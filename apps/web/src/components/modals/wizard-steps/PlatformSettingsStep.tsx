import { Calendar, Info, Building2 } from 'lucide-react'
import useSWR from 'swr'
import { api } from '@/lib/api'
import { LoadingState } from '@/components/LoadingState'

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
  const { data: platformsResponse, isLoading } = useSWR(
    propertyId ? `/property-platforms?propertyId=${propertyId}` : null,
    async (url: string) => {
      const result = await api.request(url)
      if (!result.success) throw new Error(result.error)
      return result.data as { data: string[] }
    }
  )

  const platforms = (platformsResponse?.data || []) as string[]
  
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
      <div className="bg-blue-50 border border-blue-200 rounded-lg p-4">
        <div className="flex items-start">
          <Info className="w-5 h-5 text-blue-600 mr-2 mt-0.5" />
          <div className="text-sm text-blue-800">
            <strong>Platform Tax Remittance:</strong> Indicate which booking platforms collect and remit taxes directly to the government. 
            This helps calculate your actual tax liability by excluding taxes already paid by platforms.
          </div>
        </div>
      </div>
      
      <div>
        <h3 className="text-sm font-medium text-gray-700 mb-3 flex items-center">
          <Building2 className="w-4 h-4 mr-2" />
          Which platforms remit taxes on their fees?
        </h3>
        {isLoading ? (
          <LoadingState message="Loading platforms..." size="sm" />
        ) : platforms.length === 0 ? (
          <div className="text-sm text-gray-500">No booking platforms found for this property</div>
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
                    <p className="text-sm text-gray-600 mt-1">
                      Check with {platform} about their tax remittance policy in your jurisdiction
                    </p>
                  </div>
                </label>
              </div>
            )
          })}
          </div>
        )}
        <div className="mt-4 p-3 bg-amber-50 border border-amber-200 rounded-lg">
          <p className="text-xs text-amber-800">
            <strong>Important:</strong> Platform tax remittance varies by jurisdiction. Verify with each platform 
            and your local tax authority. Platforms typically only remit taxes on their service fees, not on the base rental amount.
          </p>
        </div>
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