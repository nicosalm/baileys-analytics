import { useState } from 'react'
import { Plus, X, Percent, Calculator, Sparkles, Check } from 'lucide-react'

interface Jurisdiction {
  name: string
  type: 'state' | 'county' | 'city' | 'district' | 'other'
  rate: number
  description?: string
}

interface JurisdictionStepProps {
  jurisdictions: Jurisdiction[]
  propertyAddress?: string
  onUpdate: (jurisdictions: Jurisdiction[]) => void
}

// Location-based templates
const LOCATION_TEMPLATES: Record<string, Jurisdiction[]> = {
  'california': [
    { name: 'California State Tax', type: 'state', rate: 7.25, description: 'State sales tax' },
    { name: 'County Tax', type: 'county', rate: 1.0, description: 'County tax' },
    { name: 'Tourism Assessment', type: 'district', rate: 2.0, description: 'Tourism district' }
  ],
  'florida': [
    { name: 'Florida State Tax', type: 'state', rate: 6.0, description: 'State sales tax' },
    { name: 'County Tourist Tax', type: 'county', rate: 5.0, description: 'Tourist development tax' }
  ],
  'texas': [
    { name: 'Texas State Tax', type: 'state', rate: 6.0, description: 'State hotel occupancy tax' },
    { name: 'City Tax', type: 'city', rate: 7.0, description: 'City hotel tax' },
    { name: 'County Tax', type: 'county', rate: 2.0, description: 'County hotel tax' }
  ],
  'default': [
    { name: 'State Tax', type: 'state', rate: 5.0, description: 'State occupancy tax' },
    { name: 'Local Tax', type: 'city', rate: 3.0, description: 'Local occupancy tax' }
  ]
}

const QUICK_ADD_OPTIONS = [
  { name: 'State Sales Tax', type: 'state' as const, rate: 5.0 },
  { name: 'County Tax', type: 'county' as const, rate: 3.0 },
  { name: 'City Tax', type: 'city' as const, rate: 2.0 },
  { name: 'Tourism District', type: 'district' as const, rate: 1.0 }
]

export const JurisdictionStep = ({ 
  jurisdictions, 
  propertyAddress,
  onUpdate 
}: JurisdictionStepProps) => {
  const [showTemplates, setShowTemplates] = useState(jurisdictions.length === 0)
  
  // Try to detect state from address
  const detectState = (address?: string): string => {
    if (!address) return 'default'
    const lowerAddress = address.toLowerCase()
    if (lowerAddress.includes('california') || lowerAddress.includes(', ca')) return 'california'
    if (lowerAddress.includes('florida') || lowerAddress.includes(', fl')) return 'florida'
    if (lowerAddress.includes('texas') || lowerAddress.includes(', tx')) return 'texas'
    return 'default'
  }
  
  const handleAddJurisdiction = () => {
    onUpdate([...jurisdictions, {
      name: '',
      type: 'state',
      rate: 0,
      description: ''
    }])
  }
  
  const handleRemoveJurisdiction = (index: number) => {
    onUpdate(jurisdictions.filter((_, i) => i !== index))
  }
  
  const handleJurisdictionChange = (index: number, field: string, value: any) => {
    const updated = [...jurisdictions]
    updated[index] = { ...updated[index], [field]: value }
    onUpdate(updated)
  }
  
  const handleQuickAdd = (preset: typeof QUICK_ADD_OPTIONS[0]) => {
    const exists = jurisdictions.some(j => 
      j.name.toLowerCase() === preset.name.toLowerCase()
    )
    if (!exists) {
      onUpdate([...jurisdictions, { ...preset, description: '' }])
    }
  }
  
  const handleApplyTemplate = (template: Jurisdiction[]) => {
    onUpdate(template)
    setShowTemplates(false)
  }
  
  const totalRate = jurisdictions.reduce((sum, j) => sum + j.rate, 0)
  const detectedState = detectState(propertyAddress)
  const suggestedTemplate = LOCATION_TEMPLATES[detectedState]
  
  return (
    <div className="space-y-4">
      {/* Smart Suggestions */}
      {showTemplates && jurisdictions.length === 0 && (
        <div className="bg-gradient-to-r from-blue-50 to-purple-50 border border-blue-200 rounded-lg p-4">
          <div className="flex items-start">
            <Sparkles className="w-5 h-5 text-blue-600 mr-2 mt-0.5" />
            <div className="flex-1">
              <p className="text-sm font-medium text-blue-900 mb-2">
                {detectedState !== 'default' 
                  ? `We detected you're in ${detectedState.charAt(0).toUpperCase() + detectedState.slice(1)}. Use this template?`
                  : 'Start with a common tax template:'}
              </p>
              <div className="space-y-2">
                <button
                  onClick={() => handleApplyTemplate(suggestedTemplate)}
                  className="w-full text-left p-3 bg-white rounded-lg border border-blue-300 hover:border-blue-400 transition-colors"
                >
                  <div className="flex justify-between items-center">
                    <div>
                      <p className="font-medium text-gray-900">
                        {detectedState !== 'default' ? `${detectedState.charAt(0).toUpperCase() + detectedState.slice(1)} Template` : 'Standard Template'}
                      </p>
                      <p className="text-xs text-gray-600 mt-1">
                        {suggestedTemplate.map(j => `${j.name} (${j.rate}%)`).join(' + ')}
                      </p>
                    </div>
                    <div className="text-right">
                      <p className="text-lg font-bold text-blue-600">
                        {suggestedTemplate.reduce((sum, j) => sum + j.rate, 0).toFixed(1)}%
                      </p>
                      <p className="text-xs text-gray-500">Total</p>
                    </div>
                  </div>
                </button>
                
                <button
                  onClick={() => setShowTemplates(false)}
                  className="w-full text-center text-sm text-gray-600 hover:text-gray-900 py-2"
                >
                  Configure manually instead →
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
      
      {/* Manual Configuration */}
      {(!showTemplates || jurisdictions.length > 0) && (
        <>
          <div className="flex justify-between items-center">
            <h3 className="text-sm font-medium text-gray-700">Tax Jurisdictions</h3>
            <button
              type="button"
              onClick={handleAddJurisdiction}
              className="text-sm text-blue-600 hover:text-blue-700 font-medium flex items-center"
            >
              <Plus className="w-4 h-4 mr-1" />
              Add Jurisdiction
            </button>
          </div>
          
          {/* Quick Add Buttons */}
          {jurisdictions.length > 0 && (
            <div className="p-3 bg-gray-50 rounded-lg">
              <p className="text-xs text-gray-600 mb-2">Quick add:</p>
              <div className="flex flex-wrap gap-2">
                {QUICK_ADD_OPTIONS.map(preset => {
                  const isAdded = jurisdictions.some(j => 
                    j.name.toLowerCase() === preset.name.toLowerCase()
                  )
                  return (
                    <button
                      key={preset.name}
                      type="button"
                      onClick={() => handleQuickAdd(preset)}
                      disabled={isAdded}
                      className={`px-3 py-1 rounded-full text-xs transition-colors ${
                        isAdded 
                          ? 'bg-green-100 border border-green-300 text-green-700 cursor-not-allowed' 
                          : 'bg-white border border-gray-300 hover:bg-gray-100'
                      }`}
                    >
                      {isAdded && <Check className="w-3 h-3 inline mr-1" />}
                      {preset.name} ({preset.rate}%)
                    </button>
                  )
                })}
              </div>
            </div>
          )}
          
          {/* Jurisdiction List */}
          {jurisdictions.length === 0 ? (
            <div className="text-center py-12 bg-gray-50 rounded-lg border-2 border-dashed border-gray-300">
              <Calculator className="w-8 h-8 text-gray-400 mx-auto mb-2" />
              <p className="text-sm text-gray-600">No tax jurisdictions added yet</p>
              <button
                onClick={() => setShowTemplates(true)}
                className="mt-2 text-sm text-blue-600 hover:text-blue-700 font-medium"
              >
                Use a template
              </button>
            </div>
          ) : (
            <div className="space-y-3">
              {jurisdictions.map((jurisdiction, index) => (
                <div key={index} className="p-3 bg-white border border-gray-200 rounded-lg">
                  <div className="grid grid-cols-12 gap-2">
                    <div className="col-span-4">
                      <label className="text-xs text-gray-500">Name</label>
                      <input
                        type="text"
                        value={jurisdiction.name}
                        onChange={(e) => handleJurisdictionChange(index, 'name', e.target.value)}
                        placeholder="e.g., State Tax"
                        className="w-full px-2 py-1 border border-gray-300 rounded-sm text-sm"
                        required
                      />
                    </div>
                    <div className="col-span-3">
                      <label className="text-xs text-gray-500">Type</label>
                      <select
                        value={jurisdiction.type}
                        onChange={(e) => handleJurisdictionChange(index, 'type', e.target.value)}
                        className="w-full px-2 py-1 border border-gray-300 rounded-sm text-sm"
                      >
                        <option value="state">State</option>
                        <option value="county">County</option>
                        <option value="city">City</option>
                        <option value="district">District</option>
                        <option value="other">Other</option>
                      </select>
                    </div>
                    <div className="col-span-2">
                      <label className="text-xs text-gray-500">Rate</label>
                      <div className="relative">
                        <input
                          type="number"
                          value={jurisdiction.rate}
                          onChange={(e) => handleJurisdictionChange(index, 'rate', parseFloat(e.target.value) || 0)}
                          placeholder="0.0"
                          step="0.01"
                          min="0"
                          max="100"
                          className="w-full px-2 py-1 pr-6 border border-gray-300 rounded-sm text-sm"
                          required
                        />
                        <Percent className="absolute right-2 top-1.5 w-3 h-3 text-gray-400" />
                      </div>
                    </div>
                    <div className="col-span-2">
                      <label className="text-xs text-gray-500">Note</label>
                      <input
                        type="text"
                        value={jurisdiction.description || ''}
                        onChange={(e) => handleJurisdictionChange(index, 'description', e.target.value)}
                        placeholder="Optional"
                        className="w-full px-2 py-1 border border-gray-300 rounded-sm text-sm"
                      />
                    </div>
                    <div className="col-span-1 flex items-end">
                      <button
                        type="button"
                        onClick={() => handleRemoveJurisdiction(index)}
                        className="p-1 text-red-600 hover:bg-red-50 rounded"
                      >
                        <X className="w-4 h-4" />
                      </button>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          )}
          
          {/* Total Rate Display */}
          {jurisdictions.length > 0 && (
            <div className="p-3 bg-green-50 border border-green-200 rounded-lg">
              <div className="flex justify-between items-center">
                <div className="flex items-center">
                  <Calculator className="w-4 h-4 text-green-600 mr-2" />
                  <span className="text-sm text-green-800">Combined Tax Rate:</span>
                </div>
                <span className="text-lg font-bold text-green-900">{totalRate.toFixed(2)}%</span>
              </div>
            </div>
          )}
        </>
      )}
    </div>
  )
}