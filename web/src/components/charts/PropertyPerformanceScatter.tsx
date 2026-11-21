import type React from 'react'
import { useMemo, useCallback } from 'react'
import {
  ScatterChart,
  Scatter,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
  Cell,
  ReferenceLine,
  ReferenceArea,
  LabelList,
} from 'recharts'
import type { ScatterPointItem, TooltipContentProps } from 'recharts'
import { formatCurrency, formatPercentage } from '@/utils/formatters'
import type { PropertyMetrics } from '@/types/api'
import { METRIC_COLORS, CHART_INFRA, resolveToken } from '@/lib/theme'

function niceStep(range: number): number {
  if (range <= 0) return 1000
  const rough = range / 5
  const pow = 10 ** Math.floor(Math.log10(rough))
  const normalized = rough / pow
  if (normalized <= 1) return pow
  if (normalized <= 2) return 2 * pow
  if (normalized <= 5) return 5 * pow
  return 10 * pow
}

const steps = (min: number, max: number, step: number) => {
  const ticks: number[] = []
  for (let v = min; v <= max + step / 1000; v += step) ticks.push(Math.round(v * 1000) / 1000)
  return ticks
}

const ScatterTooltip = ({ active, payload }: Partial<TooltipContentProps<number, string>>) => {
  if (!active || !payload?.length) return null
  const data = payload[0].payload
  return (
    <div className="bg-card p-3 rounded-lg shadow-lg border border-border">
      <p className="font-semibold text-sm mb-2">{data.fullName || data.name}</p>
      <div className="space-y-1 text-xs">
        <div className="flex justify-between gap-4">
          <span className="text-muted-foreground">Revenue:</span>
          <span className="font-medium text-foreground">{formatCurrency(data.property.revenue)}</span>
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
    </div>
  )
}

// stable label renderer factory — called once per quadrant, returns a render function
const makeQuadrantLabel =
  (text: string, position: 'top-right' | 'top-left' | 'bottom-right' | 'bottom-left') =>
  ({ viewBox }: { viewBox?: { x: number; y: number; width: number; height: number } }) => {
    if (!viewBox) return null
    const { x, y, width, height } = viewBox
    const pad = 6

    let labelX: number, labelY: number, anchor: 'start' | 'end'
    switch (position) {
      case 'top-right':
        labelX = x + width - pad
        labelY = y + pad + 10
        anchor = 'end'
        break
      case 'top-left':
        labelX = x + pad
        labelY = y + pad + 10
        anchor = 'start'
        break
      case 'bottom-right':
        labelX = x + width - pad
        labelY = y + height - pad
        anchor = 'end'
        break
      case 'bottom-left':
        labelX = x + pad
        labelY = y + height - pad
        anchor = 'start'
        break
    }

    return (
      <text x={labelX} y={labelY} textAnchor={anchor} fill={CHART_INFRA.axis} fontSize={11}>
        {text}
      </text>
    )
  }

// pre-built label renderers (stable references, no re-creation per render)
const labelTopRight = makeQuadrantLabel('Top performers', 'top-right')
const labelTopLeft = makeQuadrantLabel('High value', 'top-left')
const labelBottomRight = makeQuadrantLabel('High volume', 'bottom-right')
const labelBottomLeft = makeQuadrantLabel('Needs attention', 'bottom-left')

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
  property: PropertyMetrics
}

interface PropertyPerformanceScatterProps {
  properties: PropertyMetrics[]
  onPropertyClick?: (property: PropertyMetrics) => void
}

export const PropertyPerformanceScatter: React.FC<PropertyPerformanceScatterProps> = ({ properties, onPropertyClick }) => {
  const scatterData = useMemo(() => {
    const empty = {
      data: [] as ScatterPoint[],
      unbooked: [] as PropertyMetrics[],
      avgOccupancy: 0,
      avgRevenue: 0,
      xDomain: [0, 100] as [number, number],
      yDomain: [0, 1000] as [number, number],
      xTicks: undefined as number[] | undefined,
      yTicks: undefined as number[] | undefined,
    }
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
          x,
          y,
          z: 64,
          name: property.propertyCode || property.propertyName,
          fullName: property.propertyName,
          propertyId: property.propertyId,
          avgNightlyRate: property.avgNightlyRate || 0,
          property,
        })
      }
    }

    if (realPoints.length === 0) return { ...empty, unbooked: zeroProperties }

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

    const data = realPoints

    const avgOccupancy = realPoints.reduce((sum: number, d) => sum + d.x, 0) / realPoints.length
    const avgRevenue = realPoints.reduce((sum: number, d) => sum + d.y, 0) / realPoints.length

    return {
      data,
      unbooked: zeroProperties,
      avgOccupancy,
      avgRevenue,
      xDomain: [xMin, xMax] as [number, number],
      yDomain: [yMin, yMax] as [number, number],
      // the domain ends are already multiples of these steps, so the ticks land evenly
      xTicks: steps(xMin, xMax, 5),
      yTicks: steps(yMin, yMax, yTickStep),
    }
  }, [properties])

  const surface = useMemo(() => resolveToken('--card'), [])

  const handlePointClick = useCallback(
    (item: ScatterPointItem) => {
      const point = (item.payload ?? item) as ScatterPoint
      if (onPropertyClick && point?.property) {
        onPropertyClick(point.property)
      }
    },
    [onPropertyClick],
  )

  const { avgOccupancy, avgRevenue, xDomain, yDomain, xTicks, yTicks, unbooked } = scatterData

  return (
    <div className="flex h-full flex-col">
      <div className="min-h-0 flex-1">
        <ResponsiveContainer width="100%" height="100%">
          <ScatterChart margin={{ top: 24, right: 40, left: 0, bottom: 4 }}>
            <CartesianGrid stroke={CHART_INFRA.grid} strokeOpacity={0.6} />

            {avgOccupancy > 0 && avgRevenue > 0 && (
              <>
                <ReferenceArea
                  x1={avgOccupancy}
                  x2={xDomain[1]}
                  y1={avgRevenue}
                  y2={yDomain[1]}
                  fillOpacity={0}
                  stroke="none"
                  label={labelTopRight}
                />
                <ReferenceArea
                  x1={xDomain[0]}
                  x2={avgOccupancy}
                  y1={avgRevenue}
                  y2={yDomain[1]}
                  fillOpacity={0}
                  stroke="none"
                  label={labelTopLeft}
                />
                <ReferenceArea
                  x1={avgOccupancy}
                  x2={xDomain[1]}
                  y1={yDomain[0]}
                  y2={avgRevenue}
                  fillOpacity={0}
                  stroke="none"
                  label={labelBottomRight}
                />
                <ReferenceArea
                  x1={xDomain[0]}
                  x2={avgOccupancy}
                  y1={yDomain[0]}
                  y2={avgRevenue}
                  fillOpacity={0}
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
              ticks={xTicks}
              tickFormatter={formatOccupancyTick}
              tick={{ fill: CHART_INFRA.axis, fontSize: 12 }}
              axisLine={false}
              tickLine={false}
            />
            <YAxis
              type="number"
              dataKey="y"
              name="Revenue"
              domain={yDomain}
              ticks={yTicks}
              tickFormatter={formatRevenueTick}
              tick={{ fill: CHART_INFRA.axis, fontSize: 12 }}
              axisLine={false}
              tickLine={false}
              width={48}
            />
            <Tooltip content={<ScatterTooltip />} cursor={{ strokeDasharray: '3 3' }} isAnimationActive={false} />

            {avgOccupancy > 0 && (
              <ReferenceLine
                x={avgOccupancy}
                stroke={CHART_INFRA.reference}
                strokeDasharray="5 5"
                label={{ value: 'Avg', position: 'top', fill: CHART_INFRA.axis, fontSize: 11 }}
              />
            )}
            {avgRevenue > 0 && (
              <ReferenceLine
                y={avgRevenue}
                stroke={CHART_INFRA.reference}
                strokeDasharray="5 5"
                label={{ value: 'Avg', position: 'right', fill: CHART_INFRA.axis, fontSize: 11 }}
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
              {/* the surface ring keeps dots distinct where they sit on a reference line */}
              {scatterData.data.map((entry) => (
                <Cell key={entry.propertyId} fill={METRIC_COLORS.revenue} stroke={surface} strokeWidth={2} />
              ))}
              <LabelList dataKey="name" position="right" offset={8} fill={CHART_INFRA.axis} fontSize={11} />
            </Scatter>
          </ScatterChart>
        </ResponsiveContainer>
      </div>
      {unbooked.length > 0 && (
        <p className="mt-2 text-xs text-muted-foreground">
          No bookings in this range: {unbooked.map((p) => p.propertyCode || p.propertyName).join(', ')}
        </p>
      )}
    </div>
  )
}
