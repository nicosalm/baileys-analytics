import React, { useMemo } from 'react'
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer } from 'recharts'
import { formatCurrency } from '@/utils/formatters'
import { getPlatformColor, CHART_INFRA } from '@/lib/theme'

interface PlatformEntry {
  platform: string
  bookings: number
  revenue: number
}

interface PropertyPlatformMix {
  propertyId: string
  propertyName: string
  platforms: PlatformEntry[]
}

interface PlatformMixChartProps {
  data: PropertyPlatformMix[]
  onPropertyClick?: (propertyId: string, propertyName: string) => void
}

const PlatformMixTooltip = ({ active, payload, label }: any) => {
  if (!active || !payload?.length) return null
  // payload has one entry per platform; filter to non-zero
  const items = payload.filter((p: any) => p.value > 0)
  const totalRevenue = items.reduce((sum: number, p: any) => sum + p.value, 0)

  return (
    <div className="bg-card p-3 rounded-lg shadow-lg border border-border">
      <p className="font-semibold text-sm mb-2">{label}</p>
      <div className="space-y-1 text-xs">
        {items.map((item: any) => {
          const pct = totalRevenue > 0 ? (item.value / totalRevenue * 100).toFixed(0) : '0'
          return (
            <div key={item.dataKey} className="flex justify-between gap-4">
              <div className="flex items-center gap-1.5">
                <div className="w-2.5 h-2.5 rounded-sm flex-shrink-0" style={{ backgroundColor: item.fill || item.color }} />
                <span className="text-muted-foreground">{item.dataKey}:</span>
              </div>
              <span className="font-medium">{formatCurrency(item.value)} ({pct}%)</span>
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

export const PlatformMixChart: React.FC<PlatformMixChartProps> = ({ data, onPropertyClick }) => {
  // collect all unique platforms and build chart data
  const { chartData, allPlatforms } = useMemo(() => {
    const platformSet = new Set<string>()
    for (const prop of data) {
      for (const p of prop.platforms) {
        platformSet.add(p.platform)
      }
    }
    const allPlatforms = Array.from(platformSet)

    const chartData = data
      .filter(d => d.platforms.length > 0)
      .map(d => {
        const row: any = {
          name: d.propertyName.length > 18 ? d.propertyName.slice(0, 16) + '...' : d.propertyName,
          fullName: d.propertyName,
          propertyId: d.propertyId
        }
        for (const p of d.platforms) {
          row[p.platform] = p.revenue
        }
        return row
      })

    return { chartData, allPlatforms }
  }, [data])

  if (chartData.length === 0) return null

  return (
    <ResponsiveContainer width="100%" height="100%">
      <BarChart
        data={chartData}
        layout="vertical"
        margin={{ top: 5, right: 30, left: 10, bottom: 5 }}
        barCategoryGap="25%"
        onClick={(state: any) => {
          if (state?.activePayload?.[0] && onPropertyClick) {
            const d = state.activePayload[0].payload
            onPropertyClick(d.propertyId, d.fullName)
          }
        }}
        style={{ cursor: onPropertyClick ? 'pointer' : 'default' }}
      >
        <CartesianGrid strokeDasharray="3 3" stroke={CHART_INFRA.grid} horizontal={false} />
        <XAxis
          type="number"
          tickFormatter={(v) => `$${(v / 1000).toFixed(0)}k`}
          stroke={CHART_INFRA.axis}
        />
        <YAxis
          type="category"
          dataKey="name"
          width={120}
          tick={{ fontSize: 12 }}
          stroke={CHART_INFRA.axis}
        />
        <Tooltip content={<PlatformMixTooltip />} cursor={{ fill: 'var(--muted)', opacity: 0.3 }} />
        {allPlatforms.map((platform, i) => (
          <Bar
            key={platform}
            dataKey={platform}
            stackId="platforms"
            fill={getPlatformColor(platform, i)}
            radius={i === allPlatforms.length - 1 ? [0, 4, 4, 0] : undefined}
            maxBarSize={28}
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
