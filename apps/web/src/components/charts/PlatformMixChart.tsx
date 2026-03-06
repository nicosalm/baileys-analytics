import React, { useMemo, useCallback } from 'react'
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer } from 'recharts'
import { formatCurrency } from '@/utils/formatters'
import { getPlatformColor, CHART_INFRA } from '@/lib/theme'
import { EmptyQuadrants } from '@/components/EmptyQuadrants'

interface PlatformEntry {
  platform: string
  bookings: number
  revenue: number
}

interface PropertyPlatformMix {
  propertyId: string
  propertyName: string
  propertyCode?: string | null
  platforms: PlatformEntry[]
}

interface PlatformMixChartProps {
  data: PropertyPlatformMix[]
  onPropertyClick?: (propertyId: string, propertyName: string) => void
  showPercentage?: boolean
}

const PlatformMixTooltip = ({ active, payload, label, isPercentage }: any) => {
  if (!active || !payload?.length) return null
  const items = payload.filter((p: any) => p.value > 0)

  const raw = payload[0]?.payload
  const totalRevenue = raw?._totalRevenue || items.reduce((sum: number, p: any) => sum + (isPercentage ? (raw?.[`_raw_${p.dataKey}`] || 0) : p.value), 0)

  return (
    <div className="bg-card p-3 rounded-lg shadow-lg border border-border">
      <p className="font-semibold text-sm mb-2">{raw?.fullName || label}</p>
      <div className="space-y-1 text-xs">
        {items.map((item: any) => {
          const actualValue = isPercentage ? (raw?.[`_raw_${item.dataKey}`] || 0) : item.value
          const pct = totalRevenue > 0 ? Math.round((actualValue / totalRevenue) * 100) : 0
          return (
            <div key={item.dataKey} className="flex justify-between gap-4">
              <div className="flex items-center gap-1.5">
                <div className="w-2.5 h-2.5 rounded-sm flex-shrink-0" style={{ backgroundColor: item.fill || item.color }} />
                <span className="text-muted-foreground">{item.dataKey}:</span>
              </div>
              <span className="font-medium">{formatCurrency(actualValue)} ({pct}%)</span>
            </div>
          )
        })}
        {totalRevenue > 0 && (
          <div className="pt-1 mt-1 border-t border-border flex justify-between gap-4">
            <span className="text-muted-foreground">Total:</span>
            <span className="font-semibold">{formatCurrency(totalRevenue)}</span>
          </div>
        )}
      </div>
    </div>
  )
}

const formatPctTick = (v: number) => `${Math.round(v)}%`
const formatRevenueTick = (v: number) => {
  if (v === 0) return '$0'
  return `$${Math.round(v / 1000)}k`
}

export const PlatformMixChart: React.FC<PlatformMixChartProps> = ({ data, onPropertyClick, showPercentage = true }) => {
  const { chartData, percentageData, sortedPlatforms } = useMemo(() => {
    const platformTotals = new Map<string, number>()
    for (const prop of data) {
      for (const p of prop.platforms) {
        platformTotals.set(p.platform, (platformTotals.get(p.platform) || 0) + p.revenue)
      }
    }
    const sortedPlatforms = Array.from(platformTotals.entries())
      .sort((a, b) => b[1] - a[1])
      .map(([name]) => name)

    const validData = data.filter(d => d.platforms.length > 0)

    const chartData = validData.map(d => {
      const row: any = {
        name: d.propertyCode || (d.propertyName.length > 18 ? d.propertyName.slice(0, 16) + '\u2026' : d.propertyName),
        fullName: d.propertyName,
        propertyId: d.propertyId
      }
      for (const p of d.platforms) {
        row[p.platform] = p.revenue
      }
      return row
    })

    const percentageData = validData.map(d => {
      const total = d.platforms.reduce((sum, p) => sum + p.revenue, 0)
      const row: any = {
        name: d.propertyCode || (d.propertyName.length > 18 ? d.propertyName.slice(0, 16) + '\u2026' : d.propertyName),
        fullName: d.propertyName,
        propertyId: d.propertyId,
        _totalRevenue: total
      }
      for (const p of d.platforms) {
        row[p.platform] = total > 0 ? (p.revenue / total) * 100 : 0
        row[`_raw_${p.platform}`] = p.revenue
      }
      return row
    })

    return { chartData, percentageData, sortedPlatforms }
  }, [data])

  const handleBarClick = useCallback((data: any) => {
    if (onPropertyClick && data?.propertyId) {
      onPropertyClick(data.propertyId, data.fullName)
    }
  }, [onPropertyClick])

  if (chartData.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center h-full text-muted-foreground">
        <EmptyQuadrants className="w-12 h-12 mb-2" />
        <p className="text-sm font-medium">No booking source data</p>
        <p className="text-xs text-muted-foreground/70 mt-1">Platform mix will appear once bookings are synced</p>
      </div>
    )
  }

  const activeData = showPercentage ? percentageData : chartData

  return (
    <ResponsiveContainer width="100%" height="100%">
      <BarChart
        data={activeData}
        layout="vertical"
        margin={{ top: 5, right: 30, left: 10, bottom: 5 }}
        barCategoryGap="25%"
      >
        <CartesianGrid strokeDasharray="3 3" stroke={CHART_INFRA.grid} horizontal={false} />
        <XAxis
          type="number"
          domain={showPercentage ? [0, 100] : undefined}
          tickFormatter={showPercentage ? formatPctTick : formatRevenueTick}
          stroke={CHART_INFRA.axis}
        />
        <YAxis
          type="category"
          dataKey="name"
          width={80}
          tick={{ fontSize: 12 }}
          stroke={CHART_INFRA.axis}
        />
        <Tooltip
          content={<PlatformMixTooltip isPercentage={showPercentage} />}
          cursor={{ fill: 'var(--muted)', opacity: 0.3 }}
          isAnimationActive={false}
        />
        {sortedPlatforms.map((platform, i) => (
          <Bar
            key={platform}
            dataKey={platform}
            stackId="platforms"
            fill={getPlatformColor(platform, i)}
            radius={i === sortedPlatforms.length - 1 ? [0, 4, 4, 0] : undefined}
            maxBarSize={28}
            animationDuration={500}
            animationEasing="ease-out"
            onClick={handleBarClick}
            className={onPropertyClick ? 'cursor-pointer' : ''}
          />
        ))}
      </BarChart>
    </ResponsiveContainer>
  )
}

export const PlatformMixLegend: React.FC<{ platforms: string[] }> = ({ platforms }) => (
  <div className="flex flex-wrap gap-3 justify-center text-xs mt-3 px-4">
    {platforms.map((platform, i) => (
      <div key={platform} className="flex items-center gap-1.5">
        <div className="w-3 h-2.5 rounded-sm" style={{ backgroundColor: getPlatformColor(platform, i) }} />
        <span className="text-muted-foreground">{platform}</span>
      </div>
    ))}
  </div>
)
