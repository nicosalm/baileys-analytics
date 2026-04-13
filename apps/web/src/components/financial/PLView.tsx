import React, { useMemo, useState } from 'react'
import { Link } from 'react-router-dom'
import { MetricCard } from '@/components/MetricCard'
import { StateWrapper } from '@/components/StateWrapper'
import { RevenueChart } from '@/components/charts/RevenueChart'
import { GuestSpendChart } from '@/components/charts/GuestSpendChart'
import { RevenueFlowSankey, RevenueFlowLegend } from '@/components/charts/RevenueFlowSankey'
import { ChartWrapper } from '@/components/ChartWrapper'
import { useTips } from '@/hooks/use-tips'
import { useGoalProgress } from '@/hooks/use-api'
import { getMonthlyGoalValue } from '@/utils/goals'
import {
  DollarSign, Wallet, Receipt,
  Info, Landmark, TrendingDown,
  Calendar, ArrowUp, ArrowDown, GitBranch, Download
} from 'lucide-react'
import { Button } from '@/components/ui/button'
import { authenticatedFetch } from '@/lib/api'
import { useToast } from '@/contexts/toast'
import { formatPercentage, formatCurrency, formatCompactCurrency } from '@/utils/formatters'
import { detectGranularity } from '@/utils/chart-helpers'
import { useDashboard } from '@/contexts/dashboard'

interface PlatformEntry {
  platform: string
  grossRevenue: number
}

interface MonthlyTrendEntry {
  month: string
  revenue: number
  hostFees?: number
  taxes?: number
}

interface PreviousPeriodData {
  revenue?: { gross?: number; net?: number; platformFees?: number; hostFees?: number; taxes?: number }
  operatingExpenses?: { total: number; byCategory: Record<string, number> }
  operatingProfit?: number
  monthlyTrend?: MonthlyTrendEntry[]
}

interface ChargeDetail {
  type: string
  description: string
  count: number
  total: number
}

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

interface ChargeComposition {
  taxes: number
  fees: number
  discounts: number
  cleaningAndLinens: number
  petFees: number
  creditCardFees: number
  otherSurcharges: number
  details: ChargeDetail[]
  byChannel?: {
    direct: ChannelCharges
    ota: ChannelCharges
  }
}

interface PLData {
  metrics: {
    revenue: { gross: number; net: number; platformFees: number; hostFees: number; guestFees: number; taxes: number }
    operatingExpenses: { total: number; byCategory: Record<string, number> }
    operatingProfit?: number
  }
  platforms: PlatformEntry[]
  previousPeriod?: PreviousPeriodData
  monthlyTrend: MonthlyTrendEntry[]
  chargeComposition?: ChargeComposition
  effectiveTaxRate?: number
}

interface PLViewProps {
  data: PLData | null
  loading: boolean
  onPeriodClick?: (period: string) => void
  comparisonMode?: 'none' | 'previous-period' | 'previous-year'
  comparisonDateRange?: string
}

export const PLView: React.FC<PLViewProps> = ({
  data,
  loading,
  onPeriodClick,
  comparisonMode = 'none',
  comparisonDateRange = ''
}) => {
  const { showTips } = useTips()
  const { filters, comparisonLabel } = useDashboard()
  const { addToast } = useToast()
  const { data: goalProgressData } = useGoalProgress()
  const revenueGoal = getMonthlyGoalValue(goalProgressData, 'revenue')
  const [chargesExpanded, setChargesExpanded] = useState(false)

  const handleDownloadCharges = async () => {
    try {
      const response = await authenticatedFetch(`/financial/charges-export?from=${filters.dateRange.from}&to=${filters.dateRange.to}`, {
        method: 'GET'
      })

      if (!response.ok) {
        throw new Error('Failed to download report')
      }

      const csvData = await response.text()
      const blob = new Blob([csvData], { type: 'text/csv' })
      const url = window.URL.createObjectURL(blob)
      const a = document.createElement('a')
      a.href = url
      a.download = `charge-composition-${filters.dateRange.from}-to-${filters.dateRange.to}.csv`
      document.body.appendChild(a)
      a.click()
      document.body.removeChild(a)
      window.URL.revokeObjectURL(url)
      addToast('success', 'Charge composition exported')
    } catch {
      addToast('error', 'Failed to download charge composition')
    }
  }

  const processedData = useMemo(() => {
    if (!data || !data.metrics) return null
    
    const { metrics, platforms, previousPeriod, monthlyTrend } = data
    
    // Determine granularity based on data format
    const granularity = detectGranularity(monthlyTrend as unknown as Record<string, string | number>[], 'month')
    
    // Access data exactly as the original did
    const grossRevenue = metrics.revenue?.gross || 0
    const netRevenue = metrics.revenue?.net || 0
    const platformFees = metrics.revenue?.platformFees || 0
    const hostFees = metrics.revenue?.hostFees || 0
    const guestFees = metrics.revenue?.guestFees || 0
    const taxes = metrics.revenue?.taxes || 0
    const operatingExpenses = metrics.operatingExpenses || { total: 0, byCategory: {} }
    const operatingProfit = metrics.operatingProfit ?? (netRevenue - operatingExpenses.total)
    
    const totalCosts = hostFees + operatingExpenses.total
    const operatingMargin = grossRevenue > 0
      ? ((operatingProfit / grossRevenue) * 100)
      : 0

    const profitMargin = grossRevenue > 0
      ? ((netRevenue / grossRevenue) * 100)
      : 0

    const revenueGrowth = previousPeriod?.revenue?.gross
      ? ((grossRevenue - previousPeriod.revenue.gross) / previousPeriod.revenue.gross) * 100
      : 0

    const profitGrowth = previousPeriod?.revenue?.net
      ? ((netRevenue - previousPeriod.revenue.net) / previousPeriod.revenue.net) * 100
      : 0

    const previousOperatingExpenses = previousPeriod?.operatingExpenses || { total: 0, byCategory: {} }
    const previousTotalCosts = (previousPeriod?.revenue?.hostFees || 0) + previousOperatingExpenses.total
    const costsGrowth = previousTotalCosts > 0
      ? ((totalCosts - previousTotalCosts) / previousTotalCosts) * 100
      : 0

    const previousTaxes = previousPeriod?.revenue?.taxes || 0
    const taxesGrowth = previousTaxes > 0
      ? ((taxes - previousTaxes) / previousTaxes) * 100
      : 0

    const previousOperatingProfit = previousPeriod?.operatingProfit ?? ((previousPeriod?.revenue?.net || 0) - previousOperatingExpenses.total)
    const operatingProfitGrowth = previousOperatingProfit > 0
      ? ((operatingProfit - previousOperatingProfit) / previousOperatingProfit) * 100
      : 0

    const prevGross = previousPeriod?.revenue?.gross ?? 0
    const prevNet = previousPeriod?.revenue?.net ?? 0
    const previousProfitMargin = prevGross > 0
      ? ((prevNet / prevGross) * 100)
      : 0

    const profitMarginChange = previousProfitMargin > 0
      ? profitMargin - previousProfitMargin
      : 0
    
    const platformData = platforms?.map((p: PlatformEntry) => ({
      name: p.platform || 'Unassigned',
      revenue: p.grossRevenue || 0,
      percentage: grossRevenue > 0 ? (p.grossRevenue / grossRevenue) * 100 : 0
    })) || []
    
    const prevTrendMap = new Map(
      (previousPeriod?.monthlyTrend as MonthlyTrendEntry[] | undefined)?.map(pm => [pm.month, pm]) ?? []
    )
    const monthlyData = monthlyTrend?.map((m: MonthlyTrendEntry, index: number) => {
      const prevData = prevTrendMap.get(m.month) || previousPeriod?.monthlyTrend?.[index]
      
      const monthRevenue = m.revenue || 0
      const monthFees = m.hostFees ?? (monthRevenue * (hostFees / Math.max(grossRevenue, 1)))
      const monthTaxes = m.taxes ?? (monthRevenue * (taxes / Math.max(grossRevenue, 1)))
      const monthProfit = monthRevenue - monthFees - monthTaxes
      
      return {
        month: m.month,
        revenue: monthRevenue,
        platformFees: monthFees,
        taxes: monthTaxes,
        profit: monthProfit,
        costs: monthFees + monthTaxes,
        previousRevenue: prevData ? (prevData.revenue || 0) : undefined,
        previousProfit: prevData ? (() => {
          const pr = prevData.revenue || 0
          const pf = prevData.hostFees ?? (pr * (hostFees / Math.max(grossRevenue, 1)))
          const pt = prevData.taxes ?? (pr * (taxes / Math.max(grossRevenue, 1)))
          return pr - pf - pt
        })() : undefined
      }
    }) || []
    
    // aggregate trend entries to actual months before computing highlights
    // (trend data can be daily or weekly, but best/lowest should be per-month)
    const monthAgg = new Map<string, number>()
    for (const m of monthlyData) {
      const monthKey = m.month.substring(0, 7)
      monthAgg.set(monthKey, (monthAgg.get(monthKey) || 0) + (m.revenue || 0))
    }
    const monthEntries = Array.from(monthAgg.entries()).map(([month, revenue]) => ({ month, revenue }))
    const monthRevenues = monthEntries.map(m => m.revenue)
    const avgMonthlyRevenue = monthRevenues.length > 0
      ? monthRevenues.reduce((sum, r) => sum + r, 0) / monthRevenues.length
      : 0
    const bestMonthValue = monthRevenues.length > 0 ? Math.max(...monthRevenues) : 0
    const lowestMonthValue = monthRevenues.length > 0 ? Math.min(...monthRevenues) : 0
    const bestMonth = monthEntries.find(m => m.revenue === bestMonthValue)
    const lowestMonth = monthEntries.find(m => m.revenue === lowestMonthValue)

    const formatMonthLabel = (month?: string) => {
      if (!month) return undefined
      const parts = month.split('-')
      if (parts.length < 2) return month
      return new Date(parseInt(parts[0]), parseInt(parts[1]) - 1).toLocaleDateString('en-US', { month: 'long', year: 'numeric' })
    }

    return {
      revenue: {
        gross: grossRevenue,
        net: netRevenue,
        platformFees,
        hostFees,
        guestFees,
        taxes,
        operatingExpenses,
        operatingProfit,
        totalCosts
      },
      profitability: {
        marginPercent: profitMargin,
        operatingMargin
      },
      comparison: {
        revenueGrowth,
        profitGrowth,
        costsGrowth,
        taxesGrowth,
        operatingProfitGrowth,
        profitMarginChange,
        previousRevenue: previousPeriod?.revenue?.gross || 0,
        previousProfit: previousPeriod?.revenue?.net || 0,
        previousTotalCosts,
        previousTaxes,
        previousOperatingProfit,
        previousProfitMargin,
        periodLabel: comparisonLabel ? `vs ${comparisonLabel}` : '',
        hasComparison: comparisonMode !== 'none' && previousPeriod && monthlyData.some(m => m.previousRevenue !== undefined)
      },
      platforms: platformData,
      monthly: monthlyData,
      granularity,
      highlights: {
        avgMonthlyRevenue,
        bestMonthValue,
        bestMonthLabel: formatMonthLabel(bestMonth?.month),
        lowestMonthValue,
        lowestMonthLabel: formatMonthLabel(lowestMonth?.month),
        monthCount: monthEntries.length
      }
    }
  }, [data, comparisonMode, comparisonLabel])
  
  if (loading || !processedData) {
    return (
      <StateWrapper
        loading={loading}
        error={null}
        empty={!data && !loading}
        loadingMessage="Loading profit & loss data..."
        emptyMessage="No financial data available"
        emptySubMessage="Select a date range to view your P&L"
        minHeight={300}
      >
        <div />
      </StateWrapper>
    )
  }
  
  const { revenue, profitability, comparison, platforms, monthly, granularity, highlights } = processedData
  
  return (
    <div className="space-y-6">
      {showTips && (
        <div className="bg-info-subtle border border-info/30 rounded-lg p-4">
          <div className="flex items-start">
            <Info className="w-5 h-5 text-info mr-2 mt-0.5" />
            <div className="text-sm text-info-fg">
              <strong>P&L Summary:</strong> Revenue → Host Fees → Taxes{revenue.operatingExpenses.total > 0 ? ' → Operating Expenses' : ''} → {revenue.operatingExpenses.total > 0 ? 'Operating Profit' : 'Net Revenue'}. Guest platform fees are shown for reference but not deducted.{' '}
              {revenue.operatingExpenses.total > 0
                ? `Operating margin: ${formatPercentage(profitability.operatingMargin, 1)}.`
                : <>Configure <Link to="/settings?tab=expenses" className="underline hover:text-info-fg">Expenses</Link> in Settings for a complete picture.</>}
            </div>
          </div>
        </div>
      )}
      
      <div className="grid grid-cols-2 md:grid-cols-4 gap-3 md:gap-4">
        <MetricCard
          icon={DollarSign}
          label="Total Revenue"
          value={revenue.gross}
          format="currency"
          tooltip="Gross revenue before fees, taxes, and expenses"
          color="blue"
          subValue={comparisonMode !== 'none' && comparison.previousRevenue > 0
            ? <>{comparison.periodLabel}: {formatCurrency(comparison.previousRevenue)}{comparisonDateRange && <span className="block text-xs text-muted-foreground/70 mt-0.5">{comparisonDateRange}</span>}</>
            : `${platforms.length} platform${platforms.length !== 1 ? 's' : ''}`}
          trend={comparisonMode !== 'none' && comparison.previousRevenue > 0 ? {
            value: comparison.revenueGrowth,
            isPositive: comparison.revenueGrowth > 0
          } : undefined}
          staggerIndex={0}
        />
        <MetricCard
          icon={Receipt}
          label={revenue.operatingExpenses.total > 0 ? "Host Fees & Expenses" : "Host Commission"}
          value={revenue.totalCosts}
          format="currency"
          tooltip="Host platform fees (deducted from revenue) plus operating expenses. Guest platform fees are billed separately and do not affect owner revenue."
          color="orange"
          subValue={comparisonMode !== 'none' && comparison.previousTotalCosts > 0
            ? <>{comparison.periodLabel}: {formatCurrency(comparison.previousTotalCosts)}{comparisonDateRange && <span className="block text-xs text-muted-foreground/70 mt-0.5">{comparisonDateRange}</span>}</>
            : revenue.operatingExpenses.total > 0
            ? `Host fees: ${formatCurrency(revenue.hostFees)} | Expenses: ${formatCurrency(revenue.operatingExpenses.total)}`
            : `Guest platform fee (est.): ${formatCompactCurrency(revenue.guestFees)} (not deducted)`}
          trend={comparisonMode !== 'none' && comparison.costsGrowth !== 0 ? {
            value: comparison.costsGrowth,
            isPositive: comparison.costsGrowth < 0
          } : undefined}
          staggerIndex={1}
        />
        <MetricCard
          icon={Landmark}
          label="Taxes"
          value={revenue.taxes}
          format="currency"
          tooltip="Occupancy and lodging taxes collected"
          color="yellow"
          subValue={comparisonMode !== 'none' && comparison.previousTaxes > 0
            ? <>{comparison.periodLabel}: {formatCurrency(comparison.previousTaxes)}{comparisonDateRange && <span className="block text-xs text-muted-foreground/70 mt-0.5">{comparisonDateRange}</span>}</>
            : `${formatPercentage(data?.effectiveTaxRate ?? (revenue.gross > 0 ? (revenue.taxes / revenue.gross) * 100 : 0), 1)} effective rate`}
          trend={comparisonMode !== 'none' && comparison.taxesGrowth !== 0 ? {
            value: comparison.taxesGrowth,
            isPositive: comparison.taxesGrowth < 0
          } : undefined}
          staggerIndex={2}
        />
        <MetricCard
          icon={Wallet}
          label={revenue.operatingExpenses.total > 0 ? "Operating Profit" : "Net Revenue"}
          value={revenue.operatingProfit}
          format="currency"
          tooltip={revenue.operatingExpenses.total > 0
            ? "Net after fees, taxes, and operating expenses"
            : "Net after fees and taxes"}
          color={profitability.operatingMargin > 70 ? 'green' : profitability.operatingMargin > 50 ? 'yellow' : 'red'}
          subValue={comparisonMode !== 'none' && comparison.previousOperatingProfit > 0
            ? <>{comparison.periodLabel}: {formatCurrency(comparison.previousOperatingProfit)}{comparisonDateRange && <span className="block text-xs text-muted-foreground/70 mt-0.5">{comparisonDateRange}</span>}</>
            : `${formatPercentage(profitability.operatingMargin, 1)} margin${revenue.operatingExpenses.total === 0 ? ' (excl. expenses)' : ''}`}
          trend={comparisonMode !== 'none' && comparison.operatingProfitGrowth !== 0 ? {
            value: comparison.operatingProfitGrowth,
            isPositive: comparison.operatingProfitGrowth > 0
          } : undefined}
          staggerIndex={3}
        />
      </div>

      {/* P&L Chart - Direct without wrapper */}
      <RevenueChart
        data={monthly}
        title={`${granularity} Profit & Loss Trend`}
        subtitle={comparison.hasComparison
          ? `Comparing with ${comparisonLabel}`
          : undefined
        }
        showProfit={true}
        showComparison={comparison.hasComparison}
        comparisonLabel={comparisonLabel}
        onPeriodClick={onPeriodClick}
        height={360}
        revenueGoal={revenueGoal}
      />

      {/* Revenue highlights — summarize the trend above */}
      {highlights.monthCount > 1 && (
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 md:gap-4">
          <MetricCard
            icon={Calendar}
            label="Monthly Average"
            value={highlights.avgMonthlyRevenue}
            format="currency"
            color="gray"
            size="sm"
            subValue={`${highlights.monthCount} months`}
            staggerIndex={4}
          />
          <MetricCard
            icon={ArrowUp}
            label="Best Month"
            value={highlights.bestMonthValue}
            format="currency"
            color="gray"
            size="sm"
            subValue={highlights.bestMonthLabel}
            staggerIndex={5}
          />
          <MetricCard
            icon={ArrowDown}
            label="Lowest Month"
            value={highlights.lowestMonthValue}
            format="currency"
            color="gray"
            size="sm"
            subValue={highlights.lowestMonthLabel}
            staggerIndex={6}
          />
        </div>
      )}

      {/* Revenue Flow Sankey */}
      {platforms.length > 0 && (
        <ChartWrapper
          title="Revenue Flow"
          subtitle="Where your revenue comes from and where it goes"
          icon={GitBranch}
          height={Math.max(360, platforms.length * 50 + 100)}
          responsive={false}
        >
          <div className="h-full flex flex-col">
            <div className="flex-1">
              <RevenueFlowSankey
                data={{
                  platforms: platforms.map(p => ({ platform: p.name, grossRevenue: p.revenue })),
                  hostFees: revenue.hostFees,
                  guestFees: revenue.guestFees,
                  taxes: revenue.taxes,
                  operatingExpenses: revenue.operatingExpenses,
                  grossRevenue: revenue.gross,
                  netRevenue: revenue.net,
                  operatingProfit: revenue.operatingProfit,
                }}
              />
            </div>
            <RevenueFlowLegend hasOpex={revenue.operatingExpenses.total > 0} />
          </div>
        </ChartWrapper>
      )}

      {/* Guest Spend Breakdown + Charge Composition */}
      {data?.chargeComposition && data.chargeComposition.details.length > 0 && (
        <div className="grid lg:grid-cols-3 gap-6">
          <div>
            <GuestSpendChart
              grossRevenue={revenue.gross}
              guestFees={revenue.guestFees}
              chargeComposition={data.chargeComposition}
              byChannel={data.chargeComposition.byChannel}
            />
          </div>
          <div className="lg:col-span-2 bg-card rounded-lg shadow-sm border p-6">
            <div className="flex items-start justify-between mb-4">
              <div>
                <h4 className="font-semibold text-foreground mb-1">Booking Charge Composition</h4>
                <p className="text-sm text-muted-foreground">Itemized charges from booking data, excluding base rent</p>
              </div>
              <Button variant="ghost" size="sm" onClick={handleDownloadCharges} className="text-muted-foreground hover:text-foreground">
                <Download className="w-4 h-4" />
                Export
              </Button>
            </div>
            <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-4">
              {data.chargeComposition.taxes > 0 && (
                <div className="bg-info-subtle rounded-lg p-3">
                  <div className="text-xs text-info font-medium">Taxes</div>
                  <div className="text-lg font-bold text-info-fg">{formatCurrency(data.chargeComposition.taxes)}</div>
                </div>
              )}
              {data.chargeComposition.cleaningAndLinens > 0 && (
                <div className="bg-purple-500/10 rounded-lg p-3">
                  <div className="text-xs text-purple-600 dark:text-purple-400 font-medium">Cleaning & Linens</div>
                  <div className="text-lg font-bold text-foreground">{formatCurrency(data.chargeComposition.cleaningAndLinens)}</div>
                </div>
              )}
              {data.chargeComposition.petFees > 0 && (
                <div className="bg-amber-500/10 rounded-lg p-3">
                  <div className="text-xs text-amber-600 dark:text-amber-400 font-medium">Pet Fees</div>
                  <div className="text-lg font-bold text-foreground">{formatCurrency(data.chargeComposition.petFees)}</div>
                </div>
              )}
              {data.chargeComposition.creditCardFees > 0 && (
                <div className="bg-orange-500/10 rounded-lg p-3">
                  <div className="text-xs text-orange-600 dark:text-orange-400 font-medium">CC Fees</div>
                  <div className="text-lg font-bold text-foreground">{formatCurrency(data.chargeComposition.creditCardFees)}</div>
                </div>
              )}
              {data.chargeComposition.discounts !== 0 && (
                <div className="bg-success-subtle rounded-lg p-3">
                  <div className="text-xs text-success font-medium">Discounts</div>
                  <div className="text-lg font-bold text-success-fg">-{formatCurrency(Math.abs(data.chargeComposition.discounts))}</div>
                </div>
              )}
              {data.chargeComposition.otherSurcharges > 0 && (
                <div className="bg-muted/30 rounded-lg p-3">
                  <div className="text-xs text-muted-foreground font-medium">Other</div>
                  <div className="text-lg font-bold text-foreground">{formatCurrency(data.chargeComposition.otherSurcharges)}</div>
                </div>
              )}
            </div>
            <div className="space-y-2">
              {(chargesExpanded ? data.chargeComposition.details : data.chargeComposition.details.slice(0, 10)).map((detail: ChargeDetail, i: number) => (
                <div key={i} className="flex justify-between items-center text-sm py-1 border-b border-border/60 last:border-0 gap-2">
                  <span className="text-muted-foreground flex items-center gap-2 min-w-0">
                    <span className={`w-2 h-2 rounded-full shrink-0 ${
                      detail.type === 'tax' ? 'bg-info' :
                      detail.type === 'fee' ? 'bg-warning' :
                      detail.type === 'discount' ? 'bg-success' :
                      detail.type === 'cleaning' ? 'bg-purple-500' :
                      detail.type === 'pet' ? 'bg-amber-500' :
                      detail.type === 'credit_card' ? 'bg-orange-500' :
                      'bg-muted-foreground'
                    }`} />
                    <span className="truncate">{detail.description}</span>
                    <span className="text-xs text-muted-foreground shrink-0">({detail.count})</span>
                  </span>
                  <span className={`font-medium shrink-0 ${detail.type === 'discount' ? 'text-success' : ''}`}>
                    {detail.type === 'discount' ? '-' : ''}{formatCurrency(Math.abs(detail.total))}
                  </span>
                </div>
              ))}
              {data.chargeComposition.details.length > 10 && (
                <button
                  onClick={() => setChargesExpanded(!chargesExpanded)}
                  className="text-xs text-primary hover:text-primary/80 transition-colors pt-1 cursor-pointer"
                >
                  {chargesExpanded
                    ? 'Show less'
                    : `Show all ${data.chargeComposition.details.length} charge types`
                  }
                </button>
              )}
            </div>
            <p className="text-xs text-muted-foreground/60 mt-4 pt-3 border-t border-border/40">
              Data sourced from OwnerRez. Counts may differ between tax types if a charge is missing in the source system.
            </p>
          </div>
        </div>
      )}

      {showTips && profitability.operatingMargin < 60 && (
        <div className="bg-warning-subtle border border-warning/30 rounded-lg p-4">
          <div className="flex items-start">
            <TrendingDown className="w-5 h-5 text-warning mr-2 mt-0.5" />
            <div className="text-sm text-warning-fg">
              <strong>Low Margin:</strong> Operating margin is {formatPercentage(profitability.operatingMargin, 1)}. Review platform fees or increase direct bookings to improve.
            </div>
          </div>
        </div>
      )}
    </div>
  )
}