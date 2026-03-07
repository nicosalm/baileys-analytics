import { useMemo, useCallback, useState } from 'react'
import { usePropertyDetail } from '@/hooks/use-api'
import { formatCurrency, formatPercentage, formatCompactCurrency, formatDateDisplay } from '@baileys/utils'
import { LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, PieChart, Pie, Cell, Label } from 'recharts'
import { TrendingUp, Calendar, DollarSign, Users, Home, Bed, Bath, MapPin, Info, ExternalLink } from 'lucide-react'
import { EmptyQuadrants } from '@/components/EmptyQuadrants'
import { StateWrapper } from '@/components/StateWrapper'
import { StatusBadge } from '@/components/StatusBadge'
import { MetricCard } from '@/components/MetricCard'
import { Modal } from '@/components/Modal'
import { Tabs, TabsList, TabsTrigger, TabsContent } from '@/components/ui/tabs'
import { useModal } from '@/contexts/modal'
import { useDashboard } from '@/contexts/dashboard'
import { useTips } from '@/hooks/use-tips'
import { METRIC_COLORS, CHART_INFRA, getChartColor, resolveToken } from '@/lib/theme'

interface PropertyDetailModalProps {
  propertyId: string
  propertyName: string
  from?: string
  to?: string
}

const PropertyPerformanceTooltip = ({ active, payload, label }: any) => {
  if (!active || !payload?.length) return null
  const data = payload[0].payload

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

const PlatformRevenueTooltip = ({ active, payload }: any) => {
  if (active && payload && payload.length) {
    const data = payload[0].payload
    return (
      <div className="bg-card p-3 rounded-lg shadow-lg border border-border">
        <p className="font-semibold text-sm mb-2">{data.platform}</p>
        <div className="space-y-1 text-xs">
          <p className="flex justify-between gap-4">
            <span className="text-muted-foreground">Revenue:</span>
            <span className="font-medium text-success">{formatCurrency(data.revenue)}</span>
          </p>
          <p className="flex justify-between gap-4">
            <span className="text-muted-foreground">Share:</span>
            <span className="font-medium">{data.percentage?.toFixed(1) || '0.0'}%</span>
          </p>
        </div>
      </div>
    )
  }
  return null
}

export const PropertyDetailModal = ({ propertyId, propertyName, from, to }: PropertyDetailModalProps) => {
  const { closeModal, openModal } = useModal()
  const { showTips } = useTips()
  const { filters } = useDashboard()

  const effectiveFrom = from || filters.dateRange.from
  const effectiveTo = to || filters.dateRange.to

  const { data, isLoading, error } = usePropertyDetail(
    propertyId,
    effectiveFrom,
    effectiveTo,
    filters.selectedTags.map(t => t.id)
  )

  const subtitle = isLoading ? "Loading property details..." :
                   error ? "Unable to load property details" :
                   `Performance metrics for ${propertyName}`

  const monthlyChartData = useMemo(() =>
    data?.monthlyData?.map((m: any) => ({
      month: new Date(m.month).toLocaleDateString('en-US', { month: 'short' }),
      revenue: m.revenue,
      bookings: m.bookings,
      occupancy: Math.round(m.occupancy * 10) / 10
    })) || []
  , [data?.monthlyData])

  const platformData = useMemo(() =>
    data?.revenueByPlatform?.map((p: any, index: number) => ({
      ...p,
      color: getChartColor(index)
    })) || []
  , [data?.revenueByPlatform])

  const [platformActiveIndex, setPlatformActiveIndex] = useState<number | null>(null)

  const platformTotal = useMemo(() =>
    platformData.reduce((sum: number, p: any) => sum + p.revenue, 0)
  , [platformData])

  // memoized guest click handler
  const handleGuestClick = useCallback((guestId: string, guestName: string) => {
    openModal({ type: 'guest', guestId, guestName })
  }, [openModal])

  return (
    <Modal
      isOpen={true}
      onClose={closeModal}
      title={propertyName}
      subtitle={subtitle}
      size="xl"
    >
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
        {/* Info Banner */}
        {showTips && (
          <div className="bg-info-subtle border border-info/30 rounded-lg p-4">
            <div className="flex items-start">
              <Info className="w-5 h-5 text-info mr-2 mt-0.5" />
              <div className="text-sm text-info-fg">
                <strong>Property Overview:</strong> All metrics shown are for your selected date range.
                Click on any guest name to see their booking history.
              </div>
            </div>
          </div>
        )}

        {/* Property Info Card */}
        <div className="bg-muted/50 rounded-lg p-6">
          <div className="flex items-start justify-between">
            <div>
              <div className="flex items-center gap-2 mb-2">
                <h3 className="text-lg font-bold">{data.property.name}</h3>
                {data.property.ownerrezId && (
                  <a
                    href={`https://app.ownerrez.com/properties/${data.property.ownerrezId}`}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="text-muted-foreground/70 hover:text-primary transition-colors"
                    title="Open in OwnerRez"
                  >
                    <ExternalLink className="w-4 h-4" />
                  </a>
                )}
              </div>
              <div className="flex items-center text-sm text-muted-foreground mb-2">
                <MapPin className="w-4 h-4 mr-1" />
                {data.property.address}
              </div>
              <div className="flex items-center space-x-4 text-sm">
                <span className="flex items-center">
                  <Bed className="w-4 h-4 mr-1" />
                  {data.property.bedrooms} Bedrooms
                </span>
                <span className="flex items-center">
                  <Bath className="w-4 h-4 mr-1" />
                  {data.property.bathrooms} Bathrooms
                </span>
                <span className="flex items-center">
                  <Users className="w-4 h-4 mr-1" />
                  Sleeps {data.property.maxGuests}
                </span>
              </div>
            </div>
          </div>
        </div>

        {/* Key Metrics */}
        <div className="grid md:grid-cols-4 gap-4">
          <MetricCard
            icon={DollarSign}
            label="Total Revenue"
            value={data.metrics.totalRevenue}
            format="currency"
            subValue="This period"
            size="sm"
            color="green"
            staggerIndex={0}
            className="border border-border"
          />
          <MetricCard
            icon={Calendar}
            label="Total Bookings"
            value={data.metrics.totalBookings}
            format="number"
            subValue={`${(data.metrics.avgStayLength || 0).toFixed(1)} nights avg`}
            size="sm"
            color="blue"
            staggerIndex={1}
            className="border border-border"
          />
          <MetricCard
            icon={Home}
            label="Occupancy Rate"
            value={data.metrics.occupancyRate * 100}
            format="percent"
            subValue={`${data.metrics.totalNights || 0} of ${data.metrics.totalDays || 0} nights`}
            size="sm"
            color="purple"
            staggerIndex={2}
            className="border border-border"
          />
          <MetricCard
            icon={TrendingUp}
            label="Average Nightly Rate"
            value={data.metrics.avgNightlyRate}
            format="currency"
            subValue="Average"
            size="sm"
            color="orange"
            staggerIndex={3}
            className="border border-border"
          />
        </div>

        {/* Cost Metrics */}
        {(data.metrics.platformFees > 0 || data.metrics.taxes > 0 || data.metrics.operatingExpenses > 0) && (
          <div className="bg-card rounded-lg border border-border p-4">
            <h3 className="text-sm font-medium text-foreground mb-3">Cost Summary</h3>
            <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
              {data.metrics.platformFees > 0 && (
                <div>
                  <div className="text-xs text-muted-foreground">Platform Fees (est.)</div>
                  <div className="text-lg font-semibold text-warning">-{formatCurrency(data.metrics.platformFees)}</div>
                </div>
              )}
              {data.metrics.taxes > 0 && (
                <div>
                  <div className="text-xs text-muted-foreground">Taxes</div>
                  <div className="text-lg font-semibold text-info">-{formatCurrency(data.metrics.taxes)}</div>
                </div>
              )}
              {data.metrics.operatingExpenses > 0 && (
                <div>
                  <div className="text-xs text-muted-foreground">Operating Expenses</div>
                  <div className="text-lg font-semibold text-danger">-{formatCurrency(data.metrics.operatingExpenses)}</div>
                </div>
              )}
              <div>
                <div className="text-xs text-muted-foreground">Net Revenue</div>
                <div className={`text-lg font-semibold ${data.metrics.netRevenue >= 0 ? 'text-success' : 'text-danger'}`}>
                  {formatCurrency(data.metrics.netRevenue)}
                </div>
              </div>
            </div>
          </div>
        )}

        {/* Tabs */}
        <Tabs defaultValue="overview">
          <TabsList variant="line">
            <TabsTrigger value="overview">Performance Charts</TabsTrigger>
            <TabsTrigger value="bookings">Recent Bookings</TabsTrigger>
            <TabsTrigger value="revenue">Revenue Sources</TabsTrigger>
          </TabsList>

          <TabsContent value="overview">
            <div className="space-y-6">
              <div className="bg-card p-6 rounded-lg border border-border">
                <h3 className="text-lg font-bold mb-4">Monthly Performance</h3>
                <div className="h-64">
                  <ResponsiveContainer width="100%" height="100%">
                    <LineChart data={monthlyChartData}>
                      <CartesianGrid strokeDasharray="3 3" stroke={CHART_INFRA.grid} />
                      <XAxis dataKey="month" stroke={CHART_INFRA.axis} tick={{ fill: CHART_INFRA.axis }} />
                      <YAxis yAxisId="left" tickFormatter={(value) => formatCompactCurrency(value)} stroke={CHART_INFRA.axis} tick={{ fill: CHART_INFRA.axis }} />
                      <YAxis yAxisId="right" orientation="right" tickFormatter={(value) => `${value}%`} stroke={CHART_INFRA.axis} tick={{ fill: CHART_INFRA.axis }} />
                      <Tooltip content={<PropertyPerformanceTooltip />} />
                      <Line yAxisId="left" type="monotone" dataKey="revenue" stroke={METRIC_COLORS.revenue} name="Revenue" strokeWidth={2} />
                      <Line yAxisId="right" type="monotone" dataKey="occupancy" stroke={METRIC_COLORS.occupancy} name="Occupancy" strokeWidth={2} />
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
              <div className="max-h-96 overflow-y-auto pr-2">
                <table className="w-full">
                  <thead className="bg-muted sticky top-0">
                    <tr>
                      <th className="text-left p-4 text-sm font-medium text-foreground">Guest</th>
                      <th className="text-left p-4 text-sm font-medium text-foreground">Check In</th>
                      <th className="text-left p-4 text-sm font-medium text-foreground">Check Out</th>
                      <th className="text-left p-4 text-sm font-medium text-foreground">Amount</th>
                      <th className="text-left p-4 text-sm font-medium text-foreground">Status</th>
                    </tr>
                  </thead>
                  <tbody>
                    {data.recentBookings?.map((booking: any) => (
                      <tr
                        key={booking.id}
                        className="border-t border-border hover:bg-muted/50 cursor-pointer"
                        onClick={() => handleGuestClick(booking.guestId, booking.guestName)}
                      >
                        <td className="p-4">
                          <div>
                            <div className="font-medium text-primary hover:underline">{booking.guestName}</div>
                            {booking.guestEmail && (
                              <div className="text-sm text-muted-foreground">{booking.guestEmail}</div>
                            )}
                          </div>
                        </td>
                        <td className="p-4 text-sm">
                          {formatDateDisplay(booking.arrival)}
                        </td>
                        <td className="p-4 text-sm">
                          {formatDateDisplay(booking.departure)}
                        </td>
                        <td className="p-4 text-sm font-medium text-success">
                          {formatCurrency(booking.totalAmount)}
                        </td>
                        <td className="p-4">
                          <StatusBadge status={booking.status} />
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
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
                            onMouseEnter={(_: any, index: number) => setPlatformActiveIndex(index)}
                            onMouseLeave={() => setPlatformActiveIndex(null)}
                          >
                            {platformData.map((entry: any, index: number) => (
                              <Cell
                                key={`cell-${index}`}
                                fill={entry.color}
                                opacity={platformActiveIndex === null || platformActiveIndex === index ? 1 : 0.3}
                                style={{ transition: 'opacity 0.2s ease' }}
                              />
                            ))}
                            <Label
                              content={({ viewBox }) => {
                                const { cx, cy } = viewBox as any
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
                      {platformData.map((entry: any) => (
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
                        data.guestStats?.totalGuests
                          ? (data.guestStats.repeatGuests / data.guestStats.totalGuests) * 100
                          : 0,
                        1
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