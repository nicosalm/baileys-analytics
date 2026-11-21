import type React from 'react'
import { useMemo, useCallback } from 'react'
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, Cell } from 'recharts'
import type { TooltipContentProps, BarRectangleItem } from 'recharts'
import { formatCurrency } from '@/utils/formatters'
import { resolveToken, CHART_INFRA } from '@/lib/theme'

interface PropertyProfitability {
  propertyId: string
  propertyName: string
  propertyCode?: string | null
  grossRevenue: number
  platformFees: number
  taxes: number
  operatingExpenses: number
  netRevenue: number
}

interface ProfitabilityChartProps {
  data: PropertyProfitability[]
  onPropertyClick?: (propertyId: string, propertyName: string) => void
}

const ProfitabilityTooltip = ({ active, payload }: Partial<TooltipContentProps<number, string>>) => {
  if (!active || !payload?.length) return null
  const d = payload[0].payload
  const margin = d.grossRevenue > 0 ? (d.netRevenue / d.grossRevenue) * 100 : 0

  return (
    <div className="bg-card p-3 rounded-lg shadow-lg border border-border">
      <p className="font-semibold text-sm mb-2">{d.fullName}</p>
      <div className="space-y-1 text-xs">
        <div className="flex justify-between gap-4">
          <span className="text-muted-foreground">Gross Revenue:</span>
          <span className="font-medium">{formatCurrency(d.grossRevenue)}</span>
        </div>
        <div className="flex justify-between gap-4">
          <span className="text-muted-foreground">Platform Fees (est.):</span>
          <span className="font-medium text-warning">-{formatCurrency(d.platformFees)}</span>
        </div>
        <div className="flex justify-between gap-4">
          <span className="text-muted-foreground">Taxes:</span>
          <span className="font-medium text-info">-{formatCurrency(d.taxes)}</span>
        </div>
        {d.operatingExpenses > 0 && (
          <div className="flex justify-between gap-4">
            <span className="text-muted-foreground">Operating Expenses:</span>
            <span className="font-medium text-danger">-{formatCurrency(d.operatingExpenses)}</span>
          </div>
        )}
        <div className="pt-1 mt-1 border-t border-border flex justify-between gap-4">
          <span className="text-muted-foreground">Net Revenue:</span>
          <span className={`font-semibold ${d.netRevenue >= 0 ? 'text-foreground' : 'text-danger'}`}>{formatCurrency(d.netRevenue)}</span>
        </div>
        <div className="flex justify-between gap-4">
          <span className="text-muted-foreground">Margin:</span>
          <span className={`font-medium ${margin < 0 ? 'text-danger' : 'text-foreground'}`}>{margin.toFixed(1)}%</span>
        </div>
      </div>
    </div>
  )
}

interface MarginLabelProps {
  x?: number
  y?: number
  width?: number
  height?: number
  value?: number
  payload?: PropertyProfitability & { fullName: string; costs: number }
}

const MarginLabel = ({ x, y, width, height, value, payload }: MarginLabelProps) => {
  if (!payload || payload.grossRevenue <= 0) return null
  const margin = (payload.netRevenue / payload.grossRevenue) * 100
  const labelX = (value ?? 0) >= 0 ? (x || 0) + (width || 0) + 6 : (x || 0) - 6
  const labelY = (y || 0) + (height || 0) / 2

  return (
    <text
      x={labelX}
      y={labelY}
      textAnchor={(value ?? 0) >= 0 ? 'start' : 'end'}
      dominantBaseline="central"
      className="fill-muted-foreground"
      fontSize={11}
    >
      {Math.round(margin)}%
    </text>
  )
}

const formatAxisK = (v: number) => {
  if (v === 0) return '$0'
  return `$${Math.round(v / 1000)}k`
}

export const ProfitabilityChart: React.FC<ProfitabilityChartProps> = ({ data, onPropertyClick }) => {
  const chartData = useMemo(
    () =>
      data.map((d) => ({
        ...d,
        name: d.propertyCode || (d.propertyName.length > 18 ? `${d.propertyName.slice(0, 16)}\u2026` : d.propertyName),
        fullName: d.propertyName,
        costs: d.platformFees + d.taxes + d.operatingExpenses,
      })),
    [data],
  )

  const colors = useMemo(
    () => ({
      success: resolveToken('--success'),
      danger: resolveToken('--danger'),
    }),
    [],
  )

  const handleBarClick = useCallback(
    (data: BarRectangleItem) => {
      const p = data?.payload as { propertyId?: string; fullName?: string } | undefined
      if (onPropertyClick && p?.propertyId) {
        onPropertyClick(p.propertyId, p.fullName || '')
      }
    },
    [onPropertyClick],
  )

  return (
    <ResponsiveContainer width="100%" height="100%">
      <BarChart data={chartData} layout="vertical" margin={{ top: 5, right: 45, left: 10, bottom: 5 }} barGap={0} barCategoryGap="25%">
        <CartesianGrid strokeDasharray="3 3" stroke={CHART_INFRA.grid} horizontal={false} />
        <XAxis type="number" tickFormatter={formatAxisK} stroke={CHART_INFRA.axis} />
        <YAxis type="category" dataKey="name" width={130} tick={{ fontSize: 11 }} stroke={CHART_INFRA.axis} />
        <Tooltip content={<ProfitabilityTooltip />} cursor={{ fill: 'var(--muted)', opacity: 0.3 }} isAnimationActive={false} />
        <Bar
          dataKey="netRevenue"
          radius={[0, 4, 4, 0]}
          maxBarSize={28}
          animationDuration={500}
          animationEasing="ease-out"
          label={<MarginLabel />}
          onClick={handleBarClick}
          className={onPropertyClick ? 'cursor-pointer' : ''}
        >
          {chartData.map((entry, i) => (
            <Cell key={i} fill={entry.netRevenue >= 0 ? colors.success : colors.danger} fillOpacity={0.85} />
          ))}
        </Bar>
        <Bar
          dataKey="costs"
          radius={[0, 4, 4, 0]}
          maxBarSize={28}
          fillOpacity={0.4}
          animationDuration={500}
          animationEasing="ease-out"
          onClick={handleBarClick}
          className={onPropertyClick ? 'cursor-pointer' : ''}
        >
          {chartData.map((_, i) => (
            <Cell key={i} fill={colors.danger} />
          ))}
        </Bar>
      </BarChart>
    </ResponsiveContainer>
  )
}

export const ProfitabilityLegend: React.FC = () => (
  <div className="flex flex-wrap gap-3 justify-center text-xs mt-3 px-4">
    <div className="flex items-center gap-1.5">
      <div className="w-3 h-2.5 bg-success rounded-sm opacity-85" />
      <span className="text-muted-foreground">Net Revenue</span>
    </div>
    <div className="flex items-center gap-1.5">
      <div className="w-3 h-2.5 bg-danger rounded-sm opacity-40" />
      <span className="text-muted-foreground">Total Costs (Fees + Taxes + Expenses)</span>
    </div>
  </div>
)
