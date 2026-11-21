import type React from 'react'
import { useState, useCallback, useMemo } from 'react'
import { PieChart, Pie, Cell, Tooltip, ResponsiveContainer, Label } from 'recharts'
import type { TooltipContentProps } from 'recharts'
import { ChartWrapper } from '@/components/ChartWrapper'
import { Button } from '@/components/ui/button'
import { getChartColor, getChargeColor, type ChargeKind, resolveToken } from '@/lib/theme'
import { formatCurrency, formatCompactCurrency } from '@baileys/utils'

interface ChannelCharges {
  taxes: number
  fees: number
  discounts: number
  cleaningAndLinens: number
  petFees: number
  creditCardFees: number
  otherSurcharges: number
  grossRevenue: number
  guestFees: number
}

interface GuestSpendChartProps {
  grossRevenue: number
  guestFees: number
  chargeComposition: {
    taxes: number
    fees: number
    discounts: number
    cleaningAndLinens: number
    petFees: number
    creditCardFees: number
    otherSurcharges: number
  }
  byChannel?: {
    direct: ChannelCharges
    ota: ChannelCharges
  }
}

type ChannelFilter = 'all' | 'direct' | 'ota'

const SEGMENT_KINDS: Record<string, ChargeKind> = {
  'Base Rent': 'rent',
  Taxes: 'tax',
  'Cleaning & Linens': 'cleaning',
  'Pet Fees': 'pet',
  'CC Fees': 'credit_card',
  'Host Fees': 'host_fee',
  'Guest Fees': 'guest_fee',
  Discounts: 'discount',
  Other: 'other',
}

const segmentColor = (name: string, index: number) => (SEGMENT_KINDS[name] ? getChargeColor(SEGMENT_KINDS[name]) : getChartColor(index))

const CHANNEL_OPTIONS: { key: ChannelFilter; label: string }[] = [
  { key: 'all', label: 'All' },
  { key: 'direct', label: 'Direct' },
  { key: 'ota', label: 'Platforms' },
]

const SpendTooltip = ({ active, payload }: Partial<TooltipContentProps<number, string>>) => {
  if (active && payload?.length) {
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

export const GuestSpendChart: React.FC<GuestSpendChartProps> = ({ grossRevenue, guestFees, chargeComposition, byChannel }) => {
  const [activeIndex, setActiveIndex] = useState<number | null>(null)
  const [channel, setChannel] = useState<ChannelFilter>('all')

  const { chartData, totalSpend } = useMemo(() => {
    let comp: typeof chargeComposition
    let gross: number
    let guest: number

    if (channel === 'all' || !byChannel) {
      comp = chargeComposition
      gross = grossRevenue
      guest = guestFees
    } else {
      const ch = byChannel[channel]
      comp = ch
      gross = ch.grossRevenue
      guest = ch.guestFees
    }

    const { taxes, fees, discounts, cleaningAndLinens, petFees, creditCardFees, otherSurcharges } = comp

    const baseRent = gross - taxes - cleaningAndLinens - petFees - creditCardFees - otherSurcharges - fees + discounts
    const total = gross + guest

    const segments = [
      { name: 'Base Rent', value: Math.max(0, baseRent) },
      { name: 'Taxes', value: taxes },
      { name: 'Cleaning & Linens', value: cleaningAndLinens },
      { name: 'Pet Fees', value: petFees },
      { name: 'CC Fees', value: creditCardFees },
      { name: 'Host Fees', value: fees },
      { name: 'Guest Fees', value: guest },
      { name: 'Other', value: otherSurcharges },
      { name: 'Discounts', value: discounts },
    ]
      .filter((s) => s.value > 0)
      .sort((a, b) => b.value - a.value)
      .map((s) => ({ ...s, percentage: total > 0 ? (s.value / total) * 100 : 0 }))

    return { chartData: segments, totalSpend: total }
  }, [grossRevenue, guestFees, chargeComposition, byChannel, channel])

  const handleMouseEnter = useCallback((_: unknown, index: number) => {
    setActiveIndex(index)
  }, [])

  const handleMouseLeave = useCallback(() => {
    setActiveIndex(null)
  }, [])

  const channelToggle = byChannel && (
    <div className="flex items-center gap-1 bg-muted p-1 rounded-lg">
      {CHANNEL_OPTIONS.map((opt) => (
        <Button
          key={opt.key}
          variant="ghost"
          size="sm"
          onClick={() => setChannel(opt.key)}
          className={`h-7 px-2.5 text-xs ${channel === opt.key ? 'bg-card text-foreground shadow-sm' : 'text-muted-foreground hover:text-foreground'}`}
        >
          {opt.label}
        </Button>
      ))}
    </div>
  )

  if (chartData.length === 0) {
    return (
      <ChartWrapper
        title="Guest Spend Breakdown"
        height={260}
        controls={channelToggle}
        noData
        noDataMessage="No charge data for this channel"
      >
        <div />
      </ChartWrapper>
    )
  }

  return (
    <ChartWrapper title="Guest Spend Breakdown" subtitle="Per guest dollar" height="auto" responsive={false} controls={channelToggle}>
      <div style={{ height: 260 }}>
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
                  fill={segmentColor(entry.name, index)}
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
      <div className="flex flex-wrap gap-x-3 gap-y-1 justify-center text-xs px-4 pt-2 pb-1">
        {chartData.map((entry, index) => (
          <div key={entry.name} className="flex items-center gap-1.5">
            <div className="w-3 h-2.5 rounded-sm flex-shrink-0" style={{ backgroundColor: segmentColor(entry.name, index) }} />
            <span className="text-muted-foreground whitespace-nowrap">{entry.name}</span>
          </div>
        ))}
      </div>
    </ChartWrapper>
  )
}
