import { useState, useEffect, useCallback, useMemo, useRef, memo } from 'react'
import { useNavigate, Link } from 'react-router-dom'
import { useAuth } from '@/contexts/auth'
import { useToast } from '@/contexts/toast'
import { api } from '@/lib/api'
import { LoadingState } from '@/components/LoadingState'
import { resolveToken } from '@/lib/theme'
import {
  AreaChart, Area, BarChart, Bar, PieChart, Pie, Cell, Label,
  XAxis, YAxis, CartesianGrid, Tooltip as RechartsTooltip,
  ResponsiveContainer
} from 'recharts'
import {
  Users, DollarSign, TrendingUp, Search, Trash2, AlertTriangle,
  Settings, LogOut, LayoutDashboard, RefreshCw, ChevronDown,
  Shield, Link2, Link2Off, AlertCircle, UserPlus,
  ExternalLink, ArrowUpDown,
  ChevronLeft, ChevronRight, ChevronUp, Activity
} from 'lucide-react'
import { LogoCube } from '@/components/LogoCube'
import { Footer } from '@/components/Footer'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label as FormLabel } from '@/components/ui/label'
import {
  AlertDialog, AlertDialogContent, AlertDialogHeader, AlertDialogTitle,
  AlertDialogDescription, AlertDialogFooter, AlertDialogCancel
} from '@/components/ui/alert-dialog'

// --- types ---

interface SubscriptionMixEntry {
  tier: string
  count: number
}

interface AdminMetrics {
  totalUsers: number
  totalTenants: number
  totalProperties: number
  totalBookings: number
  activeSubscriptions: number
  mrr: number
  recentSignups: number
  subscriptionMix: SubscriptionMixEntry[]
}

interface AdminUser {
  id: string
  email: string
  company_name?: string | null
  created_at: string
  subscription_status?: string
  subscription_exempt: boolean
  ownerrez_connected: boolean
  first_subscription_at?: string
  subscription?: {
    billing_cycle?: string
    status?: string
    trial_end?: string
    current_period_end?: string
  }
}

interface UserDetail {
  tenant: Record<string, unknown>
  subscription: { current_period_end?: string; [key: string]: unknown } | null
  stats: { properties: number; bookings: number }
  syncStatus: Array<{
    sync_type: string
    last_sync: string
    status: string
    records_synced: number
  }>
}

interface WebhookError {
  id: string
  created_at: string
  event_type: string
  processing_error: string
  tenant_id: string
}

interface SignupTrendEntry {
  date: string
  count: number
}

interface SyncHealth {
  healthy: number
  partial: number
  failing: number
  stale: number
  noSync: number
}

type SortField = 'email' | 'company_name' | 'status' | 'created_at'
type SortDir = 'asc' | 'desc'

// --- helpers ---

function useResolvedTokens<T extends string>(varNames: readonly T[]): Record<T, string> {
  const [values, setValues] = useState<Record<string, string>>({})
  const key = varNames.join(',')
  useEffect(() => {
    const resolved: Record<string, string> = {}
    for (const name of varNames) resolved[name] = resolveToken(name)
    setValues(resolved)
  }, [key])
  return values as Record<T, string>
}

const StatusBadge = ({ status, exempt }: { status?: string; exempt: boolean }) => {
  if (exempt) return (
    <span className="px-2 py-0.5 text-xs font-medium rounded-full bg-purple-subtle text-purple-fg">Exempt</span>
  )
  if (status === 'active') return (
    <span className="px-2 py-0.5 text-xs font-medium rounded-full bg-success-subtle text-success-fg">Active</span>
  )
  return (
    <span className="px-2 py-0.5 text-xs font-medium rounded-full bg-muted text-muted-foreground">Inactive</span>
  )
}

const TimeAgo = ({ date }: { date: string }) => {
  const now = Date.now()
  const then = new Date(date).getTime()
  const diff = now - then
  const minutes = Math.floor(diff / 60000)
  const hours = Math.floor(diff / 3600000)
  const days = Math.floor(diff / 86400000)

  let text: string
  if (minutes < 1) text = 'just now'
  else if (minutes < 60) text = `${minutes}m ago`
  else if (hours < 24) text = `${hours}h ago`
  else if (days < 30) text = `${days}d ago`
  else text = new Date(date).toLocaleDateString()

  return <span title={new Date(date).toLocaleString()}>{text}</span>
}

const USERS_PER_PAGE = 15

// --- metric strip ---

const MetricStrip = memo(({ metrics }: { metrics: AdminMetrics }) => (
  <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
    {[
      { icon: Users, label: 'Total Users', value: String(metrics.totalUsers) },
      { icon: TrendingUp, label: 'Active Subs', value: String(metrics.activeSubscriptions) },
      { icon: DollarSign, label: 'MRR', value: `$${metrics.mrr}` },
      { icon: UserPlus, label: 'Signups (7d)', value: String(metrics.recentSignups) },
    ].map(({ icon: Icon, label, value }, i) => (
      <div
        key={label}
        className="bg-card rounded-lg shadow-sm border border-border px-4 py-3 stagger-fade-in"
        style={{ '--stagger-index': i } as React.CSSProperties}
      >
        <div className="flex items-center gap-2 mb-1">
          <Icon className="w-3.5 h-3.5 text-muted-foreground" />
          <span className="text-xs text-muted-foreground">{label}</span>
        </div>
        <span className="text-xl font-bold text-foreground">{value}</span>
      </div>
    ))}
  </div>
))
MetricStrip.displayName = 'MetricStrip'

// --- charts ---

const TREND_TOKENS = ['--primary', '--border', '--muted-foreground'] as const

const SignupTrendChart = memo(({ data }: { data: SignupTrendEntry[] }) => {
  const t = useResolvedTokens(TREND_TOKENS)
  if (!data.length) return null

  return (
    <div className="bg-card rounded-lg shadow-sm border border-border p-5">
      <div className="flex items-center gap-2 mb-3">
        <UserPlus className="w-4 h-4 text-muted-foreground" />
        <h3 className="text-sm font-semibold text-foreground">Signup Trend</h3>
        <span className="text-xs text-muted-foreground ml-auto">Last 30 days</span>
      </div>
      <div style={{ height: 180 }}>
        <ResponsiveContainer width="100%" height="100%">
          <AreaChart data={data} margin={{ top: 5, right: 5, left: -20, bottom: 0 }}>
            <CartesianGrid strokeDasharray="3 3" stroke={t['--border']} vertical={false} />
            <XAxis
              dataKey="date"
              stroke={t['--muted-foreground']}
              tick={{ fontSize: 10, fill: t['--muted-foreground'] }}
              tickFormatter={(v: string) => {
                const d = new Date(v + 'T00:00:00')
                return `${d.getMonth() + 1}/${d.getDate()}`
              }}
              interval={Math.floor(data.length / 6)}
            />
            <YAxis
              stroke={t['--muted-foreground']}
              tick={{ fontSize: 10, fill: t['--muted-foreground'] }}
              allowDecimals={false}
            />
            <RechartsTooltip
              isAnimationActive={false}
              content={({ active, payload }) => {
                if (!active || !payload?.[0]) return null
                const d = payload[0].payload as SignupTrendEntry
                return (
                  <div className="bg-card p-2.5 rounded-lg shadow-lg border text-xs">
                    <p className="font-medium mb-1">{new Date(d.date + 'T00:00:00').toLocaleDateString('en-US', { month: 'short', day: 'numeric' })}</p>
                    <p className="text-muted-foreground">{d.count} signup{d.count !== 1 ? 's' : ''}</p>
                  </div>
                )
              }}
            />
            <Area
              type="monotone"
              dataKey="count"
              stroke={t['--primary']}
              fill={t['--primary']}
              fillOpacity={0.1}
              strokeWidth={2}
              animationDuration={500}
              animationEasing="ease-out"
            />
          </AreaChart>
        </ResponsiveContainer>
      </div>
    </div>
  )
})
SignupTrendChart.displayName = 'SignupTrendChart'

const DONUT_TOKENS = ['--card', '--chart-series-1', '--chart-series-2', '--chart-series-3', '--chart-series-4', '--muted-foreground'] as const

const TIER_LABELS: Record<string, string> = {
  legacy: 'Legacy',
  starter: 'Starter',
  growth: 'Growth',
  portfolio: 'Portfolio',
  exempt: 'Exempt',
  inactive: 'Inactive',
}

const TIER_COLOR_KEYS: Record<string, typeof DONUT_TOKENS[number] | null> = {
  legacy: '--chart-series-4',
  starter: '--chart-series-1',
  growth: '--chart-series-2',
  portfolio: '--chart-series-3',
  exempt: null,
  inactive: '--muted-foreground',
}

const EXEMPT_COLOR = '#a855f7'

const SubscriptionDonut = memo(({ mix }: { mix: SubscriptionMixEntry[] }) => {
  const [activeIndex, setActiveIndex] = useState<number | null>(null)
  const t = useResolvedTokens(DONUT_TOKENS)

  const { data, dataColors, total } = useMemo(() => {
    const entries = mix
      .filter(s => s.count > 0)
      .map(s => ({
        name: TIER_LABELS[s.tier] || s.tier,
        value: s.count,
        tier: s.tier,
      }))
    const colors = entries.map(d => {
      const key = TIER_COLOR_KEYS[d.tier]
      if (key === null) return EXEMPT_COLOR
      return key ? t[key] : t['--muted-foreground']
    })
    return { data: entries, dataColors: colors, total: mix.reduce((s, e) => s + e.count, 0) }
  }, [mix, t])

  return (
    <div className="bg-card rounded-lg shadow-sm border border-border p-5">
      <div className="flex items-center gap-2 mb-3">
        <DollarSign className="w-4 h-4 text-muted-foreground" />
        <h3 className="text-sm font-semibold text-foreground">Subscription Mix</h3>
      </div>
      <div style={{ height: 180 }}>
        <ResponsiveContainer width="100%" height="100%">
          <PieChart>
            <Pie
              data={data}
              cx="50%"
              cy="50%"
              innerRadius="55%"
              outerRadius="80%"
              dataKey="value"
              stroke={t['--card']}
              strokeWidth={2}
              animationBegin={0}
              animationDuration={500}
              animationEasing="ease-out"
              onMouseEnter={(_, i) => setActiveIndex(i)}
              onMouseLeave={() => setActiveIndex(null)}
            >
              {data.map((_, i) => (
                <Cell
                  key={i}
                  fill={dataColors[i]}
                  opacity={activeIndex === null || activeIndex === i ? 1 : 0.3}
                  style={{ transition: 'opacity 0.2s ease' }}
                />
              ))}
              <Label
                content={({ viewBox }) => {
                  const { cx, cy } = viewBox as { cx: number; cy: number }
                  return (
                    <text x={cx} y={cy} textAnchor="middle" dominantBaseline="middle">
                      <tspan x={cx} y={cy - 8} className="fill-foreground text-lg font-bold">
                        {total}
                      </tspan>
                      <tspan x={cx} y={cy + 12} className="fill-muted-foreground text-xs">
                        Users
                      </tspan>
                    </text>
                  )
                }}
              />
            </Pie>
            <RechartsTooltip
              isAnimationActive={false}
              content={({ active, payload }) => {
                if (!active || !payload?.[0]) return null
                const d = payload[0].payload as { name: string; value: number }
                return (
                  <div className="bg-card p-2.5 rounded-lg shadow-lg border text-xs">
                    <p className="font-medium">{d.name}: {d.value}</p>
                  </div>
                )
              }}
            />
          </PieChart>
        </ResponsiveContainer>
      </div>
      <div className="flex flex-wrap gap-3 justify-center text-xs mt-1">
        {data.map((entry, i) => (
          <div key={entry.name} className="flex items-center gap-1.5">
            <div className="w-3 h-2.5 rounded-sm" style={{ backgroundColor: dataColors[i] }} />
            <span className="text-muted-foreground">{entry.name}</span>
          </div>
        ))}
      </div>
    </div>
  )
})
SubscriptionDonut.displayName = 'SubscriptionDonut'

// --- compact user funnel (CSS bars, no recharts) ---

const UserFunnel = memo(({ users }: { users: AdminUser[] }) => {
  const { total, connected, subscribed } = useMemo(() => ({
    total: users.length,
    connected: users.filter(u => u.ownerrez_connected).length,
    subscribed: users.filter(u => u.subscription?.status === 'active' || u.subscription_exempt).length,
  }), [users])

  if (total === 0) return null

  const steps = [
    { label: 'Signed Up', value: total, pct: 100 },
    { label: 'OwnerRez Connected', value: connected, pct: Math.round((connected / total) * 100) },
    { label: 'Active / Exempt', value: subscribed, pct: Math.round((subscribed / total) * 100) },
  ]

  return (
    <div className="bg-card rounded-lg shadow-sm border border-border p-5">
      <div className="flex items-center gap-2 mb-4">
        <TrendingUp className="w-4 h-4 text-muted-foreground" />
        <h3 className="text-sm font-semibold text-foreground">User Funnel</h3>
      </div>
      <div className="space-y-3">
        {steps.map(step => (
          <div key={step.label}>
            <div className="flex items-baseline justify-between mb-1">
              <span className="text-xs text-muted-foreground">{step.label}</span>
              <span className="text-sm font-semibold text-foreground tabular-nums">
                {step.value} <span className="text-xs font-normal text-muted-foreground">({step.pct}%)</span>
              </span>
            </div>
            <div className="h-2 rounded-full bg-muted overflow-hidden">
              <div
                className="h-full rounded-full bg-primary transition-all duration-500"
                style={{ width: `${step.pct}%` }}
              />
            </div>
          </div>
        ))}
      </div>
    </div>
  )
})
UserFunnel.displayName = 'UserFunnel'

// --- sync health ---

const SyncHealthSummary = memo(({ health, totalConnected }: { health: SyncHealth; totalConnected: number }) => {
  if (totalConnected === 0) return null

  const segments = [
    { label: 'Healthy', value: health.healthy, color: 'bg-success' },
    { label: 'Partial', value: health.partial, color: 'bg-warning' },
    { label: 'Failing', value: health.failing, color: 'bg-danger' },
    { label: 'Stale (>48h)', value: health.stale, color: 'bg-orange-400' },
    { label: 'No Sync', value: health.noSync, color: 'bg-muted-foreground/40' },
  ].filter(s => s.value > 0)

  const total = segments.reduce((s, seg) => s + seg.value, 0)

  return (
    <div className="bg-card rounded-lg shadow-sm border border-border p-5">
      <div className="flex items-center gap-2 mb-4">
        <Activity className="w-4 h-4 text-muted-foreground" />
        <h3 className="text-sm font-semibold text-foreground">Sync Health</h3>
        <span className="text-xs text-muted-foreground ml-auto">{totalConnected} connected</span>
      </div>

      <div className="h-3 rounded-full overflow-hidden flex bg-muted mb-3">
        {segments.map(seg => (
          <div
            key={seg.label}
            className={`${seg.color} transition-all duration-500`}
            style={{ width: `${(seg.value / total) * 100}%` }}
            title={`${seg.label}: ${seg.value}`}
          />
        ))}
      </div>

      <div className="flex flex-wrap gap-x-4 gap-y-1.5">
        {segments.map(seg => (
          <div key={seg.label} className="flex items-center gap-2 text-xs">
            <span className={`w-2.5 h-2.5 rounded-full ${seg.color}`} />
            <span className="text-muted-foreground">{seg.label}</span>
            <span className="font-medium text-foreground">{seg.value}</span>
          </div>
        ))}
      </div>
    </div>
  )
})
SyncHealthSummary.displayName = 'SyncHealthSummary'

// --- errors section (combined: trend chart + collapsible log) ---

const ERROR_TOKENS = ['--danger', '--border', '--muted-foreground', '--muted'] as const

const ErrorsSection = memo(({ errors }: { errors: WebhookError[] }) => {
  const [showLog, setShowLog] = useState(false)
  const t = useResolvedTokens(ERROR_TOKENS)

  const data = useMemo(() => {
    const buckets: Record<string, number> = {}
    for (let i = 13; i >= 0; i--) {
      const d = new Date()
      d.setDate(d.getDate() - i)
      buckets[d.toISOString().slice(0, 10)] = 0
    }
    for (const err of errors) {
      const day = err.created_at.slice(0, 10)
      if (buckets[day] !== undefined) buckets[day]++
    }
    return Object.entries(buckets).map(([date, count]) => ({ date, count }))
  }, [errors])

  const hasRecentErrors = data.some(d => d.count > 0)

  if (!hasRecentErrors && errors.length === 0) return null

  return (
    <div className="bg-card rounded-lg shadow-sm border border-border p-5">
      <div className="flex items-center gap-2 mb-3">
        <AlertCircle className="w-4 h-4 text-danger" />
        <h3 className="text-sm font-semibold text-foreground">Errors</h3>
        <span className="text-xs text-muted-foreground">{errors.length} total</span>
        <span className="text-xs text-muted-foreground ml-auto">Last 14 days</span>
      </div>

      {hasRecentErrors && (
        <div style={{ height: 120 }} className="mb-3">
          <ResponsiveContainer width="100%" height="100%">
            <BarChart data={data} margin={{ top: 5, right: 5, left: -20, bottom: 0 }}>
              <CartesianGrid strokeDasharray="3 3" stroke={t['--border']} vertical={false} />
              <XAxis
                dataKey="date"
                stroke={t['--muted-foreground']}
                tick={{ fontSize: 10, fill: t['--muted-foreground'] }}
                tickFormatter={(v: string) => {
                  const d = new Date(v + 'T00:00:00')
                  return `${d.getMonth() + 1}/${d.getDate()}`
                }}
                interval={2}
              />
              <YAxis stroke={t['--muted-foreground']} tick={{ fontSize: 10, fill: t['--muted-foreground'] }} allowDecimals={false} />
              <RechartsTooltip
                isAnimationActive={false}
                cursor={{ fill: t['--muted'], opacity: 0.3 }}
                content={({ active, payload }) => {
                  if (!active || !payload?.[0]) return null
                  const d = payload[0].payload as { date: string; count: number }
                  return (
                    <div className="bg-card p-2.5 rounded-lg shadow-lg border text-xs">
                      <p className="font-medium mb-1">{new Date(d.date + 'T00:00:00').toLocaleDateString('en-US', { month: 'short', day: 'numeric' })}</p>
                      <p className="text-danger-fg">{d.count} error{d.count !== 1 ? 's' : ''}</p>
                    </div>
                  )
                }}
              />
              <Bar
                dataKey="count"
                fill={t['--danger']}
                radius={[3, 3, 0, 0]}
                maxBarSize={18}
                animationDuration={500}
                animationEasing="ease-out"
              />
            </BarChart>
          </ResponsiveContainer>
        </div>
      )}

      {errors.length > 0 && (
        <>
          <button
            onClick={() => setShowLog(!showLog)}
            className="text-xs text-muted-foreground hover:text-foreground transition-colors cursor-pointer flex items-center gap-1"
          >
            <ChevronDown className={`w-3 h-3 transition-transform duration-200 ${showLog ? 'rotate-180' : ''}`} />
            {showLog ? 'Hide' : 'View'} error log ({Math.min(errors.length, 20)} most recent)
          </button>

          {showLog && (
            <div className="divide-y mt-3 max-h-48 overflow-y-auto -mx-5 px-5 border-t pt-3">
              {errors.slice(0, 20).map(err => (
                <div key={err.id} className="py-2.5 text-sm first:pt-0">
                  <div className="flex items-center justify-between mb-0.5">
                    <span className="font-medium text-foreground text-xs">{err.event_type}</span>
                    <span className="text-xs text-muted-foreground"><TimeAgo date={err.created_at} /></span>
                  </div>
                  <p className="text-xs text-danger-fg font-mono truncate">{err.processing_error}</p>
                </div>
              ))}
            </div>
          )}
        </>
      )}
    </div>
  )
})
ErrorsSection.displayName = 'ErrorsSection'

// --- user detail panel ---

const UserDetailPanel = ({ userId, onClose }: { userId: string; onClose: () => void }) => {
  const [detail, setDetail] = useState<UserDetail | null>(null)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    api.request<UserDetail>(`/admin/users/${userId}`, { method: 'GET' })
      .then(res => { if (res.success && res.data) setDetail(res.data) })
      .finally(() => setLoading(false))
  }, [userId])

  if (loading) return <div className="p-4 text-sm text-muted-foreground">Loading...</div>
  if (!detail) return <div className="p-4 text-sm text-muted-foreground">Failed to load details</div>

  return (
    <div className="bg-muted/30 border-t px-6 py-4 space-y-4">
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4 text-sm">
        <div>
          <p className="text-muted-foreground text-xs mb-1">Properties</p>
          <p className="font-medium text-foreground">{detail.stats.properties}</p>
        </div>
        <div>
          <p className="text-muted-foreground text-xs mb-1">Bookings</p>
          <p className="font-medium text-foreground">{detail.stats.bookings.toLocaleString()}</p>
        </div>
        <div>
          <p className="text-muted-foreground text-xs mb-1">Renews</p>
          <p className="font-medium text-foreground">
            {detail.subscription?.current_period_end
              ? (() => {
                  const end = new Date(detail.subscription.current_period_end)
                  const days = Math.ceil((end.getTime() - Date.now()) / 86400000)
                  const label = days > 0
                    ? `in ${days}d`
                    : days === 0 ? 'today' : `${Math.abs(days)}d ago`
                  return <span title={end.toLocaleString()}>{label}</span>
                })()
              : '-'}
          </p>
        </div>
      </div>

      {detail.syncStatus && detail.syncStatus.length > 0 && (
        <div>
          <p className="text-xs font-medium text-muted-foreground mb-2">Sync status</p>
          <div className="flex flex-wrap gap-3">
            {detail.syncStatus.map(s => (
              <div key={s.sync_type} className="flex items-center gap-2 text-xs bg-card rounded-md px-3 py-1.5 border">
                <span className={`w-1.5 h-1.5 rounded-full ${s.status === 'success' ? 'bg-success' : s.status === 'partial' ? 'bg-warning' : 'bg-danger'}`} />
                <span className="text-foreground font-medium">{s.sync_type}</span>
                <span className="text-muted-foreground">{s.records_synced} records</span>
                <span className="text-muted-foreground"><TimeAgo date={s.last_sync} /></span>
              </div>
            ))}
          </div>
        </div>
      )}

      <div className="flex justify-end">
        <Button variant="ghost" size="sm" onClick={onClose} className="text-xs">
          Close
        </Button>
      </div>
    </div>
  )
}

// --- sortable header ---

const SortHeader = ({ label, field, current, dir, onSort, className }: {
  label: string
  field: SortField
  current: SortField
  dir: SortDir
  onSort: (f: SortField) => void
  className?: string
}) => (
  <th
    className={`px-5 py-3 text-left text-xs font-medium text-muted-foreground uppercase tracking-wider cursor-pointer hover:text-foreground transition-colors select-none ${className || ''}`}
    onClick={() => onSort(field)}
  >
    <div className="flex items-center gap-1">
      {label}
      {current === field ? (
        dir === 'asc' ? <ChevronUp className="w-3 h-3" /> : <ChevronDown className="w-3 h-3" />
      ) : (
        <ArrowUpDown className="w-3 h-3 opacity-30" />
      )}
    </div>
  </th>
)

// --- main component ---

export const Admin = () => {
  const { state, logout } = useAuth()
  const { addToast } = useToast()
  const navigate = useNavigate()

  // data state
  const [metrics, setMetrics] = useState<AdminMetrics | null>(null)
  const [users, setUsers] = useState<AdminUser[]>([])
  const [errors, setErrors] = useState<WebhookError[]>([])
  const [signupTrend, setSignupTrend] = useState<SignupTrendEntry[]>([])
  const [syncHealth, setSyncHealth] = useState<SyncHealth | null>(null)
  const [syncTotalConnected, setSyncTotalConnected] = useState(0)
  // ui state
  const [loading, setLoading] = useState(true)
  const [isVerified, setIsVerified] = useState(false)
  const [refreshing, setRefreshing] = useState(false)
  const [lastRefreshed, setLastRefreshed] = useState<Date | null>(null)
  const [searchTerm, setSearchTerm] = useState('')
  const [expandedUser, setExpandedUser] = useState<string | null>(null)
  const [sortField, setSortField] = useState<SortField>('created_at')
  const [sortDir, setSortDir] = useState<SortDir>('desc')
  const [page, setPage] = useState(1)

  // delete modal
  const [deleteModal, setDeleteModal] = useState<{ open: boolean; user: AdminUser | null }>({ open: false, user: null })
  const [deleteConfirmText, setDeleteConfirmText] = useState('')
  const [deleting, setDeleting] = useState(false)
  const [deleteError, setDeleteError] = useState<string | null>(null)

  // reset sync modal
  const [resetSyncModal, setResetSyncModal] = useState<{ open: boolean; user: AdminUser | null }>({ open: false, user: null })
  const [resettingSync, setResettingSync] = useState(false)

  // exemption modal
  const [exemptModal, setExemptModal] = useState<{ open: boolean; user: AdminUser | null }>({ open: false, user: null })
  const [exempting, setExempting] = useState(false)

  const autoRefreshRef = useRef<ReturnType<typeof setInterval> | null>(null)

  const loadData = useCallback(async () => {
    const [metricsRes, usersRes, errorsRes, trendRes, syncRes] = await Promise.all([
      api.request<{ metrics: AdminMetrics }>('/admin/metrics', { method: 'GET' }),
      api.request<{ users: AdminUser[] }>('/admin/users', { method: 'GET' }),
      api.request<{ errors: WebhookError[] }>('/admin/errors', { method: 'GET' }),
      api.request<{ trend: SignupTrendEntry[] }>('/admin/signup-trend', { method: 'GET' }),
      api.request<{ syncHealth: SyncHealth; totalConnected: number }>('/admin/sync-health', { method: 'GET' }),
    ])

    if (metricsRes.success && metricsRes.data) setMetrics(metricsRes.data.metrics)
    if (usersRes.success && usersRes.data) setUsers(usersRes.data.users)
    if (errorsRes.success && errorsRes.data) setErrors(errorsRes.data.errors)
    if (trendRes.success && trendRes.data) setSignupTrend(trendRes.data.trend)
    if (syncRes.success && syncRes.data) {
      setSyncHealth(syncRes.data.syncHealth)
      setSyncTotalConnected(syncRes.data.totalConnected)
    }
    setLastRefreshed(new Date())
  }, [])

  useEffect(() => {
    const init = async () => {
      try {
        setLoading(true)
        const verifyResult = await api.request<{ isAdmin: boolean }>('/admin/verify', { method: 'GET' })
        if (!verifyResult.success || !verifyResult.data?.isAdmin) {
          navigate('/dashboard/overview', { replace: true })
          return
        }
        setIsVerified(true)
        await loadData()
      } catch {
        navigate('/dashboard/overview', { replace: true })
      } finally {
        setLoading(false)
      }
    }
    init()
  }, [])

  // auto-refresh every 2 minutes
  useEffect(() => {
    if (!isVerified) return
    autoRefreshRef.current = setInterval(loadData, 120_000)
    return () => { if (autoRefreshRef.current) clearInterval(autoRefreshRef.current) }
  }, [isVerified, loadData])

  const handleRefresh = async () => {
    setRefreshing(true)
    await loadData()
    setRefreshing(false)
  }

  const handleGrantExemption = async () => {
    const user = exemptModal.user
    if (!user) return
    try {
      setExempting(true)
      const result = await api.request(`/admin/users/${user.id}/exempt`, {
        method: 'POST',
        body: JSON.stringify({ exempt: !user.subscription_exempt })
      })
      if (result.success) {
        const usersResult = await api.request<{ users: AdminUser[] }>('/admin/users', { method: 'GET' })
        if (usersResult.success && usersResult.data) setUsers(usersResult.data.users)
        setExemptModal({ open: false, user: null })
      }
    } finally {
      setExempting(false)
    }
  }

  const handleDeleteUser = async () => {
    if (!deleteModal.user || deleteConfirmText !== 'DELETE') return
    try {
      setDeleting(true)
      setDeleteError(null)
      const result = await api.request(`/admin/users/${deleteModal.user.id}`, { method: 'DELETE' })
      if (result.success) {
        await loadData()
        setDeleteModal({ open: false, user: null })
        setDeleteConfirmText('')
        addToast('success', 'Account deleted')
      } else {
        // backend now aborts the whole delete if stripe cancellation fails
        // (STRIPE_CANCELLATION_FAILED) and returns the user's data intact.
        // surface the backend message so the admin knows the account is still
        // alive and can retry or resolve stripe manually.
        const message = result.error || 'Failed to delete account'
        setDeleteError(message)
        addToast('error', message)
      }
    } finally {
      setDeleting(false)
    }
  }

  const handleImpersonate = async (tenantId: string) => {
    const result = await api.request<{ url: string }>(`/admin/users/${tenantId}/impersonate`, { method: 'POST' })
    if (result.success && result.data?.url) {
      window.open(result.data.url, '_blank')
    }
  }

  const handleResetSync = async () => {
    const user = resetSyncModal.user
    if (!user) return
    try {
      setResettingSync(true)
      const result = await api.request<{ url: string }>(`/admin/users/${user.id}/reset-sync`, { method: 'POST' })
      if (!result.success) {
        addToast('error', result.error || 'Failed to reset sync')
        return
      }
      if (!result.data?.url) {
        addToast('error', 'Failed to reset sync')
        return
      }
      window.open(result.data.url, '_blank')
      addToast('success', 'Sync reset — impersonation tab will run initial sync')
      setResetSyncModal({ open: false, user: null })
    } finally {
      setResettingSync(false)
    }
  }

  // sorting
  const handleSort = (field: SortField) => {
    if (sortField === field) {
      setSortDir(d => d === 'asc' ? 'desc' : 'asc')
    } else {
      setSortField(field)
      setSortDir('asc')
    }
    setPage(1)
  }

  const sortedFilteredUsers = useMemo(() => {
    const term = searchTerm.toLowerCase()
    const filtered = users.filter(user =>
      user.email?.toLowerCase().includes(term) ||
      user.company_name?.toLowerCase().includes(term)
    )

    filtered.sort((a, b) => {
      const dir = sortDir === 'asc' ? 1 : -1
      switch (sortField) {
        case 'email':
          return dir * (a.email || '').localeCompare(b.email || '')
        case 'company_name':
          return dir * (a.company_name || '').localeCompare(b.company_name || '')
        case 'status': {
          const statusOrder = (u: AdminUser) => u.subscription_exempt ? 2 : u.subscription?.status === 'active' ? 1 : 0
          return dir * (statusOrder(a) - statusOrder(b))
        }
        case 'created_at':
          return dir * (new Date(a.created_at).getTime() - new Date(b.created_at).getTime())
        default:
          return 0
      }
    })

    return filtered
  }, [users, searchTerm, sortField, sortDir])

  // pagination
  const totalPages = Math.max(1, Math.ceil(sortedFilteredUsers.length / USERS_PER_PAGE))
  const paginatedUsers = sortedFilteredUsers.slice((page - 1) * USERS_PER_PAGE, page * USERS_PER_PAGE)

  const handleLogout = async () => {
    await logout()
    navigate('/')
  }

  if (state.status !== 'authenticated' || loading || !isVerified) {
    return <LoadingState fullScreen />
  }

  return (
    <div className="min-h-screen flex flex-col bg-background">
      <header className="bg-background/80 backdrop-blur-sm border-b sticky top-0 z-50">
        <div className="max-w-7xl mx-auto px-4 md:px-6 py-3 md:py-4">
          <div className="flex justify-between items-center">
            <Link to="/dashboard" className="flex items-center">
              <LogoCube />
              <div className="ml-3">
                <h1 className="text-xl font-semibold text-foreground">Admin Panel</h1>
                <p className="text-xs text-muted-foreground -mt-0.5">System management</p>
              </div>
            </Link>
            <div className="flex items-center gap-3">
              <span className="text-sm text-muted-foreground hidden sm:inline">{state.user?.email}</span>
              <div className="flex items-center gap-2 pl-3 border-l">
                <Link
                  to="/dashboard/overview"
                  className="p-2 text-muted-foreground hover:text-foreground hover:bg-muted rounded-lg transition-all"
                  title="Back to Dashboard"
                >
                  <LayoutDashboard className="w-5 h-5" />
                </Link>
                <Link
                  to="/settings"
                  className="p-2 text-muted-foreground hover:text-foreground hover:bg-muted rounded-lg transition-all"
                  title="Settings"
                >
                  <Settings className="w-5 h-5" />
                </Link>
                <Button variant="ghost" size="sm" onClick={handleLogout}>
                  <LogOut className="w-4 h-4" />
                  <span className="hidden sm:inline">Logout</span>
                </Button>
              </div>
            </div>
          </div>
        </div>
      </header>

      <div className="flex-1 max-w-7xl mx-auto px-4 md:px-6 py-6 md:py-8 w-full space-y-6">

        {/* heading + refresh */}
        <div className="flex items-center justify-between">
          <h2 className="text-lg font-semibold text-foreground">Overview</h2>
          <div className="flex items-center gap-3">
            {lastRefreshed && (
              <span className="text-xs text-muted-foreground hidden sm:inline">
                Updated <TimeAgo date={lastRefreshed.toISOString()} />
              </span>
            )}
            <Button variant="outline" size="sm" onClick={handleRefresh} disabled={refreshing}>
              <RefreshCw className={`w-4 h-4 mr-1.5 ${refreshing ? 'animate-spin' : ''}`} />
              Refresh
            </Button>
          </div>
        </div>

        {/* metrics */}
        {metrics && <MetricStrip metrics={metrics} />}

        {/* growth charts: signup trend (wider) + subscription donut */}
        <div className="grid grid-cols-1 md:grid-cols-5 gap-4 stagger-fade-in" style={{ '--stagger-index': 7 } as React.CSSProperties}>
          <div className="md:col-span-3 [&>*]:h-full">
            <SignupTrendChart data={signupTrend} />
          </div>
          <div className="md:col-span-2 [&>*]:h-full">
            {metrics && <SubscriptionDonut mix={metrics.subscriptionMix} />}
          </div>
        </div>

        {/* operations: funnel + sync health side-by-side */}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4 stagger-fade-in" style={{ '--stagger-index': 8 } as React.CSSProperties}>
          <div className="[&>*]:h-full"><UserFunnel users={users} /></div>
          <div className="[&>*]:h-full">{syncHealth && <SyncHealthSummary health={syncHealth} totalConnected={syncTotalConnected} />}</div>
        </div>

        {/* errors (chart + log combined) */}
        <ErrorsSection errors={errors} />

        {/* users table */}
        <div className="bg-card rounded-lg shadow-sm border border-border">
          <div className="p-4 md:p-6 border-b">
            <div className="flex items-center justify-between mb-4">
              <h2 className="text-lg font-semibold text-foreground">Users</h2>
              <div className="text-sm text-muted-foreground">{sortedFilteredUsers.length} of {users.length}</div>
            </div>
            <div className="relative">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
              <Input
                type="text"
                placeholder="Search by email or company..."
                value={searchTerm}
                onChange={(e) => { setSearchTerm(e.target.value); setPage(1) }}
                className="pl-10"
              />
            </div>
          </div>

          <div className="overflow-x-auto">
            <table className="w-full table-fixed">
              <thead className="bg-muted/40 border-b">
                <tr>
                  <SortHeader label="User" field="email" current={sortField} dir={sortDir} onSort={handleSort} className="w-[25%]" />
                  <SortHeader label="Company" field="company_name" current={sortField} dir={sortDir} onSort={handleSort} className="w-[15%] hidden lg:table-cell" />
                  <SortHeader label="Status" field="status" current={sortField} dir={sortDir} onSort={handleSort} className="w-[10%]" />
                  <th className="w-[8%] px-5 py-3 text-left text-xs font-medium text-muted-foreground uppercase tracking-wider hidden md:table-cell">Plan</th>
                  <th className="w-[8%] px-5 py-3 text-center text-xs font-medium text-muted-foreground uppercase tracking-wider hidden md:table-cell">OwnerRez</th>
                  <SortHeader label="Joined" field="created_at" current={sortField} dir={sortDir} onSort={handleSort} className="w-[12%] hidden lg:table-cell" />
                  <th className="w-[22%] px-5 py-3 text-right text-xs font-medium text-muted-foreground uppercase tracking-wider">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-border">
                {paginatedUsers.map((user) => (
                  <tr key={user.id}>
                    <td colSpan={7} className="p-0">
                      <table className="w-full table-fixed">
                        <tbody>
                          <tr className="hover:bg-muted/30 transition-colors">
                            <td className="w-[25%] px-5 py-3">
                              <button
                                onClick={() => setExpandedUser(expandedUser === user.id ? null : user.id)}
                                className="flex items-center gap-2 text-sm font-medium text-foreground hover:text-primary transition-colors cursor-pointer truncate max-w-full"
                              >
                                <ChevronDown className={`w-3.5 h-3.5 flex-shrink-0 transition-transform duration-200 ${expandedUser === user.id ? 'rotate-180' : ''}`} />
                                <span className="truncate">{user.email}</span>
                              </button>
                            </td>
                            <td className="w-[15%] px-5 py-3 hidden lg:table-cell text-sm text-muted-foreground truncate">
                              {user.company_name || <span className="text-muted-foreground/50">-</span>}
                            </td>
                            <td className="w-[10%] px-5 py-3">
                              <StatusBadge status={user.subscription?.status} exempt={user.subscription_exempt} />
                            </td>
                            <td className="w-[8%] px-5 py-3 hidden md:table-cell text-sm text-muted-foreground">
                              {user.subscription?.billing_cycle === 'yearly' ? 'Yearly' :
                               user.subscription?.billing_cycle === 'monthly' ? 'Monthly' : '-'}
                            </td>
                            <td className="w-[8%] px-5 py-3 hidden md:table-cell text-center">
                              {user.ownerrez_connected ? (
                                <span title="Connected"><Link2 className="w-4 h-4 text-success inline-block" /></span>
                              ) : (
                                <span title="Not connected"><Link2Off className="w-4 h-4 text-muted-foreground inline-block" /></span>
                              )}
                            </td>
                            <td className="w-[12%] px-5 py-3 hidden lg:table-cell text-sm text-muted-foreground tabular-nums">
                              {new Date(user.created_at).toLocaleDateString('en-US', { year: 'numeric', month: 'short', day: '2-digit' })}
                            </td>
                            <td className="w-[22%] px-5 py-3 text-right">
                              <div className="flex items-center justify-end gap-1.5">
                                <Button
                                  variant="ghost"
                                  size="icon-xs"
                                  onClick={(e) => { e.stopPropagation(); handleImpersonate(user.id) }}
                                  title="Login as user"
                                  className="text-muted-foreground hover:text-info"
                                >
                                  <ExternalLink className="w-3.5 h-3.5" />
                                </Button>
                                <Button
                                  variant="ghost"
                                  size="icon-xs"
                                  onClick={(e) => { e.stopPropagation(); setResetSyncModal({ open: true, user }) }}
                                  title="Reset initial sync and impersonate"
                                  className="text-muted-foreground hover:text-info"
                                  disabled={!user.ownerrez_connected}
                                >
                                  <RefreshCw className="w-3.5 h-3.5" />
                                </Button>
                                <Button
                                  variant={user.subscription_exempt ? "destructive" : "outline"}
                                  size="xs"
                                  onClick={(e) => { e.stopPropagation(); setExemptModal({ open: true, user }) }}
                                  title={user.subscription_exempt ? 'Revoke exemption' : 'Grant exemption'}
                                >
                                  <Shield className="w-3.5 h-3.5 md:mr-1" />
                                  <span className="hidden md:inline">{user.subscription_exempt ? 'Revoke' : 'Exempt'}</span>
                                </Button>
                                <Button
                                  variant="ghost"
                                  size="icon-xs"
                                  onClick={(e) => { e.stopPropagation(); setDeleteModal({ open: true, user }) }}
                                  title="Delete account"
                                  className="text-muted-foreground hover:text-destructive"
                                >
                                  <Trash2 className="w-3.5 h-3.5" />
                                </Button>
                              </div>
                            </td>
                          </tr>
                          {expandedUser === user.id && (
                            <tr>
                              <td colSpan={7}>
                                <UserDetailPanel userId={user.id} onClose={() => setExpandedUser(null)} />
                              </td>
                            </tr>
                          )}
                        </tbody>
                      </table>
                    </td>
                  </tr>
                ))}
                {paginatedUsers.length === 0 && (
                  <tr>
                    <td colSpan={7} className="px-5 py-8 text-center text-sm text-muted-foreground">
                      {searchTerm ? 'No users match your search' : 'No users found'}
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>

          {/* pagination */}
          {totalPages > 1 && (
            <div className="p-4 border-t flex items-center justify-between">
              <p className="text-xs text-muted-foreground">
                Showing {((page - 1) * USERS_PER_PAGE) + 1}–{Math.min(page * USERS_PER_PAGE, sortedFilteredUsers.length)} of {sortedFilteredUsers.length}
              </p>
              <div className="flex items-center gap-1">
                <Button
                  variant="outline"
                  size="icon-xs"
                  onClick={() => setPage(p => Math.max(1, p - 1))}
                  disabled={page === 1}
                  aria-label="Previous page"
                >
                  <ChevronLeft className="w-3.5 h-3.5" />
                </Button>
                {Array.from({ length: totalPages }, (_, i) => i + 1)
                  .filter(p => p === 1 || p === totalPages || Math.abs(p - page) <= 1)
                  .reduce<(number | 'ellipsis')[]>((acc, p, i, arr) => {
                    if (i > 0 && p - (arr[i - 1]) > 1) acc.push('ellipsis')
                    acc.push(p)
                    return acc
                  }, [])
                  .map((item, i) =>
                    item === 'ellipsis' ? (
                      <span key={`e${i}`} className="px-1.5 text-xs text-muted-foreground">...</span>
                    ) : (
                      <Button
                        key={item}
                        variant={page === item ? 'default' : 'outline'}
                        size="icon-xs"
                        onClick={() => setPage(item)}
                        className="w-7 h-7 text-xs"
                      >
                        {item}
                      </Button>
                    )
                  )}
                <Button
                  variant="outline"
                  size="icon-xs"
                  onClick={() => setPage(p => Math.min(totalPages, p + 1))}
                  disabled={page === totalPages}
                  aria-label="Next page"
                >
                  <ChevronRight className="w-3.5 h-3.5" />
                </Button>
              </div>
            </div>
          )}
        </div>

      </div>

      {/* delete confirmation modal */}
      <AlertDialog open={deleteModal.open} onOpenChange={(open) => {
        if (!open) {
          setDeleteModal({ open: false, user: null })
          setDeleteConfirmText('')
          setDeleteError(null)
        }
      }}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 bg-danger-subtle rounded-full flex items-center justify-center flex-shrink-0">
                <AlertTriangle className="w-5 h-5 text-danger" />
              </div>
              <div>
                <AlertDialogTitle>Delete Account</AlertDialogTitle>
                <AlertDialogDescription>
                  This will permanently delete the account for: <strong>{deleteModal.user?.email}</strong>
                </AlertDialogDescription>
              </div>
            </div>
          </AlertDialogHeader>

          <div className="p-3 bg-danger-subtle rounded-lg border border-danger/30">
            <p className="text-sm text-danger-fg">
              This action cannot be undone. All data will be permanently deleted including:
            </p>
            <ul className="text-sm text-danger-fg mt-2 list-disc list-inside">
              <li>All properties, bookings, and guests</li>
              <li>Subscription and billing history</li>
              <li>OwnerRez connection</li>
              <li>All settings and preferences</li>
            </ul>
          </div>

          {deleteError && (
            <div className="p-3 bg-danger-subtle rounded-lg border border-danger/30 flex gap-2">
              <AlertCircle className="w-4 h-4 text-danger flex-shrink-0 mt-0.5" />
              <div className="text-sm text-danger-fg">
                <p className="font-medium mb-1">Deletion aborted. The account is still active.</p>
                <p>{deleteError}</p>
              </div>
            </div>
          )}

          <div>
            <FormLabel className="mb-2">
              Type <span className="font-mono bg-muted px-1 rounded">DELETE</span> to confirm
            </FormLabel>
            <Input
              value={deleteConfirmText}
              onChange={(e) => {
                setDeleteConfirmText(e.target.value)
                if (deleteError) setDeleteError(null)
              }}
              placeholder="DELETE"
            />
          </div>

          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <Button
              variant="destructive"
              onClick={handleDeleteUser}
              disabled={deleteConfirmText !== 'DELETE'}
              loading={deleting}
              loadingText="Deleting..."
            >
              Delete Account
            </Button>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      {/* reset sync confirmation modal */}
      <AlertDialog open={resetSyncModal.open} onOpenChange={(open) => {
        if (!open) setResetSyncModal({ open: false, user: null })
      }}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 bg-info-subtle rounded-full flex items-center justify-center flex-shrink-0">
                <RefreshCw className="w-5 h-5 text-info" />
              </div>
              <div>
                <AlertDialogTitle>Reset Sync</AlertDialogTitle>
                <AlertDialogDescription>
                  Reset the initial sync for <strong>{resetSyncModal.user?.email}</strong>?
                </AlertDialogDescription>
              </div>
            </div>
          </AlertDialogHeader>

          <div className="p-3 bg-muted/50 rounded-lg border">
            <p className="text-sm text-muted-foreground">
              This will clear the sync state and open a new tab impersonating the user to re-run the initial data sync from OwnerRez.
            </p>
          </div>

          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <Button
              onClick={handleResetSync}
              loading={resettingSync}
              loadingText="Resetting..."
            >
              <RefreshCw className="w-4 h-4" />
              Reset Sync
            </Button>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      {/* exemption confirmation modal */}
      <AlertDialog open={exemptModal.open} onOpenChange={(open) => {
        if (!open) setExemptModal({ open: false, user: null })
      }}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <div className="flex items-center gap-3">
              <div className={`w-10 h-10 rounded-full flex items-center justify-center flex-shrink-0 ${
                exemptModal.user?.subscription_exempt ? 'bg-danger-subtle' : 'bg-purple-subtle'
              }`}>
                <Shield className={`w-5 h-5 ${exemptModal.user?.subscription_exempt ? 'text-danger' : 'text-purple-fg'}`} />
              </div>
              <div>
                <AlertDialogTitle>
                  {exemptModal.user?.subscription_exempt ? 'Revoke Exemption' : 'Grant Exemption'}
                </AlertDialogTitle>
                <AlertDialogDescription>
                  {exemptModal.user?.subscription_exempt
                    ? <>Remove free access for <strong>{exemptModal.user?.email}</strong>? They will need an active subscription to continue using the platform.</>
                    : <>Grant free unlimited access to <strong>{exemptModal.user?.email}</strong>? This bypasses all subscription checks.</>
                  }
                </AlertDialogDescription>
              </div>
            </div>
          </AlertDialogHeader>

          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <Button
              variant={exemptModal.user?.subscription_exempt ? 'destructive' : 'default'}
              onClick={handleGrantExemption}
              loading={exempting}
              loadingText={exemptModal.user?.subscription_exempt ? 'Revoking...' : 'Granting...'}
            >
              <Shield className="w-4 h-4" />
              {exemptModal.user?.subscription_exempt ? 'Revoke Exemption' : 'Grant Exemption'}
            </Button>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      <Footer />
    </div>
  )
}
