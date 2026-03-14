import React, { useState, useCallback, useMemo } from 'react'
import { PieChart, Pie, Cell, Tooltip, ResponsiveContainer, Label } from 'recharts'
import type { TooltipContentProps } from 'recharts'
import { ChartWrapper } from '@/components/ChartWrapper'
import { getChartColor, resolveToken } from '@/lib/theme'
import { formatCurrency, formatCompactCurrency } from '@baileys/utils'

interface GuestSpendChartProps {
  grossRevenue: number
  guestFees: number
  chargeComposition: {
    taxes: number
    fees: number
    discounts: number
    cleaning: number
    linens: number
    petFees: number
    creditCardFees: number
    otherSurcharges: number
  }
  height?: number
}

const SEGMENT_COLORS: Record<string, string> = {
  'Base Rent': '#3B82F6',
  'Taxes': '#F59E0B',
  'Cleaning': '#8B5CF6',
  'Linens': '#A855F7',
  'Pet Fees': '#D97706',
  'CC Fees': '#EA580C',
  'Booking Fees': '#EC4899',
  'Guest Platform Fee (est.)': '#6366F1',
  'Misc': '#9CA3AF',
  'Discounts': '#6B7280',
}

const SpendTooltip = ({ active, payload }: Partial<TooltipContentProps<number, string>>) => {
  if (active && payload && payload.length) {
    const data = payload[0].payload
    return (
      <div className="bg-card p-3 rounded-lg shadow-lg border border-border">
        <p className="font-semibold text-sm mb-2">{data.name}</p>
        <div className="space-y-1 text-xs">
          <div className="flex justify-between gap-4">
            <span className="text-muted-foreground">Amount:</span>
            <span className="font-medium">{formatCurrency(data.value)}</span>
          </div>
          <div className="pt-1 mt-1 border-t border-border flex justify-between gap-4">
            <span className="text-muted-foreground">Share:</span>
            <span className="font-medium">{data.percentage.toFixed(1)}%</span>
          </div>
        </div>
      </div>
    )
  }
  return null
}

export const GuestSpendChart: React.FC<GuestSpendChartProps> = ({
  grossRevenue,
  guestFees,
  chargeComposition,
  height = 320
}) => {
  const [activeIndex, setActiveIndex] = useState<number | null>(null)

  const { chartData, totalSpend } = useMemo(() => {
    const {
      taxes, fees, discounts,
      cleaning, linens, petFees,
      creditCardFees, otherSurcharges
    } = chargeComposition

    // base rent = gross revenue minus all non-rent charges
    const baseRent = grossRevenue - taxes - cleaning - linens - petFees - creditCardFees - otherSurcharges - fees + discounts
    const total = grossRevenue + guestFees

    const segments = [
      { name: 'Base Rent', value: Math.max(0, baseRent) },
      { name: 'Taxes', value: taxes },
      { name: 'Cleaning', value: cleaning },
      { name: 'Linens', value: linens },
      { name: 'Pet Fees', value: petFees },
      { name: 'CC Fees', value: creditCardFees },
      { name: 'Booking Fees', value: fees },
      { name: 'Guest Platform Fee (est.)', value: guestFees },
      { name: 'Misc', value: otherSurcharges },
      { name: 'Discounts', value: discounts },
    ]
      .filter(s => s.value > 0)
      .sort((a, b) => b.value - a.value)
      .map(s => ({ ...s, percentage: total > 0 ? (s.value / total) * 100 : 0 }))

    return { chartData: segments, totalSpend: total }
  }, [grossRevenue, guestFees, chargeComposition])

  const handleMouseEnter = useCallback((_: unknown, index: number) => {
    setActiveIndex(index)
  }, [])

  const handleMouseLeave = useCallback(() => {
    setActiveIndex(null)
  }, [])

  if (chartData.length === 0) {
    return (
      <ChartWrapper title="Guest Spend Breakdown" height={height} noData noDataMessage="No charge data available">
        <div />
      </ChartWrapper>
    )
  }

  return (
    <ChartWrapper title="Guest Spend Breakdown" subtitle="Where the guest dollar goes" height={height} responsive={false}>
      <div style={{ height: height - 60 }}>
        <ResponsiveContainer width="100%" height="100%">
          <PieChart>
            <Pie
              data={chartData}
              cx="50%"
              cy="50%"
              innerRadius="55%"
              outerRadius="80%"
              dataKey="value"
              stroke={resolveToken('--card')}
              strokeWidth={2}
              animationBegin={0}
              animationDuration={500}
              animationEasing="ease-out"
              onMouseEnter={handleMouseEnter}
              onMouseLeave={handleMouseLeave}
            >
              {chartData.map((entry, index) => (
                <Cell
                  key={`cell-${index}`}
                  fill={SEGMENT_COLORS[entry.name] || getChartColor(index)}
                  opacity={activeIndex === null || activeIndex === index ? 1 : 0.3}
                  style={{ transition: 'opacity 0.2s ease' }}
                />
              ))}
              <Label
                content={({ viewBox }) => {
                  const { cx, cy } = viewBox as { cx: number; cy: number }
                  return (
                    <text x={cx} y={cy} textAnchor="middle" dominantBaseline="middle">
                      <tspan x={cx} y={cy - 8} className="fill-foreground text-lg font-bold">
                        {formatCompactCurrency(totalSpend)}
                      </tspan>
                      <tspan x={cx} y={cy + 12} className="fill-muted-foreground text-xs">
                        Total Spend
                      </tspan>
                    </text>
                  )
                }}
              />
            </Pie>
            <Tooltip content={<SpendTooltip />} isAnimationActive={false} />
          </PieChart>
        </ResponsiveContainer>
      </div>
      <div className="flex flex-wrap gap-3 justify-center text-xs px-4">
        {chartData.map((entry, index) => (
          <div key={entry.name} className="flex items-center gap-1.5">
            <div className="w-3 h-2.5 rounded-sm" style={{ backgroundColor: SEGMENT_COLORS[entry.name] || getChartColor(index) }} />
            <span className="text-muted-foreground">{entry.name}</span>
          </div>
        ))}
      </div>
    </ChartWrapper>
  )
}
