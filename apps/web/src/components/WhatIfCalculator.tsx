import { useState, useMemo } from 'react'
import { ChevronDown, ChevronRight, Calculator } from 'lucide-react'
import { formatCurrency } from '@baileys/utils'
import { OccupancyByProperty } from '@/types/api'

interface WhatIfCalculatorProps {
  byProperty: OccupancyByProperty[]
}

export const WhatIfCalculator = ({ byProperty }: WhatIfCalculatorProps) => {
  const [expanded, setExpanded] = useState(false)
  const [selectedPropertyId, setSelectedPropertyId] = useState<string>('')
  const [rateInput, setRateInput] = useState('')


  const propertiesWithRate = useMemo(
    () => byProperty.filter(p => p.avgNightlyRate > 0),
    [byProperty]
  )

  const selectedProperty = useMemo(() => {
    const id = selectedPropertyId || propertiesWithRate[0]?.propertyId
    return propertiesWithRate.find(p => p.propertyId === id) || propertiesWithRate[0]
  }, [selectedPropertyId, propertiesWithRate])

  const currentRate = selectedProperty?.avgNightlyRate || 0
  const unbookedNights = selectedProperty
    ? selectedProperty.availableNights - selectedProperty.bookedNights
    : 0

  const inputRate = rateInput === '' ? currentRate : parseFloat(rateInput) || 0
  const projectedRevenue = unbookedNights * inputRate
  const currentRateRevenue = unbookedNights * currentRate
  const difference = projectedRevenue - currentRateRevenue

  const handlePropertyChange = (propertyId: string) => {
    setSelectedPropertyId(propertyId)
    setRateInput('')
  }

  const handleRateChange = (value: string) => {
    if (value !== '' && !/^\d*\.?\d*$/.test(value)) return
    setRateInput(value)
  }

  if (propertiesWithRate.length === 0) return null

  return (
    <div className="bg-white rounded-lg shadow-sm border border-gray-200">
      <button
        onClick={() => setExpanded(prev => !prev)}
        className="w-full flex items-center justify-between px-6 py-4 hover:bg-gray-50 transition-colors cursor-pointer"
      >
        <div className="flex items-center gap-2">
          {expanded
            ? <ChevronDown className="w-4 h-4 text-gray-500" />
            : <ChevronRight className="w-4 h-4 text-gray-500" />
          }
          <Calculator className="w-5 h-5 text-gray-600" />
          <span className="font-bold text-gray-900">What If?</span>
          <span className="text-sm text-gray-500">Revenue scenario calculator</span>
        </div>
      </button>

      {expanded && (
        <div className="px-6 pb-6 pt-2 border-t border-gray-100">
          <div className="grid md:grid-cols-2 gap-6">
            <div className="space-y-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Property</label>
                <select
                  value={selectedProperty?.propertyId || ''}
                  onChange={e => handlePropertyChange(e.target.value)}
                  className="w-full py-2 px-3 border border-gray-300 rounded-lg text-sm focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                >
                  {propertiesWithRate.map(p => (
                    <option key={p.propertyId} value={p.propertyId}>
                      {p.propertyName}
                    </option>
                  ))}
                </select>
              </div>

              <div className="flex gap-4 text-sm">
                <div>
                  <span className="text-gray-500">Current avg rate</span>
                  <p className="font-semibold">{formatCurrency(currentRate)}/night</p>
                </div>
                <div>
                  <span className="text-gray-500">Unbooked nights</span>
                  <p className="font-semibold">{unbookedNights} remaining</p>
                </div>
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  What if you charged
                </label>
                <div className="relative w-48">
                  <span className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400 text-sm">$</span>
                  <input
                    type="text"
                    inputMode="decimal"
                    value={rateInput}
                    onChange={e => handleRateChange(e.target.value)}
                    placeholder={currentRate.toFixed(0)}
                    className="w-full py-2 pl-7 pr-14 border border-gray-300 rounded-lg text-sm focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                  />
                  <span className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400 text-sm">/night</span>
                </div>
              </div>
            </div>

            <div className="bg-gray-50 rounded-lg p-4 space-y-3">
              <h4 className="text-sm font-semibold text-gray-700">Projected Scenario</h4>

              <div className="flex justify-between items-center">
                <span className="text-sm text-gray-600">Additional revenue</span>
                <span className="text-lg font-bold text-gray-900">{formatCurrency(projectedRevenue)}</span>
              </div>

              <div className="flex justify-between items-center">
                <span className="text-sm text-gray-600">At current rate</span>
                <span className="text-sm text-gray-500">{formatCurrency(currentRateRevenue)}</span>
              </div>

              <div className="border-t border-gray-200 pt-2 flex justify-between items-center">
                <span className="text-sm font-medium text-gray-700">Difference</span>
                <span className={`text-sm font-bold ${
                  difference > 0 ? 'text-green-600' : difference < 0 ? 'text-red-600' : 'text-gray-500'
                }`}>
                  {difference >= 0 ? '+' : ''}{formatCurrency(difference)}
                </span>
              </div>

              <p className="text-xs text-gray-400 pt-1">
                Based on {unbookedNights} unbooked night{unbookedNights !== 1 ? 's' : ''} in selected period
              </p>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
