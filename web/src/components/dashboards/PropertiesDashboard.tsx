import { useMemo, useCallback } from 'react'
import { formatCurrency, formatPercentage, sumBy } from '@baileys/utils'
import { useTagIds, usePropertyIds, useErrorToast, useComparisonDateRange } from '@/hooks/use-dashboard-utils'
import type { PropertyMetrics } from '@/types/api'
import { useDashboard } from '@/contexts/dashboard'
import { useDashboardBatch } from '@/hooks/use-api'
import { useModal } from '@/contexts/modal'
import { MetricCard } from '@/components/MetricCard'
import { ChartWrapper } from '@/components/ChartWrapper'
import { StateWrapper } from '@/components/StateWrapper'
import { PropertyPerformanceScatter } from '@/components/charts/PropertyPerformanceScatter'
import { PropertyTable } from '@/components/tables/PropertyTable'
import { ProfitabilityChart, ProfitabilityLegend } from '@/components/charts/ProfitabilityChart'
import { PlatformMixBars } from '@/components/charts/PlatformMixBars'
import { METRIC_DEFINITIONS } from '@/lib/metric-definitions'

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

interface PropertyPlatformMix {
  propertyId: string
  propertyName: string
  propertyCode?: string | null
  platforms: Array<{ platform: string; bookings: number; revenue: number }>
}

export const PropertiesDashboard = () => {
  const { filters, comparisonRange, comparisonMode, comparisonLabel } = useDashboard()
  const { openModal } = useModal()
  const comparisonDateRange = useComparisonDateRange()

  const tagIds = useTagIds()
  const propertyIds = usePropertyIds()

  const { data, error, isLoading } = useDashboardBatch(
    'properties',
    filters.dateRange.from,
    filters.dateRange.to,
    tagIds,
    comparisonRange?.from,
    comparisonRange?.to,
    propertyIds,
  )

  let properties: PropertyMetrics[] = []
  let previousProperties: PropertyMetrics[] | null = null
  let profitability: PropertyProfitability[] = []
  let platformMix: PropertyPlatformMix[] = []

  if (Array.isArray(data)) {
    properties = data
  } else if (data) {
    properties = data.properties || []
    previousProperties = data.previousProperties || null
    profitability = data.profitability || []
    platformMix = data.platformMix || []
  }

  useErrorToast(error, 'Failed to load property metrics')

  const validProperties = Array.isArray(properties) ? properties.filter((p: PropertyMetrics) => p?.propertyName) : ([] as PropertyMetrics[])

  const { totalRevenue, totalBookings, avgOccupancy, avgRevPAN, totalNetRevenue } = useMemo(() => {
    const totalAvailableNights = sumBy(validProperties, (p: PropertyMetrics) => p.availableNights)
    const totalBookedNights = sumBy(validProperties, (p: PropertyMetrics) => p.bookedNights)
    const totalRev = sumBy(validProperties, (p: PropertyMetrics) => p.revenue)
    const totalNet = profitability.length > 0 ? sumBy(profitability, (p: PropertyProfitability) => p.netRevenue || 0) : 0
    return {
      totalRevenue: totalRev,
      totalBookings: sumBy(validProperties, (p: PropertyMetrics) => p.bookings),
      avgOccupancy: totalAvailableNights > 0 ? totalBookedNights / totalAvailableNights : 0,
      avgRevPAN: totalAvailableNights > 0 ? totalRev / totalAvailableNights : 0,
      totalNetRevenue: totalNet,
    }
  }, [validProperties, profitability])

  const { prevTotalRevenue, prevTotalBookings, prevAvgOccupancy, prevAvgRevPAN } = useMemo(() => {
    const prev = previousProperties || []
    const prevTotalAvailableNights = sumBy(prev, (p: PropertyMetrics) => p.availableNights)
    const prevTotalBookedNights = sumBy(prev, (p: PropertyMetrics) => p.bookedNights)
    const prevTotalRev = sumBy(prev, (p: PropertyMetrics) => p.revenue)
    return {
      prevTotalRevenue: prevTotalRev,
      prevTotalBookings: sumBy(prev, (p: PropertyMetrics) => p.bookings),
      prevAvgOccupancy: prevTotalAvailableNights > 0 ? prevTotalBookedNights / prevTotalAvailableNights : 0,
      prevAvgRevPAN: prevTotalAvailableNights > 0 ? prevTotalRev / prevTotalAvailableNights : 0,
    }
  }, [previousProperties])

  // collect platforms sorted by total revenue (matches chart stacking order)
  const allPlatforms = useMemo(() => {
    const totals = new Map<string, number>()
    for (const p of platformMix) {
      for (const entry of p.platforms || []) {
        totals.set(entry.platform, (totals.get(entry.platform) || 0) + entry.revenue)
      }
    }
    return Array.from(totals.entries())
      .sort((a, b) => b[1] - a[1])
      .map(([name]) => name)
  }, [platformMix])

  // memoized click handlers
  const handleScatterClick = useCallback(
    (property: PropertyMetrics) => {
      openModal({
        type: 'property',
        propertyId: property.propertyId,
        propertyName: property.propertyName,
      })
    },
    [openModal],
  )

  const handleChartPropertyClick = useCallback(
    (propertyId: string, propertyName: string) => {
      openModal({ type: 'property', propertyId, propertyName })
    },
    [openModal],
  )

  if (isLoading || error || validProperties.length === 0) {
    return (
      <div className="space-y-6">
        <StateWrapper
          loading={isLoading}
          error={error}
          empty={validProperties.length === 0 && !isLoading && !error}
          loadingMessage="Loading property data..."
          emptyMessage="No Properties Found"
          emptySubMessage="Properties will appear here once they're synced from your booking platform."
          onRetry={() => window.location.reload()}
          minHeight={300}
          className="bg-card rounded-lg shadow-sm py-12"
        >
          <div />
        </StateWrapper>
      </div>
    )
  }

  // dynamic chart height based on property count
  const profitabilityNaturalHeight = Math.max(380, validProperties.length * 44 + 30)
  const profitabilityCappedHeight = Math.min(600, profitabilityNaturalHeight)
  const profitabilityNeedsScroll = profitabilityNaturalHeight > profitabilityCappedHeight

  return (
    <div className="space-y-6">
      <div className="grid grid-cols-2 md:grid-cols-4 gap-3 md:gap-4">
        <MetricCard
          label="Total Revenue"
          value={totalRevenue}
          format="currency"
          tooltip={METRIC_DEFINITIONS.revenue}
          subValue={
            comparisonMode !== 'none' && previousProperties && prevTotalRevenue > 0 ? (
              <>
                vs {comparisonLabel}: {formatCurrency(prevTotalRevenue)}
                {comparisonDateRange && <span className="block text-xs text-muted-foreground/70 mt-0.5">{comparisonDateRange}</span>}
              </>
            ) : (
              `${totalBookings} bookings · All properties`
            )
          }
          trend={
            comparisonMode !== 'none' && previousProperties && prevTotalRevenue > 0
              ? {
                  value: ((totalRevenue - prevTotalRevenue) / prevTotalRevenue) * 100,
                  isPositive: totalRevenue > prevTotalRevenue,
                }
              : undefined
          }
          staggerIndex={0}
        />
        {profitability.length > 0 ? (
          <MetricCard
            label="Operating Profit"
            value={totalNetRevenue}
            format="currency"
            tooltip={METRIC_DEFINITIONS.operatingProfit}
            subValue={
              comparisonMode !== 'none' && previousProperties && prevTotalRevenue > 0 ? (
                <>
                  vs {comparisonLabel}
                  {comparisonDateRange && <span className="block text-xs text-muted-foreground/70 mt-0.5">{comparisonDateRange}</span>}
                </>
              ) : totalRevenue > 0 ? (
                `${formatPercentage((totalNetRevenue / totalRevenue) * 100, 1)} margin`
              ) : (
                '0% margin'
              )
            }
            tone={totalNetRevenue < 0 ? 'negative' : undefined}
            staggerIndex={1}
          />
        ) : (
          <MetricCard
            label="Avg RevPAN"
            value={avgRevPAN}
            format="currency"
            tooltip={METRIC_DEFINITIONS.revpan}
            subValue={
              comparisonMode !== 'none' && previousProperties && prevAvgRevPAN > 0 ? (
                <>
                  vs {comparisonLabel}: {formatCurrency(prevAvgRevPAN)}
                  {comparisonDateRange && <span className="block text-xs text-muted-foreground/70 mt-0.5">{comparisonDateRange}</span>}
                </>
              ) : (
                'Across all properties'
              )
            }
            trend={
              comparisonMode !== 'none' && previousProperties && prevAvgRevPAN > 0
                ? {
                    value: ((avgRevPAN - prevAvgRevPAN) / prevAvgRevPAN) * 100,
                    isPositive: avgRevPAN > prevAvgRevPAN,
                  }
                : undefined
            }
            staggerIndex={1}
          />
        )}
        <MetricCard
          label="Occupancy Rate"
          value={avgOccupancy * 100}
          format="percent"
          tooltip={METRIC_DEFINITIONS.propertyOccupancy}
          subValue={
            comparisonMode !== 'none' && previousProperties && prevAvgOccupancy > 0 ? (
              <>
                vs {comparisonLabel}: {formatPercentage(prevAvgOccupancy * 100, 1)}
                {comparisonDateRange && <span className="block text-xs text-muted-foreground/70 mt-0.5">{comparisonDateRange}</span>}
              </>
            ) : (
              'Across all properties'
            )
          }
          trend={
            comparisonMode !== 'none' && previousProperties && prevAvgOccupancy > 0
              ? {
                  value: ((avgOccupancy - prevAvgOccupancy) / prevAvgOccupancy) * 100,
                  isPositive: avgOccupancy > prevAvgOccupancy,
                }
              : undefined
          }
          staggerIndex={2}
        />
        <MetricCard
          label={profitability.length > 0 ? 'Avg RevPAN' : 'Total Bookings'}
          value={profitability.length > 0 ? avgRevPAN : totalBookings}
          format={profitability.length > 0 ? 'currency' : 'number'}
          tooltip={profitability.length > 0 ? METRIC_DEFINITIONS.revpan : METRIC_DEFINITIONS.bookings}
          subValue={
            comparisonMode !== 'none' && previousProperties ? (
              profitability.length > 0 && prevAvgRevPAN > 0 ? (
                <>
                  vs {comparisonLabel}: {formatCurrency(prevAvgRevPAN)}
                  {comparisonDateRange && <span className="block text-xs text-muted-foreground/70 mt-0.5">{comparisonDateRange}</span>}
                </>
              ) : prevTotalBookings > 0 ? (
                <>
                  vs {comparisonLabel}: {prevTotalBookings}
                  {comparisonDateRange && <span className="block text-xs text-muted-foreground/70 mt-0.5">{comparisonDateRange}</span>}
                </>
              ) : undefined
            ) : profitability.length > 0 ? (
              'Across all properties'
            ) : undefined
          }
          trend={
            comparisonMode !== 'none' && previousProperties
              ? profitability.length > 0 && prevAvgRevPAN > 0
                ? { value: ((avgRevPAN - prevAvgRevPAN) / prevAvgRevPAN) * 100, isPositive: avgRevPAN > prevAvgRevPAN }
                : prevTotalBookings > 0
                  ? {
                      value: ((totalBookings - prevTotalBookings) / prevTotalBookings) * 100,
                      isPositive: totalBookings > prevTotalBookings,
                    }
                  : undefined
              : undefined
          }
          staggerIndex={3}
        />
      </div>

      <section className="space-y-3">
        <h3 className="text-lg font-semibold text-foreground">Property performance</h3>
        <PropertyTable
          properties={validProperties}
          previousProperties={previousProperties}
          comparisonMode={comparisonMode}
          profitability={profitability}
        />
      </section>

      {/* Analysis Charts */}
      <div className="grid lg:grid-cols-2 gap-6">
        {/* Net Profitability */}
        <ChartWrapper
          className="h-full"
          title="Net Profitability"
          subtitle="Revenue after fees, taxes, and expenses"
          height={profitabilityCappedHeight}
          responsive={false}
          noData={profitability.length === 0}
          noDataMessage="No profitability data for this period"
        >
          <div className="h-full flex flex-col">
            <div className={`flex-1 min-h-0 ${profitabilityNeedsScroll ? 'overflow-y-auto' : ''}`}>
              <div style={{ height: `${profitabilityNaturalHeight}px` }}>
                <ProfitabilityChart data={profitability} onPropertyClick={handleChartPropertyClick} />
              </div>
            </div>
            {profitability.length > 0 && <ProfitabilityLegend />}
          </div>
        </ChartWrapper>

        {/* Performance Matrix */}
        <ChartWrapper
          className="h-full"
          title="Performance Matrix"
          subtitle="Revenue vs. occupancy by property"
          height={400}
          responsive={false}
          noData={validProperties.length === 0}
          noDataMessage="No property data for this period"
        >
          <PropertyPerformanceScatter properties={validProperties} onPropertyClick={handleScatterClick} />
        </ChartWrapper>
      </div>

      {platformMix.length > 0 && allPlatforms.length > 0 && (
        <ChartWrapper title="Revenue by platform" height="auto" responsive={false}>
          <PlatformMixBars data={platformMix} onPropertyClick={handleChartPropertyClick} />
        </ChartWrapper>
      )}
    </div>
  )
}
