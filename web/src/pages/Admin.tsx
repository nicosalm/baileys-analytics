import { useCallback, useEffect, useMemo, useState } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import { ArrowLeft, RefreshCw, X } from 'lucide-react'
import { formatCurrency, formatDateDisplay } from '@baileys/utils'
import { useAuth } from '@/contexts/auth'
import { usePageTitle } from '@/hooks/use-page-title'
import { useToast } from '@/contexts/toast'
import { api } from '@/lib/api'
import { cn } from '@/lib/utils'
import {
  applyFilters,
  deriveRow,
  filterKey,
  filterLabel,
  HEALTH,
  PLANS,
  signupsByDay,
  STAGES,
  summarize,
  type AdminError,
  type AdminFilter,
  type AdminTenantRow,
  type AdminUserRow,
} from '@/lib/admin-overview'
import { AppHeader } from '@/components/AppHeader'
import { Footer } from '@/components/Footer'
import { LoadingState } from '@/components/LoadingState'
import { DataTable, type Column } from '@/components/tables/DataTable'
import {
  ErrorsWidget,
  FunnelWidget,
  HEALTH_DOT,
  HealthWidget,
  KpiTiles,
  PlanWidget,
  RenewalsWidget,
  SignupsWidget,
  timeAgo,
} from '@/components/admin/AdminWidgets'
import { AdminUserSheet } from '@/components/admin/AdminUserSheet'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label as FormLabel } from '@/components/ui/label'
import {
  AlertDialog,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from '@/components/ui/alert-dialog'

interface OverviewResponse {
  tenants: AdminTenantRow[]
  errors: AdminError[]
  generatedAt: string
}

const AUTO_REFRESH_MS = 120_000
const SIGNUP_DAYS = 30

const label = <T extends string>(list: ReadonlyArray<{ id: T; label: string }>, id: T) => list.find((x) => x.id === id)?.label ?? id

const columns = (now: number): Column<AdminUserRow>[] => [
  {
    key: 'email',
    header: 'User',
    sortable: true,
    render: (u) => (
      <div className="min-w-0 max-w-64">
        <p className="truncate font-medium text-foreground">{u.company_name || u.email}</p>
        {u.company_name && <p className="truncate text-xs text-muted-foreground">{u.email}</p>}
      </div>
    ),
  },
  { key: 'stageRank', header: 'Stage', sortable: true, render: (u) => label(STAGES, u.stage) },
  {
    key: 'plan',
    header: 'Plan',
    sortable: true,
    render: (u) => (
      <span>
        {label(PLANS, u.plan)}
        {u.paying && u.billing_cycle && <span className="text-muted-foreground">, {u.billing_cycle}</span>}
      </span>
    ),
  },
  { key: 'mrr', header: 'MRR', align: 'right', sortable: true, render: (u) => (u.mrr ? formatCurrency(u.mrr) : '-') },
  { key: 'property_count', header: 'Properties', align: 'right', sortable: true },
  {
    key: 'current_period_end',
    header: 'Renews',
    sortable: true,
    render: (u) =>
      u.paying && u.current_period_end ? (
        <span className="whitespace-nowrap">
          {formatDateDisplay(u.current_period_end)}
          {u.upcomingChange && <span className="block text-xs text-muted-foreground">to {u.upcomingChange}</span>}
        </span>
      ) : (
        '-'
      ),
  },
  {
    key: 'healthRank',
    header: 'Sync',
    sortable: true,
    render: (u) => (
      <span
        className="inline-flex items-center gap-2 whitespace-nowrap"
        title={u.last_data_at ? `Last data ${timeAgo(u.last_data_at, now)}` : undefined}
      >
        <span className={cn('size-2 rounded-full', HEALTH_DOT[u.health])} aria-hidden />
        {label(HEALTH, u.health)}
      </span>
    ),
  },
  {
    key: 'errors_7d',
    header: 'Errors',
    align: 'right',
    sortable: true,
    render: (u) => (u.errors_7d ? <span className="font-medium text-danger-fg">{u.errors_7d}</span> : '-'),
  },
  {
    key: 'created_at',
    header: 'Joined',
    sortable: true,
    render: (u) => <span className="whitespace-nowrap">{formatDateDisplay(u.created_at)}</span>,
  },
]

export const Admin = () => {
  usePageTitle('Admin Dashboard')
  const { state } = useAuth()
  const { addToast } = useToast()
  const navigate = useNavigate()

  const [data, setData] = useState<OverviewResponse | null>(null)
  const [verified, setVerified] = useState(false)
  const [refreshing, setRefreshing] = useState(false)
  const [filters, setFilters] = useState<AdminFilter[]>([])
  const [selectedId, setSelectedId] = useState<string | null>(null)

  const [deleteTarget, setDeleteTarget] = useState<AdminUserRow | null>(null)
  const [deleteConfirmText, setDeleteConfirmText] = useState('')
  const [deleting, setDeleting] = useState(false)
  const [deleteError, setDeleteError] = useState<string | null>(null)
  const [resetTarget, setResetTarget] = useState<AdminUserRow | null>(null)
  const [resetting, setResetting] = useState(false)
  const [exemptTarget, setExemptTarget] = useState<AdminUserRow | null>(null)
  const [exempting, setExempting] = useState(false)

  const loadData = useCallback(async () => {
    const result = await api.request<OverviewResponse>('/admin/overview')
    if (result.success) setData(result.data)
    else addToast('error', 'Failed to load the admin overview')
  }, [addToast])

  // the api answers 404 to non-admins; send them back rather than show an empty page
  useEffect(() => {
    let cancelled = false
    api.request<{ isAdmin: boolean }>('/admin/verify').then(async (result) => {
      if (cancelled) return
      if (!result.success || !result.data.isAdmin) {
        navigate('/dashboard/overview', { replace: true })
        return
      }
      setVerified(true)
      await loadData()
    })
    return () => {
      cancelled = true
    }
  }, [navigate, loadData])

  useEffect(() => {
    if (!verified) return
    const interval = setInterval(loadData, AUTO_REFRESH_MS)
    return () => clearInterval(interval)
  }, [verified, loadData])

  const now = data ? Date.parse(data.generatedAt) : 0
  const rows = useMemo(() => (data?.tenants ?? []).map((t) => deriveRow(t, now)), [data, now])
  const summary = useMemo(() => summarize(rows), [rows])
  const visibleRows = useMemo(() => applyFilters(rows, filters), [rows, filters])
  const emailById = useMemo(() => new Map(rows.map((r) => [r.id, r.company_name || r.email])), [rows])
  const signups = useMemo(() => signupsByDay(rows, SIGNUP_DAYS, now), [rows, now])
  const tableColumns = useMemo(() => columns(now), [now])
  const selected = rows.find((r) => r.id === selectedId) ?? null

  const isActive = useCallback((f: AdminFilter) => filters.some((p) => filterKey(p) === filterKey(f)), [filters])
  const toggleFilter = useCallback(
    (f: AdminFilter) =>
      setFilters((prev) =>
        prev.some((p) => filterKey(p) === filterKey(f)) ? prev.filter((p) => filterKey(p) !== filterKey(f)) : [...prev, f],
      ),
    [],
  )
  const filterProps = { isActive, onToggle: toggleFilter }

  const handleRefresh = async () => {
    setRefreshing(true)
    await loadData()
    setRefreshing(false)
  }

  const handleImpersonate = async (user: AdminUserRow) => {
    const result = await api.request<{ url: string }>(`/admin/users/${user.id}/impersonate`, { method: 'POST' })
    if (result.success && result.data?.url) window.open(result.data.url, '_blank')
    else addToast('error', 'Failed to open a session as this user')
  }

  const handleResetSync = async () => {
    if (!resetTarget) return
    setResetting(true)
    const result = await api.request<{ url: string }>(`/admin/users/${resetTarget.id}/reset-sync`, { method: 'POST' })
    setResetting(false)
    if (!result.success || !result.data?.url) {
      addToast('error', result.success ? 'Failed to reset sync' : result.error)
      return
    }
    window.open(result.data.url, '_blank')
    addToast('success', 'Sync reset. The new tab runs the import as this user.')
    setResetTarget(null)
  }

  const handleToggleExempt = async () => {
    if (!exemptTarget) return
    setExempting(true)
    const result = await api.request(`/admin/users/${exemptTarget.id}/exempt`, {
      method: 'POST',
      body: JSON.stringify({ exempt: !exemptTarget.exempt }),
    })
    setExempting(false)
    if (!result.success) {
      addToast('error', 'Failed to update free access')
      return
    }
    setExemptTarget(null)
    await loadData()
  }

  const closeDelete = () => {
    setDeleteTarget(null)
    setDeleteConfirmText('')
    setDeleteError(null)
  }

  const handleDelete = async () => {
    if (!deleteTarget || deleteConfirmText !== 'DELETE') return
    setDeleting(true)
    setDeleteError(null)
    const result = await api.request(`/admin/users/${deleteTarget.id}`, { method: 'DELETE' })
    setDeleting(false)
    if (result.success) {
      closeDelete()
      setSelectedId(null)
      addToast('success', 'Account deleted')
      await loadData()
    } else {
      // the api aborts the whole delete when Stripe cancellation fails, leaving the account intact
      setDeleteError(result.error || 'Failed to delete account')
    }
  }

  if (state.status !== 'authenticated' || !verified || !data) {
    return <LoadingState fullScreen />
  }

  return (
    <div className="min-h-screen flex flex-col bg-background">
      <AppHeader title="Admin Dashboard">
        <Button asChild variant="ghost" size="sm" className="text-muted-foreground">
          <Link to="/dashboard/overview">
            <ArrowLeft className="w-4 h-4" />
            <span className="hidden sm:inline">Dashboard</span>
          </Link>
        </Button>
      </AppHeader>

      <main className="flex-1 max-w-7xl mx-auto w-full px-4 py-6 md:px-6 md:py-8 space-y-6">
        <div className="flex items-center justify-between gap-3">
          <p className="text-sm text-muted-foreground">
            {rows.length} {rows.length === 1 ? 'user' : 'users'}, updated {timeAgo(data.generatedAt, Date.now())}
          </p>
          <Button variant="outline" size="sm" onClick={handleRefresh} loading={refreshing} loadingText="Refreshing">
            <RefreshCw className="w-4 h-4" />
            Refresh
          </Button>
        </div>

        <KpiTiles summary={summary} {...filterProps} />

        <div className="grid grid-cols-1 gap-4 md:grid-cols-2 xl:grid-cols-3">
          <FunnelWidget summary={summary} {...filterProps} />
          <PlanWidget summary={summary} total={rows.length} {...filterProps} />
          <HealthWidget summary={summary} {...filterProps} />
        </div>

        <div className="grid grid-cols-1 gap-4 lg:grid-cols-2">
          <RenewalsWidget rows={rows} summary={summary} onSelect={setSelectedId} {...filterProps} />
          <ErrorsWidget errors={data.errors} summary={summary} emailById={emailById} now={now} onSelect={setSelectedId} {...filterProps} />
        </div>

        <SignupsWidget days={signups} />

        <section className="space-y-3">
          <div className="flex flex-wrap items-center gap-2">
            <h2 className="mr-2 text-lg font-semibold text-foreground">Users</h2>
            <span className="text-sm text-muted-foreground tabular-nums">
              {visibleRows.length === rows.length ? `${rows.length}` : `${visibleRows.length} of ${rows.length}`}
            </span>
            {filters.map((f) => (
              <button
                key={filterKey(f)}
                type="button"
                onClick={() => toggleFilter(f)}
                aria-label={`Remove filter: ${filterLabel(f)}`}
                className="inline-flex cursor-pointer items-center gap-1 rounded-md border border-primary/20 bg-primary/5 px-2 py-0.5 text-xs text-foreground hover:bg-primary/10"
              >
                {filterLabel(f)}
                <X className="w-3 h-3" aria-hidden />
              </button>
            ))}
            {filters.length > 0 && (
              <Button variant="ghost" size="xs" onClick={() => setFilters([])} className="text-muted-foreground">
                Clear all
              </Button>
            )}
          </div>

          <DataTable
            // a new filter set starts back on page 1
            key={filters.map(filterKey).join('|')}
            data={visibleRows}
            columns={tableColumns}
            getRowId={(u) => u.id}
            onRowClick={(u) => setSelectedId(u.id)}
            sortBy="created_at"
            sortOrder="desc"
            enableSearch
            searchKeys={['email', 'company_name']}
            pageSize={25}
            emptyMessage={filters.length ? 'No users match these filters' : 'No users yet'}
          />
        </section>
      </main>

      <AdminUserSheet
        user={selected}
        errors={data.errors}
        now={now}
        onClose={() => setSelectedId(null)}
        onImpersonate={handleImpersonate}
        onResetSync={setResetTarget}
        onToggleExempt={setExemptTarget}
        onDelete={setDeleteTarget}
      />

      <AlertDialog open={!!deleteTarget} onOpenChange={(open) => !open && closeDelete()}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Delete account</AlertDialogTitle>
            <AlertDialogDescription>
              Permanently delete <strong className="text-foreground">{deleteTarget?.email}</strong> with all of its properties, bookings,
              guests, billing history, OwnerRez connection and settings. This can't be undone.
            </AlertDialogDescription>
          </AlertDialogHeader>
          {deleteError && (
            <div className="rounded-lg border border-danger/30 bg-danger-subtle p-3 text-sm text-danger-fg">
              <p className="font-medium">The account was not deleted.</p>
              <p className="mt-1">{deleteError}</p>
            </div>
          )}
          <div>
            <FormLabel className="mb-2">
              Type <span className="rounded bg-muted px-1 font-mono">DELETE</span> to confirm
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
              onClick={handleDelete}
              disabled={deleteConfirmText !== 'DELETE'}
              loading={deleting}
              loadingText="Deleting"
            >
              Delete account
            </Button>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      <AlertDialog open={!!resetTarget} onOpenChange={(open) => !open && setResetTarget(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Reset sync</AlertDialogTitle>
            <AlertDialogDescription>
              Clear the import state for <strong className="text-foreground">{resetTarget?.email}</strong> and open a new tab signed in as
              them, which re-runs the full import from OwnerRez.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <Button onClick={handleResetSync} loading={resetting} loadingText="Resetting">
              Reset sync
            </Button>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      <AlertDialog open={!!exemptTarget} onOpenChange={(open) => !open && setExemptTarget(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>{exemptTarget?.exempt ? 'Remove free access' : 'Give free access'}</AlertDialogTitle>
            <AlertDialogDescription>
              {exemptTarget?.exempt ? (
                <>
                  <strong className="text-foreground">{exemptTarget.email}</strong> will need an active subscription to keep using Baileys.
                </>
              ) : (
                <>
                  <strong className="text-foreground">{exemptTarget?.email}</strong> gets every feature with no subscription. Their plan
                  shows as Complimentary.
                </>
              )}
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <Button
              variant={exemptTarget?.exempt ? 'destructive' : 'default'}
              onClick={handleToggleExempt}
              loading={exempting}
              loadingText="Saving"
            >
              {exemptTarget?.exempt ? 'Remove free access' : 'Give free access'}
            </Button>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      <Footer />
    </div>
  )
}
