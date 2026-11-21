import { useMemo, useCallback, useState } from 'react'
import { usePropertyDetail } from '@/hooks/use-api'
import { formatCurrency, formatPercentage, formatCompactCurrency, formatDateDisplay } from '@baileys/utils'
import { LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, PieChart, Pie, Cell, Label } from 'recharts'
import { ExternalLink } from 'lucide-react'
import { EmptyQuadrants } from '@/components/EmptyQuadrants'
import { StateWrapper } from '@/components/StateWrapper'
import { StatusBadge } from '@/components/StatusBadge'
import { MetricCard } from '@/components/MetricCard'
import { Modal } from '@/components/Modal'
import { Tabs, TabsList, TabsTrigger, TabsContent } from '@/components/ui/tabs'
import { useModal } from '@/contexts/modal'
import { useDashboard } from '@/contexts/dashboard'
import { METRIC_COLORS, CHART_INFRA, getChartColor, resolveToken } from '@/lib/theme'
import { Pagination } from '@/components/Pagination'

const MODAL_PAGE_SIZE = 10
import type { TooltipContentProps } from 'recharts'
import { METRIC_DEFINITIONS } from '@/lib/metric-definitions'
import { SegmentedControl } from '@/components/ui/segmented-control'

interface PropertyMonthlyEntry {
  month: string
  revenue: number
  bookings: number
  occupancy: number
}

interface PlatformRevenueEntry {
  platform: string
  revenue: number
  percentage?: number
}

interface PropertyBooking {
  id: string
  guestId?: string
  guestName: string
  arrival: string
  departure: string
  totalAmount: number
  status: string
}

interface PropertyDetailModalProps {
  propertyId: string
  propertyName: string
  from?: string
  to?: string
}

const PropertyPerformanceTooltip = ({ active, payload, label }: Partial<TooltipContentProps<number, string>>) => {
  if (!active || !payload?.length) return null
  const data = payload![0].payload as { revenue: number; occupancy: number; bookings: number }

  return (
    <div className="bg-card p-3 rounded-lg shadow-lg border border-border">
      <p className="font-semibold text-sm mb-2">{label}</p>
      <div className="space-y-1 text-xs">
        <div className="flex justify-between gap-4">
          <div className="flex items-center gap-1">
            <div className="w-3 h-3 rounded-sm" style={{ backgroundColor: METRIC_COLORS.revenue }} />
            <span className="text-muted-foreground">Revenue:</span>
          </div>
          <span className="font-medium">{formatCurrency(data.revenue)}</span>
        </div>
        <div className="flex justify-between gap-4">
          <div className="flex items-center gap-1">
            <div className="w-3 h-3 rounded-sm" style={{ backgroundColor: METRIC_COLORS.occupancy }} />
            <span className="text-muted-foreground">Occupancy:</span>
          </div>
          <span className="font-medium">{formatPercentage(data.occupancy, 1)}</span>
        </div>
        <div className="pt-1 mt-1 border-t border-border">
          <div className="flex justify-between gap-4">
            <span className="text-muted-foreground">Bookings:</span>
            <span className="font-medium">{data.bookings}</span>
          </div>
          {data.bookings > 0 && data.revenue > 0 && (
            <div className="flex justify-between gap-4">
              <span className="text-muted-foreground">Avg per booking:</span>
              <span className="font-medium">{formatCurrency(data.revenue / data.bookings)}</span>
            </div>
          )}
        </div>
      </div>
    </div>
  )
}

const PlatformRevenueTooltip = ({ active, payload }: Partial<TooltipContentProps<number, string>>) => {
  if (active && payload?.length) {
    const data = payload[0].payload as PlatformRevenueEntry
    return (
      <div className="bg-card p-3 rounded-lg shadow-lg border border-border">
        <p className="font-semibold text-sm mb-2">{data.platform}</p>
        <div className="space-y-1 text-xs">
          <div className="flex justify-between gap-4">
            <span className="text-muted-foreground">Revenue:</span>
            <span className="font-medium text-foreground">{formatCurrency(data.revenue)}</span>
          </div>
          <div className="pt-1 mt-1 border-t border-border flex justify-between gap-4">
            <span className="text-muted-foreground">Share:</span>
            <span className="font-medium">{data.percentage?.toFixed(1) || '0.0'}%</span>
          </div>
        </div>
      </div>
    )
  }
  return null
}

export const PropertyDetailModal = ({ propertyId, propertyName, from, to }: PropertyDetailModalProps) => {
  const { closeModal, openModal } = useModal()
  const { filters } = useDashboard()
  const [bookingsPage, setBookingsPage] = useState(1)

  const effectiveFrom = from || filters.dateRange.from
  const effectiveTo = to || filters.dateRange.to

  const { data, isLoading, error } = usePropertyDetail(
    propertyId,
    effectiveFrom,
    effectiveTo,
    filters.selectedTags.map((t) => t.id),
  )

  const subtitle = data
    ? [data.property.address, `${data.property.bedrooms} bd`, `${data.property.bathrooms} ba`, `sleeps ${data.property.maxGuests}`]
        .filter(Boolean)
        .join(' · ')
    : undefined
  const [chartMeasure, setChartMeasure] = useState<'revenue' | 'occupancy'>('revenue')

  const monthlyChartData = useMemo(
    () =>
      data?.monthlyData?.map((m: PropertyMonthlyEntry) => ({
        month: new Date(m.month).toLocaleDateString('en-US', { month: 'short' }),
        revenue: m.revenue,
        bookings: m.bookings,
        occupancy: Math.round(m.occupancy * 10) / 10,
      })) || [],
    [data?.monthlyData],
  )

  const platformData = useMemo(
    () =>
      data?.revenueByPlatform?.map((p: PlatformRevenueEntry, index: number) => ({
        ...p,
        color: getChartColor(index),
      })) || [],
    [data?.revenueByPlatform],
  )

  const [platformActiveIndex, setPlatformActiveIndex] = useState<number | null>(null)

  const platformTotal = useMemo(() => platformData.reduce((sum, p) => sum + p.revenue, 0), [platformData])

  // memoized guest click handler
  const handleGuestClick = useCallback(
    (guestId: string, guestName: string) => {
      openModal({ type: 'guest', guestId, guestName })
    },
    [openModal],
  )

  return (
    <Modal isOpen={true} onClose={closeModal} title={propertyName} subtitle={subtitle} size="xl">
      <StateWrapper
        loading={isLoading}
        error={error}
        empty={!data && !isLoading && !error}
        loadingMessage="Loading property details..."
        errorMessage="Failed to load property details"
        emptyMessage="No property data available"
        minHeight={400}
      >
        {data && (
          <div className="space-y-6">
            {data.property.ownerrezId && (
              <a
                href={`https://app.ownerrez.com/properties/${data.property.ownerrezId}`}
                target="_blank"
                rel="noopener noreferrer"
                className="inline-flex items-center gap-1.5 text-sm text-muted-foreground hover:text-foreground transition-colors"
              >
                <ExternalLink className="w-3.5 h-3.5" aria-hidden />
                Open in OwnerRez
              </a>
            )}

            {/* Key Metrics */}
            <div className="grid md:grid-cols-4 gap-4">
              <MetricCard
                label="Total Revenue"
                value={data.metrics.totalRevenue}
                format="currency"
                size="sm"
                staggerIndex={0}
                className="border border-border"
                tooltip={METRIC_DEFINITIONS.revenue}
              />
              <MetricCard
                label="Total Bookings"
                value={data.metrics.totalBookings}
                format="number"
                subValue={`${(data.metrics.avgStayLength || 0).toFixed(1)} nights avg`}
                size="sm"
                staggerIndex={1}
                className="border border-border"
                tooltip={METRIC_DEFINITIONS.bookings}
              />
              <MetricCard
                label="Occupancy Rate"
                value={data.metrics.occupancyRate * 100}
                format="percent"
                subValue={
                  data.metrics.blockedNights
                    ? `${data.metrics.totalNights || 0} of ${data.metrics.sellableDays ?? data.metrics.totalDays ?? 0} sellable · ${data.metrics.blockedNights} owner-blocked`
                    : `${data.metrics.totalNights || 0} of ${data.metrics.totalDays || 0} nights`
                }
                size="sm"
                staggerIndex={2}
                className="border border-border"
                tooltip={METRIC_DEFINITIONS.occupancy}
              />
              <MetricCard
                label="Average Nightly Rate"
                value={data.metrics.avgNightlyRate}
                format="currency"
                size="sm"
                staggerIndex={3}
                className="border border-border"
                tooltip={METRIC_DEFINITIONS.adr}
              />
            </div>

            {/* Cost Metrics */}
            {(data.metrics.platformFees > 0 || data.metrics.taxes > 0 || data.metrics.operatingExpenses > 0) && (
              <div className="bg-card rounded-lg border border-border p-4">
                <h3 className="text-sm font-medium text-foreground mb-3">Costs</h3>
                <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                  {data.metrics.platformFees > 0 && (
                    <div>
                      <div className="text-xs text-muted-foreground">Platform fees (est.)</div>
                      <div className="text-lg font-semibold tabular-nums">-{formatCurrency(data.metrics.platformFees)}</div>
                    </div>
                  )}
                  {data.metrics.taxes > 0 && (
                    <div>
                      <div className="text-xs text-muted-foreground">Taxes</div>
                      <div className="text-lg font-semibold tabular-nums">-{formatCurrency(data.metrics.taxes)}</div>
                    </div>
                  )}
                  {data.metrics.operatingExpenses > 0 && (
                    <div>
                      <div className="text-xs text-muted-foreground">Operating expenses</div>
                      <div className="text-lg font-semibold tabular-nums">-{formatCurrency(data.metrics.operatingExpenses)}</div>
                    </div>
                  )}
                  <div>
                    <div className="text-xs text-muted-foreground">Net revenue</div>
                    <div className={`text-lg font-semibold tabular-nums ${data.metrics.netRevenue < 0 ? 'text-danger' : ''}`}>
                      {formatCurrency(data.metrics.netRevenue)}
                    </div>
                  </div>
                </div>
              </div>
            )}

            {/* Tabs */}
            <Tabs defaultValue="overview">
              <TabsList>
                <TabsTrigger value="overview">By month</TabsTrigger>
                <TabsTrigger value="bookings">Recent bookings</TabsTrigger>
                <TabsTrigger value="revenue">Booking sources</TabsTrigger>
              </TabsList>

              <TabsContent value="overview">
                <div className="space-y-6">
                  <div className="bg-card p-6 rounded-lg border border-border">
                    <div className="flex items-center justify-between gap-3 mb-4">
                      <h3 className="text-base font-semibold">Monthly {chartMeasure === 'revenue' ? 'revenue' : 'occupancy'}</h3>
                      <SegmentedControl
                        label="Measure"
                        value={chartMeasure}
                        onChange={setChartMeasure}
                        options={[
                          { value: 'revenue', label: 'Revenue' },
                          { value: 'occupancy', label: 'Occupancy' },
                        ]}
                      />
                    </div>
                    <div className="h-64">
                      <ResponsiveContainer width="100%" height="100%">
                        <LineChart data={monthlyChartData} margin={{ top: 8, right: 16, bottom: 0, left: 0 }}>
                          <CartesianGrid vertical={false} stroke={CHART_INFRA.grid} strokeOpacity={0.6} />
                          <XAxis dataKey="month" tick={{ fill: CHART_INFRA.axis, fontSize: 12 }} axisLine={false} tickLine={false} />
                          <YAxis
                            width={52}
                            domain={chartMeasure === 'occupancy' ? [0, 100] : [0, 'auto']}
                            tickFormatter={(value) => (chartMeasure === 'revenue' ? formatCompactCurrency(value) : `${value}%`)}
                            tick={{ fill: CHART_INFRA.axis, fontSize: 12 }}
                            axisLine={false}
                            tickLine={false}
                          />
                          <Tooltip content={<PropertyPerformanceTooltip />} isAnimationActive={false} />
                          <Line
                            type="monotone"
                            dataKey={chartMeasure}
                            stroke={chartMeasure === 'revenue' ? METRIC_COLORS.revenue : METRIC_COLORS.occupancy}
                            name={chartMeasure === 'revenue' ? 'Revenue' : 'Occupancy'}
                            strokeWidth={2}
                            dot={false}
                            activeDot={{ r: 4 }}
                          />
                        </LineChart>
                      </ResponsiveContainer>
                    </div>
                  </div>
                </div>
              </TabsContent>

              <TabsContent value="bookings">
                <div className="bg-card rounded-lg border border-border overflow-hidden">
                  <div className="p-4 border-b border-border">
                    <h3 className="font-semibold">Recent Bookings</h3>
                  </div>
                  <div>
                    <table className="w-full">
                      <thead className="bg-muted/50">
                        <tr>
                          <th className="text-left p-4 text-sm font-medium text-foreground">Guest</th>
                          <th className="text-left p-4 text-sm font-medium text-foreground">Check In</th>
                          <th className="text-left p-4 text-sm font-medium text-foreground">Check Out</th>
                          <th className="text-left p-4 text-sm font-medium text-foreground">Amount</th>
                          <th className="text-left p-4 text-sm font-medium text-foreground">Status</th>
                        </tr>
                      </thead>
                      <tbody>
                        {data.recentBookings
                          ?.slice((bookingsPage - 1) * MODAL_PAGE_SIZE, bookingsPage * MODAL_PAGE_SIZE)
                          .map((booking: PropertyBooking) => (
                            <tr
                              key={booking.id}
                              className="border-t border-border hover:bg-muted/50 cursor-pointer"
                              onClick={() => booking.guestId && handleGuestClick(booking.guestId, booking.guestName)}
                            >
                              <td className="p-4">
                                <div>
                                  <div className="font-medium text-primary hover:underline">{booking.guestName}</div>
                                </div>
                              </td>
                              <td className="p-4 text-sm">{formatDateDisplay(booking.arrival)}</td>
                              <td className="p-4 text-sm">{formatDateDisplay(booking.departure)}</td>
                              <td className="p-4 text-sm font-medium text-foreground">{formatCurrency(booking.totalAmount)}</td>
                              <td className="p-4">
                                <StatusBadge status={booking.status} />
                              </td>
                            </tr>
                          ))}
                      </tbody>
                    </table>
                    {data.recentBookings && (
                      <div className="px-4 pb-3">
                        <Pagination
                          currentPage={bookingsPage}
                          totalPages={Math.ceil(data.recentBookings.length / MODAL_PAGE_SIZE)}
                          totalItems={data.recentBookings.length}
                          pageSize={MODAL_PAGE_SIZE}
                          onPageChange={setBookingsPage}
                        />
                      </div>
                    )}
                  </div>
                </div>
              </TabsContent>

              <TabsContent value="revenue">
                <div className="space-y-6">
                  <div className="bg-card p-6 rounded-lg border border-border">
                    <h3 className="text-lg font-bold mb-4">Where Bookings Come From</h3>
                    {platformData.length > 0 ? (
                      <>
                        <div className="h-56">
                          <ResponsiveContainer width="100%" height="100%">
                            <PieChart>
                              <Pie
                                data={platformData}
                                cx="50%"
                                cy="50%"
                                innerRadius="55%"
                                outerRadius="80%"
                                dataKey="revenue"
                                stroke={resolveToken('--card')}
                                strokeWidth={2}
                                animationBegin={0}
                                animationDuration={500}
                                animationEasing="ease-out"
                                onMouseEnter={(_: unknown, index: number) => setPlatformActiveIndex(index)}
                                onMouseLeave={() => setPlatformActiveIndex(null)}
                              >
                                {platformData.map((entry, index) => (
                                  <Cell
                                    key={`cell-${index}`}
                                    fill={entry.color}
                                    opacity={platformActiveIndex === null || platformActiveIndex === index ? 1 : 0.3}
                                    style={{ transition: 'opacity 0.2s ease' }}
                                  />
                                ))}
                                <Label
                                  content={({ viewBox }) => {
                                    const { cx, cy } = viewBox as { cx: number; cy: number }
                                    return (
                                      <text x={cx} y={cy} textAnchor="middle" dominantBaseline="middle">
                                        <tspan x={cx} y={cy - 8} className="fill-foreground text-lg font-bold">
                                          {formatCompactCurrency(platformTotal)}
                                        </tspan>
                                        <tspan x={cx} y={cy + 12} className="fill-muted-foreground text-xs">
                                          Revenue
                                        </tspan>
                                      </text>
                                    )
                                  }}
                                />
                              </Pie>
                              <Tooltip content={<PlatformRevenueTooltip />} isAnimationActive={false} />
                            </PieChart>
                          </ResponsiveContainer>
                        </div>
                        <div className="flex flex-wrap gap-3 justify-center text-xs px-4">
                          {platformData.map((entry) => (
                            <div key={entry.platform} className="flex items-center gap-1.5">
                              <div className="w-3 h-2.5 rounded-sm" style={{ backgroundColor: entry.color }} />
                              <span className="text-muted-foreground">{entry.platform}</span>
                            </div>
                          ))}
                        </div>
                      </>
                    ) : (
                      <div className="text-center py-8">
                        <EmptyQuadrants className="w-12 h-12 mx-auto mb-2" />
                        <p className="text-muted-foreground">No platform data available</p>
                      </div>
                    )}
                  </div>

                  <div className="bg-card p-6 rounded-lg border border-border">
                    <h3 className="text-lg font-bold mb-4">Guest Insights</h3>
                    <div className="grid grid-cols-3 gap-4">
                      <div>
                        <div className="text-sm text-muted-foreground">Total Guests</div>
                        <div className="text-2xl font-bold">{data.guestStats?.totalGuests || 0}</div>
                      </div>
                      <div>
                        <div className="text-sm text-muted-foreground">Returning Guests</div>
                        <div className="text-2xl font-bold">{data.guestStats?.repeatGuests || 0}</div>
                      </div>
                      <div>
                        <div className="text-sm text-muted-foreground">Return Rate</div>
                        <div className="text-2xl font-bold">
                          {formatPercentage(
                            data.guestStats?.totalGuests ? (data.guestStats.repeatGuests / data.guestStats.totalGuests) * 100 : 0,
                            1,
                          )}
                        </div>
                      </div>
                    </div>
                  </div>
                </div>
              </TabsContent>
            </Tabs>
          </div>
        )}
      </StateWrapper>
    </Modal>
  )
}
