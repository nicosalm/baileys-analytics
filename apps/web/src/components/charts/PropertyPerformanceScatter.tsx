import React, { useMemo } from 'react'
import { ScatterChart, Scatter, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, Cell, ReferenceLine } from 'recharts'
import { formatCurrency, formatPercentage } from '@/utils/formatters'
import { EmptyQuadrants } from '@/components/EmptyQuadrants'
import { PropertyMetrics } from '@/types/api'
import { METRIC_COLORS, CHART_INFRA, resolveToken } from '@/lib/theme'

// Pick a clean tick interval for ~5 ticks across the given range
function niceStep(range: number): number {
  if (range <= 0) return 1000
  const rough = range / 5
  const pow = Math.pow(10, Math.floor(Math.log10(rough)))
  const normalized = rough / pow
  if (normalized <= 1) return pow
  if (normalized <= 2) return 2 * pow
  if (normalized <= 5) return 5 * pow
  return 10 * pow
}

// extracted to module scope to prevent recreation on each render
const ScatterTooltip = ({ active, payload }: any) => {
  if (active && payload && payload.length) {
    const data = payload[0].payload
    return (
      <div className="bg-card p-3 rounded-lg shadow-lg border border-border">
        <p className="font-semibold text-sm mb-2">{data.name}</p>
        {data.isZeroData ? (
          <div className="text-xs text-muted-foreground italic">
            No booking data for selected period
          </div>
        ) : (
          <div className="space-y-1 text-xs">
            <p className="flex justify-between gap-4">
              <span className="text-muted-foreground">Occupancy:</span>
              <span className="font-medium">{formatPercentage(data.property.occupancyRate * 100, 1)}</span>
            </p>
            <p className="flex justify-between gap-4">
              <span className="text-muted-foreground">Revenue:</span>
              <span className="font-medium text-success">{formatCurrency(data.property.revenue)}</span>
            </p>
            <p className="flex justify-between gap-4">
              <span className="text-muted-foreground">Bookings:</span>
              <span className="font-medium">{data.property.bookings || 0}</span>
            </p>
            <p className="flex justify-between gap-4">
              <span className="text-muted-foreground">Avg Rate:</span>
              <span className="font-medium">{formatCurrency(data.avgNightlyRate)}</span>
            </p>
          </div>
        )}
      </div>
    )
  }
  return null
}

interface PropertyPerformanceScatterProps {
  properties: PropertyMetrics[]
  onPropertyClick?: (property: PropertyMetrics) => void
}

export const PropertyPerformanceScatter: React.FC<PropertyPerformanceScatterProps> = ({
  properties,
  onPropertyClick
}) => {
  const scatterData = useMemo(() => {
    const empty = { data: [], avgOccupancy: 0, avgRevenue: 0, xDomain: [0, 100] as [number, number], yDomain: [0, 1000] as [number, number] }
    if (!properties || properties.length === 0) return empty

    // Separate real data from zero-data properties
    const realPoints: any[] = []
    const zeroProperties: PropertyMetrics[] = []

    properties.forEach(property => {
      const x = (property.occupancyRate || 0) * 100
      const y = property.revenue || 0

      if (x === 0 && y === 0) {
        zeroProperties.push(property)
      } else {
        realPoints.push({
          x, y,
          z: Math.max(property.bookings || 0, 10),
          name: property.propertyName,
          propertyId: property.propertyId,
          avgNightlyRate: property.avgNightlyRate || 0,
          isZeroData: false,
          property
        })
      }
    })

    if (realPoints.length === 0) return empty

    // Compute axis bounds from real data only
    const xValues = realPoints.map((d: any) => d.x)
    const yValues = realPoints.map((d: any) => d.y)

    const dataMinX = Math.min(...xValues)
    const dataMaxX = Math.max(...xValues)
    const dataMinY = Math.min(...yValues)
    const dataMaxY = Math.max(...yValues)

    const xRange = dataMaxX - dataMinX
    const yRange = dataMaxY - dataMinY

    // Pad by 15% of data range; minimums prevent a cramped single-point view
    const xPad = Math.max(xRange * 0.15, 5)
    const yPad = Math.max(yRange * 0.15, dataMaxY * 0.05 || 1000)

    // X: round to nearest 5%
    const xMin = Math.max(0, Math.floor((dataMinX - xPad) / 5) * 5)
    const xMax = Math.min(100, Math.ceil((dataMaxX + xPad) / 5) * 5)

    // Y: round to clean tick intervals
    const rawYMin = Math.max(0, dataMinY - yPad)
    const rawYMax = dataMaxY + yPad
    const yTickStep = niceStep(rawYMax - rawYMin)
    const yMin = Math.max(0, Math.floor(rawYMin / yTickStep) * yTickStep)
    const yMax = Math.ceil(rawYMax / yTickStep) * yTickStep

    // Place zero-data properties in the bottom-left of the visible area
    let zeroOffsetIndex = 0
    const zeroPoints = zeroProperties.map(property => {
      const x = xMin + (xMax - xMin) * 0.04 + (zeroOffsetIndex % 3) * (xMax - xMin) * 0.02
      const y = yMin + (yMax - yMin) * 0.04 + Math.floor(zeroOffsetIndex / 3) * (yMax - yMin) * 0.02
      zeroOffsetIndex++
      return {
        x, y,
        z: 10,
        name: property.propertyName,
        propertyId: property.propertyId,
        avgNightlyRate: property.avgNightlyRate || 0,
        isZeroData: true,
        property
      }
    })

    const data = [...realPoints, ...zeroPoints]

    // Averages from real data only (zero-data properties are a separate visual category)
    const avgOccupancy = realPoints.reduce((sum: number, d: any) => sum + d.x, 0) / realPoints.length
    const avgRevenue = realPoints.reduce((sum: number, d: any) => sum + d.y, 0) / realPoints.length

    return { data, avgOccupancy, avgRevenue, xDomain: [xMin, xMax] as [number, number], yDomain: [yMin, yMax] as [number, number] }
  }, [properties])
  
  const getPointColor = (point: any) => {
    const { avgOccupancy, avgRevenue } = scatterData
    if (point.isZeroData) return CHART_INFRA.reference
    if (point.x >= avgOccupancy && point.y >= avgRevenue) return resolveToken('--success')
    if (point.x >= avgOccupancy && point.y < avgRevenue)  return resolveToken('--warning')
    if (point.x < avgOccupancy  && point.y >= avgRevenue) return resolveToken('--info')
    return resolveToken('--danger')
  }
  
  const handleClick = (data: any) => {
    if (data && data.activePayload && data.activePayload[0] && onPropertyClick) {
      const property = data.activePayload[0].payload.property
      onPropertyClick(property)
    }
  }
  
  if (scatterData.data.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center h-full text-muted-foreground">
        <EmptyQuadrants className="w-12 h-12 mb-2" />
        <p className="text-sm font-medium">No property data available</p>
        <p className="text-xs text-muted-foreground/70 mt-1">Select a date range with booking data</p>
      </div>
    )
  }

  return (
    <ResponsiveContainer width="100%" height="100%">
      <ScatterChart
        margin={{ top: 20, right: 30, left: 50, bottom: 40 }}
        onClick={handleClick}
        style={{ cursor: onPropertyClick ? 'pointer' : 'default' }}
      >
        <CartesianGrid strokeDasharray="3 3" stroke={CHART_INFRA.grid} />
        <XAxis
          type="number"
          dataKey="x"
          name="Occupancy"
          domain={scatterData.xDomain}
          tickFormatter={(value) => `${value}%`}
          label={{ value: 'Occupancy Rate (%)', position: 'insideBottom', offset: -5 }}
          stroke={CHART_INFRA.axis}
        />
        <YAxis
          type="number"
          dataKey="y"
          name="Revenue"
          domain={scatterData.yDomain}
          tickFormatter={(value) => `$${(value / 1000).toFixed(0)}k`}
          label={{ value: 'Revenue', angle: -90, position: 'insideLeft' }}
          stroke={CHART_INFRA.axis}
        />
        <Tooltip
          content={<ScatterTooltip />}
          cursor={{ strokeDasharray: '3 3' }}
        />
        
        {scatterData.avgOccupancy > 0 && (
          <ReferenceLine
            x={scatterData.avgOccupancy}
            stroke={CHART_INFRA.reference}
            strokeDasharray="5 5"
            label={{ value: 'Avg', position: 'top' }}
          />
        )}
        {scatterData.avgRevenue > 0 && (
          <ReferenceLine
            y={scatterData.avgRevenue}
            stroke={CHART_INFRA.reference}
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
    <div className="flex flex-wrap gap-3 justify-center text-xs mt-3 px-4">
      <div className="flex items-center gap-1.5">
        <div className="w-3 h-2.5 bg-success rounded-sm" />
        <span className="text-muted-foreground">High Occupancy & Revenue</span>
      </div>
      <div className="flex items-center gap-1.5">
        <div className="w-3 h-2.5 bg-info rounded-sm" />
        <span className="text-muted-foreground">High Revenue, Low Occupancy</span>
      </div>
      <div className="flex items-center gap-1.5">
        <div className="w-3 h-2.5 bg-warning rounded-sm" />
        <span className="text-muted-foreground">High Occupancy, Low Revenue</span>
      </div>
      <div className="flex items-center gap-1.5">
        <div className="w-3 h-2.5 bg-danger rounded-sm" />
        <span className="text-muted-foreground">Low Occupancy & Revenue</span>
      </div>
      <div className="flex items-center gap-1.5">
        <div className="w-3 h-2.5 bg-chart-reference rounded-sm" />
        <span className="text-muted-foreground">No Bookings</span>
      </div>
    </div>
  )
}