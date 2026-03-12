import React, { useMemo, useCallback } from 'react'
import { ScatterChart, Scatter, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, Cell, ReferenceLine, ReferenceArea } from 'recharts'
import type { TooltipContentProps } from 'recharts'
import { formatCurrency, formatPercentage } from '@/utils/formatters'
import { EmptyQuadrants } from '@/components/EmptyQuadrants'
import { PropertyMetrics } from '@/types/api'
import { METRIC_COLORS, CHART_INFRA, resolveToken } from '@/lib/theme'

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

const ScatterTooltip = ({ active, payload }: Partial<TooltipContentProps<number, string>>) => {
  if (!active || !payload?.length) return null
  const data = payload[0].payload
  return (
    <div className="bg-card p-3 rounded-lg shadow-lg border border-border">
      <p className="font-semibold text-sm mb-2">{data.fullName || data.name}</p>
      {data.isZeroData ? (
        <div className="text-xs text-muted-foreground italic">
          No booking data for selected period
        </div>
      ) : (
        <div className="space-y-1 text-xs">
          <div className="flex justify-between gap-4">
            <span className="text-muted-foreground">Revenue:</span>
            <span className="font-medium text-success">{formatCurrency(data.property.revenue)}</span>
          </div>
          <div className="flex justify-between gap-4">
            <span className="text-muted-foreground">Bookings:</span>
            <span className="font-medium">{data.property.bookings || 0}</span>
          </div>
          <div className="pt-1 mt-1 border-t border-border flex justify-between gap-4">
            <span className="text-muted-foreground">Occupancy:</span>
            <span className="font-medium">{formatPercentage(data.property.occupancyRate * 100, 1)}</span>
          </div>
          <div className="flex justify-between gap-4">
            <span className="text-muted-foreground">Avg Rate:</span>
            <span className="font-medium">{formatCurrency(data.avgNightlyRate)}</span>
          </div>
        </div>
      )}
    </div>
  )
}

// stable label renderer factory — called once per quadrant, returns a render function
const makeQuadrantLabel = (text: string, position: 'top-right' | 'top-left' | 'bottom-right' | 'bottom-left') =>
  ({ viewBox }: { viewBox?: { x: number; y: number; width: number; height: number } }) => {
    if (!viewBox) return null
    const { x, y, width, height } = viewBox
    const pad = 6

    let labelX: number, labelY: number, anchor: 'start' | 'end'
    switch (position) {
      case 'top-right':
        labelX = x + width - pad; labelY = y + pad + 10; anchor = 'end'; break
      case 'top-left':
        labelX = x + pad; labelY = y + pad + 10; anchor = 'start'; break
      case 'bottom-right':
        labelX = x + width - pad; labelY = y + height - pad; anchor = 'end'; break
      case 'bottom-left':
        labelX = x + pad; labelY = y + height - pad; anchor = 'start'; break
    }

    return (
      <text
        x={labelX}
        y={labelY}
        textAnchor={anchor}
        fill="currentColor"
        opacity={0.5}
        fontSize={10}
        fontWeight={500}
        className="text-muted-foreground"
      >
        {text}
      </text>
    )
  }

// pre-built label renderers (stable references, no re-creation per render)
const labelTopRight = makeQuadrantLabel('Top Performers', 'top-right')
const labelTopLeft = makeQuadrantLabel('High Value', 'top-left')
const labelBottomRight = makeQuadrantLabel('High Volume', 'bottom-right')
const labelBottomLeft = makeQuadrantLabel('Needs Attention', 'bottom-left')

const formatOccupancyTick = (value: number) => `${Math.round(value)}%`
const formatRevenueTick = (value: number) => {
  if (value === 0) return '$0'
  return `$${Math.round(value / 1000)}k`
}

interface ScatterPoint {
  x: number
  y: number
  z: number
  name: string
  fullName?: string
  propertyId: string
  avgNightlyRate: number
  isZeroData: boolean
  property: PropertyMetrics
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

    const realPoints: ScatterPoint[] = []
    const zeroProperties: PropertyMetrics[] = []

    for (const property of properties) {
      const x = (property.occupancyRate || 0) * 100
      const y = property.revenue || 0

      if (x === 0 && y === 0) {
        zeroProperties.push(property)
      } else {
        realPoints.push({
          x, y,
          z: 64,
          name: property.propertyCode || property.propertyName,
          fullName: property.propertyName,
          propertyId: property.propertyId,
          avgNightlyRate: property.avgNightlyRate || 0,
          isZeroData: false,
          property
        })
      }
    }

    if (realPoints.length === 0) return empty

    const xValues = realPoints.map((d) => d.x)
    const yValues = realPoints.map((d) => d.y)

    const dataMinX = Math.min(...xValues)
    const dataMaxX = Math.max(...xValues)
    const dataMinY = Math.min(...yValues)
    const dataMaxY = Math.max(...yValues)

    const xRange = dataMaxX - dataMinX
    const yRange = dataMaxY - dataMinY

    const xPad = Math.max(xRange * 0.15, 5)
    const yPad = Math.max(yRange * 0.15, dataMaxY * 0.05 || 1000)

    const xMin = Math.max(0, Math.floor((dataMinX - xPad) / 5) * 5)
    const xMax = Math.min(100, Math.ceil((dataMaxX + xPad) / 5) * 5)

    const rawYMin = Math.max(0, dataMinY - yPad)
    const rawYMax = dataMaxY + yPad
    const yTickStep = niceStep(rawYMax - rawYMin)
    const yMin = Math.max(0, Math.floor(rawYMin / yTickStep) * yTickStep)
    const yMax = Math.ceil(rawYMax / yTickStep) * yTickStep

    let zeroOffsetIndex = 0
    const zeroPoints = zeroProperties.map(property => {
      const x = xMin + (xMax - xMin) * 0.04 + (zeroOffsetIndex % 3) * (xMax - xMin) * 0.02
      const y = yMin + (yMax - yMin) * 0.04 + Math.floor(zeroOffsetIndex / 3) * (yMax - yMin) * 0.02
      zeroOffsetIndex++
      return {
        x, y,
        z: 64,
        name: property.propertyName,
        propertyId: property.propertyId,
        avgNightlyRate: property.avgNightlyRate || 0,
        isZeroData: true,
        property
      }
    })

    const data = [...realPoints, ...zeroPoints]

    const avgOccupancy = realPoints.reduce((sum: number, d) => sum + d.x, 0) / realPoints.length
    const avgRevenue = realPoints.reduce((sum: number, d) => sum + d.y, 0) / realPoints.length

    return { data, avgOccupancy, avgRevenue, xDomain: [xMin, xMax] as [number, number], yDomain: [yMin, yMax] as [number, number] }
  }, [properties])

  // memoize resolved colors to avoid getComputedStyle per cell per render
  const quadrantColors = useMemo(() => ({
    success: resolveToken('--success'),
    info: resolveToken('--info'),
    warning: resolveToken('--warning'),
    danger: resolveToken('--danger'),
    reference: CHART_INFRA.reference,
  }), [])

  const getPointColor = (point: ScatterPoint) => {
    const { avgOccupancy, avgRevenue } = scatterData
    if (point.isZeroData) return quadrantColors.reference
    if (point.x >= avgOccupancy && point.y >= avgRevenue) return quadrantColors.success
    if (point.x >= avgOccupancy && point.y < avgRevenue)  return quadrantColors.warning
    if (point.x < avgOccupancy  && point.y >= avgRevenue) return quadrantColors.info
    return quadrantColors.danger
  }

  const handlePointClick = useCallback((point: ScatterPoint) => {
    if (onPropertyClick && point?.property) {
      onPropertyClick(point.property)
    }
  }, [onPropertyClick])

  if (scatterData.data.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center h-full text-muted-foreground">
        <EmptyQuadrants className="w-12 h-12 mb-2" />
        <p className="text-sm font-medium">No property data available</p>
        <p className="text-xs text-muted-foreground/70 mt-1">Select a date range with booking data</p>
      </div>
    )
  }

  const { avgOccupancy, avgRevenue, xDomain, yDomain } = scatterData

  return (
    <ResponsiveContainer width="100%" height="100%">
      <ScatterChart
        margin={{ top: 20, right: 30, left: 60, bottom: 50 }}
      >
        <CartesianGrid strokeDasharray="3 3" stroke={CHART_INFRA.grid} />

        {avgOccupancy > 0 && avgRevenue > 0 && (
          <>
            <ReferenceArea
              x1={avgOccupancy} x2={xDomain[1]}
              y1={avgRevenue} y2={yDomain[1]}
              fill={quadrantColors.success} fillOpacity={0.04}
              stroke="none"
              label={labelTopRight}
            />
            <ReferenceArea
              x1={xDomain[0]} x2={avgOccupancy}
              y1={avgRevenue} y2={yDomain[1]}
              fill={quadrantColors.info} fillOpacity={0.04}
              stroke="none"
              label={labelTopLeft}
            />
            <ReferenceArea
              x1={avgOccupancy} x2={xDomain[1]}
              y1={yDomain[0]} y2={avgRevenue}
              fill={quadrantColors.warning} fillOpacity={0.04}
              stroke="none"
              label={labelBottomRight}
            />
            <ReferenceArea
              x1={xDomain[0]} x2={avgOccupancy}
              y1={yDomain[0]} y2={avgRevenue}
              fill={quadrantColors.danger} fillOpacity={0.04}
              stroke="none"
              label={labelBottomLeft}
            />
          </>
        )}

        <XAxis
          type="number"
          dataKey="x"
          name="Occupancy"
          domain={xDomain}
          tickFormatter={formatOccupancyTick}
          label={{ value: 'Occupancy Rate (%)', position: 'insideBottom', offset: -15, style: { fontSize: 13 } }}
          stroke={CHART_INFRA.axis}
        />
        <YAxis
          type="number"
          dataKey="y"
          name="Revenue"
          domain={yDomain}
          tickFormatter={formatRevenueTick}
          label={{ value: 'Revenue', angle: -90, position: 'insideLeft', offset: -10, style: { fontSize: 13 } }}
          stroke={CHART_INFRA.axis}
        />
        <Tooltip
          content={<ScatterTooltip />}
          cursor={{ strokeDasharray: '3 3' }}
          isAnimationActive={false}
        />

        {avgOccupancy > 0 && (
          <ReferenceLine
            x={avgOccupancy}
            stroke={CHART_INFRA.reference}
            strokeDasharray="5 5"
            label={{ value: 'Avg', position: 'top', style: { fontSize: 13 } }}
          />
        )}
        {avgRevenue > 0 && (
          <ReferenceLine
            y={avgRevenue}
            stroke={CHART_INFRA.reference}
            strokeDasharray="5 5"
            label={{ value: 'Avg', position: 'right', style: { fontSize: 13 } }}
          />
        )}

        <Scatter
          name="Properties"
          data={scatterData.data}
          fill={METRIC_COLORS.revenue}
          animationDuration={500}
          animationEasing="ease-out"
          onClick={handlePointClick}
          className={onPropertyClick ? 'cursor-pointer' : ''}
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

export const PerformanceQuadrantLegend: React.FC = () => (
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
