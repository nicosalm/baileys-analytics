import { Globe, Calendar, DollarSign, Info } from 'lucide-react'

interface PlatformSettingsStepProps {
  platformSettings: {
    airbnb?: { remitsTax: boolean; remittedRate?: number }
    vrbo?: { remitsTax: boolean; remittedRate?: number }
  }
  taxableItems: string[]
  effectiveFrom: string
  onUpdate: (updates: any) => void
}

const PLATFORMS = [
  {
    id: 'airbnb',
    name: 'Airbnb',
    description: 'Airbnb typically remits taxes on their service fees in many jurisdictions',
    defaultRemits: true,
    color: 'red'
  },
  {
    id: 'vrbo',
    name: 'VRBO',
    description: 'VRBO tax remittance varies by location - check your local requirements',
    defaultRemits: false,
    color: 'blue'
  }
]

const TAXABLE_ITEMS = [
  { 
    value: 'base_rent', 
    label: 'Base Rental Amount',
    description: 'The nightly rate charged to guests',
    defaultChecked: true
  },
  { 
    value: 'cleaning_fee', 
    label: 'Cleaning Fees',
    description: 'One-time or per-stay cleaning charges',
    defaultChecked: true
  },
  { 
    value: 'platform_fee', 
    label: 'Platform Service Fees',
    description: 'Fees charged by Airbnb, VRBO, etc.',
    defaultChecked: true
  },
  { 
    value: 'other_fees', 
    label: 'Other Fees & Charges',
    description: 'Pet fees, extra guest fees, etc.',
    defaultChecked: true
  }
]

export const PlatformSettingsStep = ({ 
  platformSettings, 
  taxableItems,
  effectiveFrom,
  onUpdate 
}: PlatformSettingsStepProps) => {
  
  const handlePlatformChange = (platform: string, remitsTax: boolean) => {
    onUpdate({
      platformSettings: {
        ...platformSettings,
        [platform]: { ...platformSettings[platform as keyof typeof platformSettings], remitsTax }
      }
    })
  }
  
  const handleTaxableItemToggle = (item: string) => {
    const updated = taxableItems.includes(item)
      ? taxableItems.filter(i => i !== item)
      : [...taxableItems, item]
    onUpdate({ taxableItems: updated })
  }
  
  return (
    <div className="space-y-6">
      {/* Info Banner */}
      <div className="bg-blue-50 border border-blue-200 rounded-lg p-4">
        <div className="flex items-start">
          <Info className="w-5 h-5 text-blue-600 mr-2 mt-0.5" />
          <div className="text-sm text-blue-800">
            <strong>Platform Settings:</strong> Configure which items are taxable and whether platforms remit taxes directly. 
            This affects how much tax you need to collect and remit yourself.
          </div>
        </div>
      </div>
      
      {/* Platform Tax Remittance */}
      <div>
        <h3 className="text-sm font-medium text-gray-700 mb-3 flex items-center">
          <Globe className="w-4 h-4 mr-2" />
          Platform Tax Remittance
        </h3>
        <div className="space-y-3">
          {PLATFORMS.map(platform => {
            const settings = platformSettings[platform.id as keyof typeof platformSettings]
            const remitsTax = settings?.remitsTax ?? platform.defaultRemits
            
            return (
              <div 
                key={platform.id}
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
                    onChange={(e) => handlePlatformChange(platform.id, e.target.checked)}
                    className="mt-1 mr-3"
                  />
                  <div className="flex-1">
                    <p className="font-medium text-gray-900">
                      {platform.name}
                      {remitsTax && (
                        <span className="ml-2 px-2 py-0.5 bg-green-100 text-green-700 text-xs rounded-full">
                          Remits taxes
                        </span>
                      )}
                    </p>
                    <p className="text-sm text-gray-600 mt-1">
                      {platform.description}
                    </p>
                  </div>
                </label>
              </div>
            )
          })}
        </div>
        <p className="text-xs text-gray-500 mt-2">
          ✓ Check this if the platform collects and pays taxes on their fees directly to the government
        </p>
      </div>
      
      {/* Taxable Items */}
      <div>
        <h3 className="text-sm font-medium text-gray-700 mb-3 flex items-center">
          <DollarSign className="w-4 h-4 mr-2" />
          What's Taxable?
        </h3>
        <div className="space-y-2">
          {TAXABLE_ITEMS.map(item => {
            const isChecked = taxableItems.includes(item.value)
            
            return (
              <label 
                key={item.value}
                className={`flex items-start p-3 rounded-lg border cursor-pointer transition-all ${
                  isChecked 
                    ? 'bg-blue-50 border-blue-300' 
                    : 'bg-white border-gray-200 hover:bg-gray-50'
                }`}
              >
                <input
                  type="checkbox"
                  checked={isChecked}
                  onChange={() => handleTaxableItemToggle(item.value)}
                  className="mt-1 mr-3"
                />
                <div className="flex-1">
                  <p className={`font-medium ${isChecked ? 'text-blue-900' : 'text-gray-900'}`}>
                    {item.label}
                  </p>
                  <p className="text-sm text-gray-600 mt-0.5">
                    {item.description}
                  </p>
                </div>
              </label>
            )
          })}
        </div>
      </div>
      
      {/* Effective Date */}
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