import { useEffect, useState } from 'react'
import { Info, AlertCircle, RefreshCw, RotateCcw, CheckCircle } from 'lucide-react'
import useSWR from 'swr'
import { api } from '@/lib/api'
import { LoadingState } from '@/components/LoadingState'

interface Jurisdiction {
  name: string
  rate: number
  ownerrezName?: string
  pattern?: string
  description?: string
}

interface JurisdictionStepProps {
  propertyId: string
  propertyName: string
  jurisdictions: Jurisdiction[]
  onUpdate: (jurisdictions: Jurisdiction[], ownerrezMappings?: any[]) => void
}

interface TaxDetectionData {
  jurisdictions: Array<{
    name: string
    rate: number
    ownerrezName: string
    pattern?: string
  }>
  summary?: {
    totalRate: number
    jurisdictionCount: number
    hasExistingConfig: boolean
    detectionConfidence: string
  }
  recommendations?: string[]
}

export const JurisdictionStep = ({ 
  propertyId,
  propertyName,
  jurisdictions, 
  onUpdate 
}: JurisdictionStepProps) => {
  const [mappedJurisdictions, setMappedJurisdictions] = useState<Jurisdiction[]>(jurisdictions)
  const [originalJurisdictions, setOriginalJurisdictions] = useState<Jurisdiction[]>([])
  const [hasChanges, setHasChanges] = useState(false)
  
  const fetcher = async (url: string) => {
    const result = await api.request(url)
    if (!result.success) throw new Error(result.error)
    const responseData = result.data as any
    if (responseData.status === 'success' && responseData.data) {
      return responseData.data as TaxDetectionData
    }
    return result.data as TaxDetectionData
  }

  const { data, error, isLoading, mutate } = useSWR<TaxDetectionData>(
    propertyId ? `/tax-auto-detect?propertyId=${propertyId}` : null,
    fetcher
  )
  
  useEffect(() => {
    if (data && data.jurisdictions && mappedJurisdictions.length === 0) {
      const autoMapped: Jurisdiction[] = data.jurisdictions.map((j: any) => ({
        name: j.name,
        rate: j.rate,
        ownerrezName: j.ownerrezName || j.name,
        pattern: j.pattern,
        description: j.description
      }))
      
      // Transform jurisdictions to ownerrezMappings format
      const mappings = data.jurisdictions.map((j: any, index: number) => ({
        pattern: j.pattern || j.ownerrezName || j.name,
        originalDescriptions: [j.ownerrezName || j.name],
        jurisdictionIndex: index,
        detectedRate: j.rate,
        occurrenceCount: j.occurrence_count || 1
      }))
      
      setMappedJurisdictions(autoMapped)
      setOriginalJurisdictions(autoMapped)
      onUpdate(autoMapped, mappings)
    }
  }, [data, mappedJurisdictions.length, onUpdate])
  
  const handleResetToDetected = () => {
    setMappedJurisdictions(originalJurisdictions)
    setHasChanges(false)
    
    // Transform to ownerrezMappings format
    const mappings = originalJurisdictions.map((j: any, index: number) => ({
      pattern: j.pattern || j.ownerrezName || j.name,
      originalDescriptions: [j.ownerrezName || j.name],
      jurisdictionIndex: index,
      detectedRate: j.rate,
      occurrenceCount: 1
    }))
    
    onUpdate(originalJurisdictions, mappings)
  }
  
  const handleRateChange = (index: number, rate: number) => {
    const updated = [...mappedJurisdictions]
    updated[index] = { ...updated[index], rate }
    setMappedJurisdictions(updated)
    
    // Transform to ownerrezMappings format
    const mappings = updated.map((j: any, idx: number) => ({
      pattern: j.pattern || j.ownerrezName || j.name,
      originalDescriptions: [j.ownerrezName || j.name],
      jurisdictionIndex: idx,
      detectedRate: j.rate,
      occurrenceCount: 1
    }))
    
    onUpdate(updated, mappings)
    
    const hasChanges = originalJurisdictions.some((orig, idx) => 
      orig.rate !== updated[idx]?.rate
    )
    setHasChanges(hasChanges)
  }
  
  const totalRate = mappedJurisdictions.reduce((sum, j) => sum + (typeof j.rate === 'number' ? j.rate : 0), 0)
  
  if (isLoading) {
    return <LoadingState message="Analyzing tax data from OwnerRez..." size="lg" />
  }
  
  if (error) {
    return (
      <div className="bg-red-50 border border-red-200 rounded-lg p-4">
        <div className="flex items-start">
          <AlertCircle className="w-5 h-5 text-red-600 mr-2 mt-0.5" />
          <div className="flex-1">
            <p className="text-sm font-medium text-red-900">Unable to detect tax jurisdictions</p>
            <p className="text-sm text-red-700 mt-1">{error.message}</p>
            <button
              onClick={() => mutate()}
              className="mt-3 text-sm text-red-600 hover:text-red-700 font-medium inline-flex items-center"
            >
              <RefreshCw className="w-4 h-4 mr-1" />
              Try again
            </button>
          </div>
        </div>
      </div>
    )
  }
  
  if (!data || !data.jurisdictions || data.jurisdictions.length === 0) {
    return (
      <div className="bg-yellow-50 border border-yellow-200 rounded-lg p-4">
        <div className="flex items-start">
          <AlertCircle className="w-5 h-5 text-yellow-600 mr-2 mt-0.5" />
          <div className="flex-1">
            <p className="text-sm font-medium text-yellow-900">No tax data found</p>
            <p className="text-sm text-yellow-700 mt-1">
              No tax charges were found in recent bookings for {propertyName}.
            </p>
            <ul className="mt-3 text-sm text-yellow-700 space-y-1">
              <li>• Ensure bookings have been synced from OwnerRez</li>
              <li>• Check that bookings include tax charges</li>
              <li>• Import more recent bookings (last 6 months)</li>
            </ul>
          </div>
        </div>
      </div>
    )
  }
  
  return (
    <div className="space-y-4">
      {data && data.summary && (
        <div className="bg-gradient-to-r from-blue-50 to-indigo-50 border border-blue-200 rounded-lg p-4">
          <div className="flex items-center justify-between">
            <div>
              <h3 className="text-sm font-semibold text-blue-900">Auto-Detection Results</h3>
              <p className="text-sm text-blue-700 mt-1">
                Found {data.summary.jurisdictionCount} tax jurisdiction{data.summary.jurisdictionCount !== 1 ? 's' : ''} • 
                Total rate: {data.summary.totalRate.toFixed(1)}% • 
                Confidence: <span className="font-medium capitalize">{data.summary.detectionConfidence}</span>
              </p>
            </div>
            {data.summary.detectionConfidence === 'high' && (
              <CheckCircle className="w-5 h-5 text-green-600" />
            )}
          </div>
        </div>
      )}
      
      {data && data.recommendations && data.recommendations.length > 0 && (
        <div className="bg-amber-50 border border-amber-200 rounded-lg p-3">
          <p className="text-xs font-medium text-amber-900 mb-2">Recommendations:</p>
          <ul className="space-y-1">
            {data.recommendations.map((rec: string, i: number) => (
              <li key={i} className="text-xs text-amber-800 flex items-start">
                <span className="mr-1">•</span>
                <span>{rec}</span>
              </li>
            ))}
          </ul>
        </div>
      )}
      
      <div className="space-y-3">
        {mappedJurisdictions.map((jurisdiction, index) => (
          <div key={index} className="bg-white border border-gray-200 rounded-lg p-4">
            <div className="flex items-start justify-between mb-3">
              <div className="flex-1">
                <div className="flex items-center gap-2">
                  <span className="text-sm font-medium text-gray-900">{jurisdiction.name}</span>
                </div>
                <p className="text-xs text-gray-500 mt-1">
                  Detected from: {jurisdiction.ownerrezName}
                </p>
              </div>
            </div>
            
            <div className="flex items-center gap-3">
              <div className="flex-1">
                <label className="block text-xs font-medium text-gray-700 mb-1">
                  Tax Rate (%)
                </label>
                <div className="flex items-center gap-2">
                  <input
                    type="number"
                    value={jurisdiction.rate}
                    onChange={(e) => handleRateChange(index, parseFloat(e.target.value) || 0)}
                    step="0.1"
                    min="0"
                    max="100"
                    className="w-24 px-3 py-1.5 border border-gray-300 rounded-md text-sm"
                  />
                  <span className="text-sm text-gray-500">%</span>
                </div>
              </div>
            </div>
          </div>
        ))}
      </div>
      
      <div className="bg-gray-50 rounded-lg p-4">
        <div className="flex justify-between items-center">
          <span className="text-sm font-medium text-gray-700">Total Tax Rate</span>
          <div className="flex items-center gap-3">
            <span className="text-lg font-bold text-gray-900">{totalRate.toFixed(2)}%</span>
            {hasChanges && originalJurisdictions.length > 0 && (
              <button
                onClick={handleResetToDetected}
                className="text-xs text-blue-600 hover:text-blue-700 font-medium inline-flex items-center"
                title="Reset to auto-detected values"
              >
                <RotateCcw className="w-3 h-3 mr-1" />
                Reset
              </button>
            )}
          </div>
        </div>
        {totalRate > 20 && (
          <p className="text-xs text-amber-600 mt-2">
            This rate seems high. Please verify all rates are correct.
          </p>
        )}
        {totalRate < 5 && totalRate > 0 && (
          <p className="text-xs text-amber-600 mt-2">
            This rate seems low. Ensure all applicable taxes are included.
          </p>
        )}
      </div>
      
      <div className="text-xs text-gray-500 text-center pt-2">
        <Info className="w-3 h-3 inline mr-1" />
        Tax jurisdictions are automatically detected from your OwnerRez booking data.
        Rates can be adjusted if needed.
      </div>
    </div>
  )
}