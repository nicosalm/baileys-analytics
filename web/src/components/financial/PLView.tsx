import type React from 'react'
import { useMemo, useState } from 'react'
import { MetricCard } from '@/components/MetricCard'
import { StateWrapper } from '@/components/StateWrapper'
import { RevenueChart } from '@/components/charts/RevenueChart'
import { GuestSpendChart } from '@/components/charts/GuestSpendChart'
import { RevenueFlowSankey, RevenueFlowLegend } from '@/components/charts/RevenueFlowSankey'
import { ChartWrapper } from '@/components/ChartWrapper'
import { useGoalProgress } from '@/hooks/use-api'
import { getMonthlyGoalValue } from '@/utils/goals'
import { Download } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { authenticatedFetch } from '@/lib/api'
import { getChargeColor, type ChargeKind } from '@/lib/theme'
import { useToast } from '@/contexts/toast'
import { downloadCsv } from '@/utils/csv'
import { formatPercentage, formatCurrency, formatCompactCurrency } from '@/utils/formatters'
import { detectGranularity } from '@/utils/chart-helpers'
import { useDashboard } from '@/contexts/dashboard'
import { METRIC_DEFINITIONS } from '@/lib/metric-definitions'

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

const DETAIL_KINDS: Record<string, ChargeKind> = {
  tax: 'tax',
  fee: 'host_fee',
  discount: 'discount',
  cleaning: 'cleaning',
  pet: 'pet',
  credit_card: 'credit_card',
}

const chargeKindFor = (type: string): ChargeKind => DETAIL_KINDS[type] ?? 'other'

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

export const PLView: React.FC<PLViewProps> = ({ data, loading, onPeriodClick, comparisonMode = 'none', comparisonDateRange = '' }) => {
  const { filters, comparisonLabel } = useDashboard()
  const { addToast } = useToast()
  const { data: goalProgressData } = useGoalProgress()
  const revenueGoal = getMonthlyGoalValue(goalProgressData, 'revenue')
  const [chargesExpanded, setChargesExpanded] = useState(false)

  const handleDownloadCharges = async () => {
    try {
      const response = await authenticatedFetch(`/financial/charges-export?from=${filters.dateRange.from}&to=${filters.dateRange.to}`, {
        method: 'GET',
      })

      if (!response.ok) {
        throw new Error('Failed to download report')
      }

      downloadCsv(`charge-composition-${filters.dateRange.from}-to-${filters.dateRange.to}.csv`, await response.text())
      addToast('success', 'Charge composition exported')
    } catch {
      addToast('error', 'Failed to download charge composition')
    }
  }

  const processedData = useMemo(() => {
    if (!data?.metrics) return null

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
    const operatingProfit = metrics.operatingProfit ?? netRevenue - operatingExpenses.total

    const totalCosts = hostFees + operatingExpenses.total
    const operatingMargin = grossRevenue > 0 ? (operatingProfit / grossRevenue) * 100 : 0

    const profitMargin = grossRevenue > 0 ? (netRevenue / grossRevenue) * 100 : 0

    const revenueGrowth = previousPeriod?.revenue?.gross
      ? ((grossRevenue - previousPeriod.revenue.gross) / previousPeriod.revenue.gross) * 100
      : 0

    const profitGrowth = previousPeriod?.revenue?.net ? ((netRevenue - previousPeriod.revenue.net) / previousPeriod.revenue.net) * 100 : 0

    const previousOperatingExpenses = previousPeriod?.operatingExpenses || { total: 0, byCategory: {} }
    const previousTotalCosts = (previousPeriod?.revenue?.hostFees || 0) + previousOperatingExpenses.total
    const costsGrowth = previousTotalCosts > 0 ? ((totalCosts - previousTotalCosts) / previousTotalCosts) * 100 : 0

    const previousTaxes = previousPeriod?.revenue?.taxes || 0
    const taxesGrowth = previousTaxes > 0 ? ((taxes - previousTaxes) / previousTaxes) * 100 : 0

    const previousOperatingProfit = previousPeriod?.operatingProfit ?? (previousPeriod?.revenue?.net || 0) - previousOperatingExpenses.total
    const operatingProfitGrowth =
      previousOperatingProfit > 0 ? ((operatingProfit - previousOperatingProfit) / previousOperatingProfit) * 100 : 0

    const prevGross = previousPeriod?.revenue?.gross ?? 0
    const prevNet = previousPeriod?.revenue?.net ?? 0
    const previousProfitMargin = prevGross > 0 ? (prevNet / prevGross) * 100 : 0

    const profitMarginChange = previousProfitMargin > 0 ? profitMargin - previousProfitMargin : 0

    const platformData =
      platforms?.map((p: PlatformEntry) => ({
        name: p.platform || 'Unassigned',
        revenue: p.grossRevenue || 0,
        percentage: grossRevenue > 0 ? (p.grossRevenue / grossRevenue) * 100 : 0,
      })) || []

    const prevTrendMap = new Map((previousPeriod?.monthlyTrend as MonthlyTrendEntry[] | undefined)?.map((pm) => [pm.month, pm]) ?? [])
    const monthlyData =
      monthlyTrend?.map((m: MonthlyTrendEntry, index: number) => {
        const prevData = prevTrendMap.get(m.month) || previousPeriod?.monthlyTrend?.[index]

        const monthRevenue = m.revenue || 0
        const monthFees = m.hostFees ?? monthRevenue * (hostFees / Math.max(grossRevenue, 1))
        const monthTaxes = m.taxes ?? monthRevenue * (taxes / Math.max(grossRevenue, 1))
        const monthProfit = monthRevenue - monthFees - monthTaxes

        return {
          month: m.month,
          revenue: monthRevenue,
          platformFees: monthFees,
          taxes: monthTaxes,
          profit: monthProfit,
          costs: monthFees + monthTaxes,
          previousRevenue: prevData ? prevData.revenue || 0 : undefined,
          previousProfit: prevData
            ? (() => {
                const pr = prevData.revenue || 0
                const pf = prevData.hostFees ?? pr * (hostFees / Math.max(grossRevenue, 1))
                const pt = prevData.taxes ?? pr * (taxes / Math.max(grossRevenue, 1))
                return pr - pf - pt
              })()
            : undefined,
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
    const monthRevenues = monthEntries.map((m) => m.revenue)
    const avgMonthlyRevenue = monthRevenues.length > 0 ? monthRevenues.reduce((sum, r) => sum + r, 0) / monthRevenues.length : 0
    const bestMonthValue = monthRevenues.length > 0 ? Math.max(...monthRevenues) : 0
    const lowestMonthValue = monthRevenues.length > 0 ? Math.min(...monthRevenues) : 0
    const bestMonth = monthEntries.find((m) => m.revenue === bestMonthValue)
    const lowestMonth = monthEntries.find((m) => m.revenue === lowestMonthValue)

    const formatMonthLabel = (month?: string) => {
      if (!month) return undefined
      const parts = month.split('-')
      if (parts.length < 2) return month
      return new Date(parseInt(parts[0], 10), parseInt(parts[1], 10) - 1).toLocaleDateString('en-US', { month: 'long', year: 'numeric' })
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
        totalCosts,
      },
      profitability: {
        marginPercent: profitMargin,
        operatingMargin,
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
        hasComparison: comparisonMode !== 'none' && previousPeriod && monthlyData.some((m) => m.previousRevenue !== undefined),
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
        monthCount: monthEntries.length,
      },
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
      <div className="grid grid-cols-2 md:grid-cols-4 gap-3 md:gap-4">
        <MetricCard
          label="Total Revenue"
          value={revenue.gross}
          format="currency"
          tooltip={METRIC_DEFINITIONS.revenue}
          subValue={
            comparisonMode !== 'none' && comparison.previousRevenue > 0 ? (
              <>
                {comparison.periodLabel}: {formatCurrency(comparison.previousRevenue)}
                {comparisonDateRange && <span className="block text-xs text-muted-foreground/70 mt-0.5">{comparisonDateRange}</span>}
              </>
            ) : (
              `${platforms.length} platform${platforms.length !== 1 ? 's' : ''}`
            )
          }
          trend={
            comparisonMode !== 'none' && comparison.previousRevenue > 0
              ? {
                  value: comparison.revenueGrowth,
                  isPositive: comparison.revenueGrowth > 0,
                }
              : undefined
          }
          staggerIndex={0}
        />
        <MetricCard
          label={revenue.operatingExpenses.total > 0 ? 'Host Fees & Expenses' : 'Host Commission'}
          value={revenue.totalCosts}
          format="currency"
          tooltip={METRIC_DEFINITIONS.costs}
          subValue={
            comparisonMode !== 'none' && comparison.previousTotalCosts > 0 ? (
              <>
                {comparison.periodLabel}: {formatCurrency(comparison.previousTotalCosts)}
                {comparisonDateRange && <span className="block text-xs text-muted-foreground/70 mt-0.5">{comparisonDateRange}</span>}
              </>
            ) : revenue.operatingExpenses.total > 0 ? (
              `Host fees: ${formatCurrency(revenue.hostFees)} · Expenses: ${formatCurrency(revenue.operatingExpenses.total)}`
            ) : (
              `Guest platform fee (est.): ${formatCompactCurrency(revenue.guestFees)} (not deducted)`
            )
          }
          trend={
            comparisonMode !== 'none' && comparison.costsGrowth !== 0
              ? {
                  value: comparison.costsGrowth,
                  isPositive: comparison.costsGrowth < 0,
                }
              : undefined
          }
          staggerIndex={1}
        />
        <MetricCard
          label="Taxes"
          value={revenue.taxes}
          format="currency"
          tooltip={METRIC_DEFINITIONS.taxCollected}
          subValue={
            comparisonMode !== 'none' && comparison.previousTaxes > 0 ? (
              <>
                {comparison.periodLabel}: {formatCurrency(comparison.previousTaxes)}
                {comparisonDateRange && <span className="block text-xs text-muted-foreground/70 mt-0.5">{comparisonDateRange}</span>}
              </>
            ) : (
              `${formatPercentage(data?.effectiveTaxRate ?? (revenue.gross > 0 ? (revenue.taxes / revenue.gross) * 100 : 0), 1)} effective rate`
            )
          }
          trend={
            comparisonMode !== 'none' && comparison.taxesGrowth !== 0
              ? {
                  value: comparison.taxesGrowth,
                  isPositive: comparison.taxesGrowth > 0,
                }
              : undefined
          }
          staggerIndex={2}
        />
        <MetricCard
          label={revenue.operatingExpenses.total > 0 ? 'Operating Profit' : 'Net Revenue'}
          value={revenue.operatingProfit}
          format="currency"
          tooltip={revenue.operatingExpenses.total > 0 ? METRIC_DEFINITIONS.operatingProfit : METRIC_DEFINITIONS.netRevenue}
          tone={profitability.operatingMargin < 0 ? 'negative' : undefined}
          subValue={
            comparisonMode !== 'none' && comparison.previousOperatingProfit > 0 ? (
              <>
                {comparison.periodLabel}: {formatCurrency(comparison.previousOperatingProfit)}
                {comparisonDateRange && <span className="block text-xs text-muted-foreground/70 mt-0.5">{comparisonDateRange}</span>}
              </>
            ) : (
              `${formatPercentage(profitability.operatingMargin, 1)} margin${revenue.operatingExpenses.total === 0 ? ' (excl. expenses)' : ''}`
            )
          }
          trend={
            comparisonMode !== 'none' && comparison.operatingProfitGrowth !== 0
              ? {
                  value: comparison.operatingProfitGrowth,
                  isPositive: comparison.operatingProfitGrowth > 0,
                }
              : undefined
          }
          staggerIndex={3}
        />
      </div>

      {/* P&L Chart - Direct without wrapper */}
      <RevenueChart
        data={monthly}
        title={`${granularity} Profit & Loss Trend`}
        subtitle={comparison.hasComparison ? `Comparing with ${comparisonLabel}` : undefined}
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
            label="Monthly Average"
            value={highlights.avgMonthlyRevenue}
            format="currency"
            size="sm"
            subValue={`${highlights.monthCount} months`}
            staggerIndex={4}
          />
          <MetricCard
            label="Best Month"
            value={highlights.bestMonthValue}
            format="currency"
            size="sm"
            subValue={highlights.bestMonthLabel}
            staggerIndex={5}
          />
          <MetricCard
            label="Lowest Month"
            value={highlights.lowestMonthValue}
            format="currency"
            size="sm"
            subValue={highlights.lowestMonthLabel}
            staggerIndex={6}
          />
        </div>
      )}

      {/* Revenue Flow Sankey */}
      {platforms.length > 0 && (
        <ChartWrapper title="Revenue Flow" height={Math.max(360, platforms.length * 50 + 100)} responsive={false}>
          {/* a flow diagram can't compress below this width; the wrapper scrolls instead */}
          <div className="h-full flex flex-col min-w-[640px]">
            <div className="flex-1">
              <RevenueFlowSankey
                data={{
                  platforms: platforms.map((p) => ({ platform: p.name, grossRevenue: p.revenue })),
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
            <div className="grid grid-cols-[repeat(auto-fit,minmax(8.5rem,1fr))] gap-3 mb-4">
              {(
                [
                  ['tax', 'Taxes', data.chargeComposition.taxes],
                  ['cleaning', 'Cleaning & Linens', data.chargeComposition.cleaningAndLinens],
                  ['pet', 'Pet Fees', data.chargeComposition.petFees],
                  ['credit_card', 'CC Fees', data.chargeComposition.creditCardFees],
                  ['discount', 'Discounts', data.chargeComposition.discounts],
                  ['other', 'Other', data.chargeComposition.otherSurcharges],
                ] as const
              )
                .filter(([, , amount]) => amount !== 0)
                .map(([kind, label, amount]) => (
                  <div key={kind} className="rounded-lg border border-border/60 bg-muted/30 p-3">
                    <div className="flex items-center gap-1.5 text-xs font-medium text-muted-foreground">
                      <span className="w-2 h-2 rounded-full" style={{ backgroundColor: getChargeColor(kind) }} />
                      {label}
                    </div>
                    <div className="mt-1 text-lg font-semibold tabular-nums text-foreground">
                      {kind === 'discount' ? `-${formatCurrency(Math.abs(amount))}` : formatCurrency(amount)}
                    </div>
                  </div>
                ))}
            </div>
            <div className="space-y-2">
              {(chargesExpanded ? data.chargeComposition.details : data.chargeComposition.details.slice(0, 10)).map(
                (detail: ChargeDetail, i: number) => (
                  <div key={i} className="flex justify-between items-center text-sm py-1 border-b border-border/60 last:border-0 gap-2">
                    <span className="text-muted-foreground flex items-center gap-2 min-w-0">
                      <span
                        className="w-2 h-2 rounded-full shrink-0"
                        style={{ backgroundColor: getChargeColor(chargeKindFor(detail.type)) }}
                      />
                      <span className="truncate">{detail.description}</span>
                      <span className="text-xs text-muted-foreground shrink-0">({detail.count})</span>
                    </span>
                    <span className="font-medium shrink-0 tabular-nums">
                      {detail.type === 'discount' ? '-' : ''}
                      {formatCurrency(Math.abs(detail.total))}
                    </span>
                  </div>
                ),
              )}
              {data.chargeComposition.details.length > 10 && (
                <button
                  type="button"
                  onClick={() => setChargesExpanded(!chargesExpanded)}
                  className="text-xs text-primary hover:text-primary/80 transition-colors pt-1 cursor-pointer"
                >
                  {chargesExpanded ? 'Show less' : `Show all ${data.chargeComposition.details.length} charge types`}
                </button>
              )}
            </div>
            <p className="text-xs text-muted-foreground/60 mt-4 pt-3 border-t border-border/40">
              Data sourced from OwnerRez. Counts may differ between tax types if a charge is missing in the source system.
            </p>
          </div>
        </div>
      )}
    </div>
  )
}
