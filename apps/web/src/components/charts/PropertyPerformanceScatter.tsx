import React, { useMemo } from 'react'
import { ScatterChart, Scatter, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, Cell, ReferenceLine } from 'recharts'
import { formatCurrency, formatPercentage } from '@/utils/formatters'
import { PropertyMetrics } from '@/types/api'
import { METRIC_COLORS } from '@/lib/theme'

interface PropertyPerformanceScatterProps {
  properties: PropertyMetrics[]
  onPropertyClick?: (property: PropertyMetrics) => void
}

export const PropertyPerformanceScatter: React.FC<PropertyPerformanceScatterProps> = ({
  properties,
  onPropertyClick
}) => {
  const scatterData = useMemo(() => {
    if (!properties || properties.length === 0) return { data: [], avgOccupancy: 0, avgRevenue: 0 }
    
    const validProperties = properties
    
    let zeroOffsetIndex = 0
    const data = validProperties.map(property => {
      let x = (property.occupancyRate || 0) * 100
      let y = property.revenue || 0
      
      if (x === 0 && y === 0) {
        x = 2 + (zeroOffsetIndex % 3) * 2
        y = 500 + (Math.floor(zeroOffsetIndex / 3) * 500)
        zeroOffsetIndex++
      }
      
      return {
        x,
        y,
        z: Math.max(property.bookings || 0, 10),
        name: property.propertyName,
        propertyId: property.propertyId,
        avgNightlyRate: property.avgNightlyRate || 0,
        isZeroData: property.revenue === 0 && property.occupancyRate === 0,
        property
      }
    })
    
    const avgOccupancy = data.reduce((sum, d) => sum + d.x, 0) / data.length
    const avgRevenue = data.reduce((sum, d) => sum + d.y, 0) / data.length
    
    return { data, avgOccupancy, avgRevenue }
  }, [properties])
  
  const getPointColor = (point: any) => {
    const { avgOccupancy, avgRevenue } = scatterData
    
    if (point.isZeroData) {
      return '#9CA3AF'
    }
    
    if (point.x >= avgOccupancy && point.y >= avgRevenue) {
      return '#10B981'
    } else if (point.x >= avgOccupancy && point.y < avgRevenue) {
      return '#F59E0B'
    } else if (point.x < avgOccupancy && point.y >= avgRevenue) {
      return '#3B82F6'
    } else {
      return '#EF4444'
    }
  }
  
  const CustomTooltip = ({ active, payload }: any) => {
    if (active && payload && payload.length) {
      const data = payload[0].payload
      return (
        <div className="bg-white p-3 rounded-lg shadow-lg border border-gray-200">
          <p className="font-semibold text-sm mb-2">{data.name}</p>
          {data.isZeroData ? (
            <div className="text-xs text-gray-500 italic">
              No booking data for selected period
            </div>
          ) : (
            <div className="space-y-1 text-xs">
              <p className="flex justify-between gap-4">
                <span className="text-gray-600">Occupancy:</span>
                <span className="font-medium">{formatPercentage(data.property.occupancyRate * 100, 1)}</span>
              </p>
              <p className="flex justify-between gap-4">
                <span className="text-gray-600">Revenue:</span>
                <span className="font-medium text-green-600">{formatCurrency(data.property.revenue)}</span>
              </p>
              <p className="flex justify-between gap-4">
                <span className="text-gray-600">Bookings:</span>
                <span className="font-medium">{data.property.bookings || 0}</span>
              </p>
              <p className="flex justify-between gap-4">
                <span className="text-gray-600">Avg Rate:</span>
                <span className="font-medium">{formatCurrency(data.avgNightlyRate)}</span>
              </p>
            </div>
          )}
        </div>
      )
    }
    return null
  }
  
  const handleClick = (data: any) => {
    if (data && data.activePayload && data.activePayload[0] && onPropertyClick) {
      const property = data.activePayload[0].payload.property
      onPropertyClick(property)
    }
  }
  
  const maxRevenue = Math.max(...scatterData.data.map(d => d.y), 1)
  
  if (scatterData.data.length === 0) {
    return (
      <div className="flex items-center justify-center h-full text-gray-500">
        <div className="text-center">
          <p className="text-sm">No property data available</p>
          <p className="text-xs mt-1">Select a date range with booking data</p>
        </div>
      </div>
    )
  }

  return (
    <ResponsiveContainer width="100%" height="100%">
      <ScatterChart
        margin={{ top: 20, right: 30, left: 50, bottom: 40 }}
        onClick={handleClick}
      >
        <CartesianGrid strokeDasharray="3 3" stroke="#E5E7EB" />
        <XAxis
          type="number"
          dataKey="x"
          name="Occupancy"
          domain={[0, 100]}
          tickFormatter={(value) => `${value}%`}
          label={{ value: 'Occupancy Rate (%)', position: 'insideBottom', offset: -5 }}
          stroke="#6B7280"
        />
        <YAxis
          type="number"
          dataKey="y"
          name="Revenue"
          domain={[0, maxRevenue * 1.1]}
          tickFormatter={(value) => `$${(value / 1000).toFixed(0)}k`}
          label={{ value: 'Revenue', angle: -90, position: 'insideLeft' }}
          stroke="#6B7280"
        />
        <Tooltip
          content={<CustomTooltip />}
          cursor={{ strokeDasharray: '3 3' }}
        />
        
        {scatterData.avgOccupancy > 0 && (
          <ReferenceLine
            x={scatterData.avgOccupancy}
            stroke="#9CA3AF"
            strokeDasharray="5 5"
            label={{ value: 'Avg', position: 'top' }}
          />
        )}
        {scatterData.avgRevenue > 0 && (
          <ReferenceLine
            y={scatterData.avgRevenue}
            stroke="#9CA3AF"
            strokeDasharray="5 5"
            label={{ value: 'Avg', position: 'right' }}
          />
        )}
        
        <Scatter
          name="Properties"
          data={scatterData.data}
          fill={METRIC_COLORS.revenue}
        >
          {scatterData.data.map((entry, index) => (
            <Cell 
              key={`cell-${index}`} 
              fill={getPointColor(entry)}
              style={{ cursor: 'pointer' }}
            />
          ))}
        </Scatter>
      </ScatterChart>
    </ResponsiveContainer>
  )
}

export const PerformanceQuadrantLegend: React.FC = () => {
  return (
    <div className="flex flex-wrap gap-2 justify-center text-xs mt-3 px-4">
      <div className="flex items-center gap-1.5 bg-green-50 px-2 py-1 rounded">
        <div className="w-2.5 h-2.5 bg-green-500 rounded-full"></div>
        <span className="text-gray-700 text-[11px] font-medium">High Occupancy & Revenue</span>
      </div>
      <div className="flex items-center gap-1.5 bg-blue-50 px-2 py-1 rounded">
        <div className="w-2.5 h-2.5 bg-blue-500 rounded-full"></div>
        <span className="text-gray-700 text-[11px] font-medium">High Revenue, Low Occupancy</span>
      </div>
      <div className="flex items-center gap-1.5 bg-yellow-50 px-2 py-1 rounded">
        <div className="w-2.5 h-2.5 bg-yellow-500 rounded-full"></div>
        <span className="text-gray-700 text-[11px] font-medium">High Occupancy, Low Revenue</span>
      </div>
      <div className="flex items-center gap-1.5 bg-red-50 px-2 py-1 rounded">
        <div className="w-2.5 h-2.5 bg-red-500 rounded-full"></div>
        <span className="text-gray-700 text-[11px] font-medium">Low Occupancy & Revenue</span>
      </div>
      <div className="flex items-center gap-1.5 bg-gray-50 px-2 py-1 rounded">
        <div className="w-2.5 h-2.5 bg-gray-400 rounded-full"></div>
        <span className="text-gray-700 text-[11px] font-medium">No Bookings</span>
      </div>
    </div>
  )
}