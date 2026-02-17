import { useState, useMemo } from 'react'
import { ChevronDown, ChevronRight, Calculator, TrendingUp, ArrowRight } from 'lucide-react'
import { formatCurrency, formatPercentage, safeDivide } from '@baileys/utils'
import { OccupancyByProperty } from '@/types/api'

interface WhatIfCalculatorProps {
  byProperty: OccupancyByProperty[]
}

export const WhatIfCalculator = ({ byProperty }: WhatIfCalculatorProps) => {
  const [expanded, setExpanded] = useState(false)
  const [selectedPropertyId, setSelectedPropertyId] = useState<string>('__portfolio__')
  const [rateInput, setRateInput] = useState('')

  const scope = useMemo(() => {
    const properties = selectedPropertyId === '__portfolio__'
      ? byProperty
      : byProperty.filter(p => p.propertyId === selectedPropertyId)

    const availableNights = properties.reduce((sum, p) => sum + p.availableNights, 0)
    const bookedNights = properties.reduce((sum, p) => sum + p.bookedNights, 0)
    const openNights = availableNights - bookedNights
    const estimatedRevenue = properties.reduce((sum, p) => sum + p.bookedNights * p.avgNightlyRate, 0)
    const currentRevPAN = safeDivide(estimatedRevenue, availableNights)
    const currentOccupancy = safeDivide(bookedNights, availableNights)
    const weightedAvgRate = safeDivide(estimatedRevenue, bookedNights)

    return { availableNights, bookedNights, openNights, estimatedRevenue, currentRevPAN, currentOccupancy, weightedAvgRate }
  }, [byProperty, selectedPropertyId])

  const inputRate = rateInput === '' ? 0 : parseFloat(rateInput) || 0
  const additionalRevenue = scope.openNights * inputRate
  const newTotalRevenue = scope.estimatedRevenue + additionalRevenue
  const projectedRevPAN = safeDivide(newTotalRevenue, scope.availableNights)
  const revPANChangePct = safeDivide(projectedRevPAN - scope.currentRevPAN, scope.currentRevPAN) * 100

  const handlePropertyChange = (propertyId: string) => {
    setSelectedPropertyId(propertyId)
    setRateInput('')
  }

  const handleRateChange = (value: string) => {
    if (value !== '' && !/^\d*\.?\d*$/.test(value)) return
    setRateInput(value)
  }

  if (byProperty.length === 0) return null

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
          <span className="text-sm text-gray-500">RevPAN scenario calculator</span>
        </div>
      </button>

      {expanded && (
        <div className="px-6 pb-6 pt-2 border-t border-gray-100">
          <div className="grid md:grid-cols-2 gap-6">
            {/* Left column — inputs */}
            <div className="space-y-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Scope</label>
                <select
                  value={selectedPropertyId}
                  onChange={e => handlePropertyChange(e.target.value)}
                  className="w-full py-2 px-3 border border-gray-300 rounded-lg text-sm focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                >
                  <option value="__portfolio__">All Properties (Portfolio)</option>
                  {byProperty.map(p => (
                    <option key={p.propertyId} value={p.propertyId}>
                      {p.propertyName}
                    </option>
                  ))}
                </select>
              </div>

              <div className="flex gap-4 text-sm">
                <div>
                  <span className="text-gray-500">Open nights</span>
                  <p className="font-semibold">{scope.openNights}</p>
                </div>
                <div>
                  <span className="text-gray-500">Current occupancy</span>
                  <p className="font-semibold">{formatPercentage(scope.currentOccupancy * 100)}</p>
                </div>
                <div>
                  <span className="text-gray-500">Current RevPAN</span>
                  <p className="font-semibold">{formatCurrency(scope.currentRevPAN)}</p>
                </div>
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  If open nights booked at
                </label>
                <div className="relative w-48">
                  <span className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400 text-sm">$</span>
                  <input
                    type="text"
                    inputMode="decimal"
                    value={rateInput}
                    onChange={e => handleRateChange(e.target.value)}
                    placeholder={scope.weightedAvgRate > 0 ? scope.weightedAvgRate.toFixed(0) : '0'}
                    className="w-full py-2 pl-7 pr-14 border border-gray-300 rounded-lg text-sm focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                  />
                  <span className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400 text-sm">/night</span>
                </div>
              </div>
            </div>

            {/* Right column — results */}
            <div className="bg-gray-50 rounded-lg p-4 space-y-3">
              <h4 className="text-sm font-semibold text-gray-700 flex items-center gap-1.5">
                <TrendingUp className="w-4 h-4" />
                RevPAN Impact
              </h4>

              <div className="flex items-center gap-2">
                <span className="text-lg font-bold text-gray-900">{formatCurrency(scope.currentRevPAN)}</span>
                <ArrowRight className="w-4 h-4 text-gray-400" />
                <span className="text-lg font-bold text-gray-900">{formatCurrency(projectedRevPAN)}</span>
                {inputRate > 0 && (
                  <span className={`text-xs font-semibold px-1.5 py-0.5 rounded ${
                    revPANChangePct >= 0 ? 'bg-green-100 text-green-700' : 'bg-red-100 text-red-700'
                  }`}>
                    {revPANChangePct >= 0 ? '+' : ''}{formatPercentage(revPANChangePct)}
                  </span>
                )}
              </div>

              <div className="flex justify-between items-center">
                <span className="text-sm text-gray-600">Additional revenue</span>
                <span className="text-sm font-semibold text-gray-900">{formatCurrency(additionalRevenue)}</span>
              </div>

              <div className="border-t border-gray-200 pt-2 flex justify-between items-center">
                <span className="text-sm font-medium text-gray-700">New total revenue</span>
                <span className="text-lg font-bold text-gray-900">{formatCurrency(newTotalRevenue)}</span>
              </div>

              <p className="text-xs text-gray-400 pt-1">
                {scope.openNights} open night{scope.openNights !== 1 ? 's' : ''} × {formatCurrency(inputRate)}/night
                {selectedPropertyId === '__portfolio__' ? ' across all properties' : ''}
              </p>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
