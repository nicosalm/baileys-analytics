import { useEffect, useState, type ReactNode } from 'react'
import { formatCurrency, formatDateDisplay } from '@baileys/utils'
import { api } from '@/lib/api'
import { cn } from '@/lib/utils'
import { HEALTH, PLANS, STAGES, type AdminError, type AdminUserRow } from '@/lib/admin-overview'
import { Sheet, SheetContent, SheetDescription, SheetHeader, SheetTitle } from '@/components/ui/sheet'
import { Button } from '@/components/ui/button'
import { HEALTH_DOT, timeAgo } from './AdminWidgets'

interface UserDetail {
  stats: { properties: number; bookings: number }
  syncStatus: Array<{ sync_type: string; last_sync: string; status: string; records_synced: number }> | null
}

interface AdminUserSheetProps {
  user: AdminUserRow | null
  errors: AdminError[]
  now: number
  onClose: () => void
  onImpersonate: (user: AdminUserRow) => void
  onResetSync: (user: AdminUserRow) => void
  onToggleExempt: (user: AdminUserRow) => void
  onDelete: (user: AdminUserRow) => void
}

const label = <T extends string>(list: ReadonlyArray<{ id: T; label: string }>, id: T) => list.find((x) => x.id === id)?.label ?? id

const Fact = ({ name, children }: { name: string; children: ReactNode }) => (
  <div>
    <dt className="text-xs text-muted-foreground">{name}</dt>
    <dd className="mt-0.5 text-sm font-medium text-foreground">{children}</dd>
  </div>
)

// every value the table and widgets show for one user, plus what only the detail endpoint knows
export const AdminUserSheet = ({
  user,
  errors,
  now,
  onClose,
  onImpersonate,
  onResetSync,
  onToggleExempt,
  onDelete,
}: AdminUserSheetProps) => {
  const [detail, setDetail] = useState<UserDetail | null>(null)
  const userId = user?.id

  useEffect(() => {
    setDetail(null)
    if (!userId) return
    let cancelled = false
    api.request<UserDetail>(`/admin/users/${userId}`).then((res) => {
      if (!cancelled && res.success) setDetail(res.data)
    })
    return () => {
      cancelled = true
    }
  }, [userId])

  const userErrors = user ? errors.filter((e) => e.tenantId === user.id) : []

  return (
    <Sheet open={!!user} onOpenChange={(open) => !open && onClose()}>
      <SheetContent side="right" className="w-full gap-0 overflow-y-auto sm:max-w-md">
        {user && (
          <>
            <SheetHeader className="border-b border-border">
              <SheetTitle className="truncate pr-6">{user.company_name || user.email}</SheetTitle>
              <SheetDescription className="truncate">{user.company_name ? user.email : 'No company name'}</SheetDescription>
            </SheetHeader>

            <div className="space-y-6 p-4">
              <dl className="grid grid-cols-2 gap-x-4 gap-y-4">
                <Fact name="Stage">{label(STAGES, user.stage)}</Fact>
                <Fact name="Plan">
                  {label(PLANS, user.plan)}
                  {user.billing_cycle && user.paying && <span className="font-normal text-muted-foreground">, {user.billing_cycle}</span>}
                </Fact>
                <Fact name="MRR">{user.mrr ? formatCurrency(user.mrr) : '-'}</Fact>
                <Fact name="Active properties">{user.property_count}</Fact>
                <Fact name="Renews">{user.current_period_end ? formatDateDisplay(user.current_period_end) : '-'}</Fact>
                <Fact name="Next renewal">
                  {user.upcomingChange ? (
                    <>
                      Moves to {user.upcomingChange}
                      <span className="block text-xs font-normal text-muted-foreground">
                        {user.pending_notified_at ? `Emailed ${formatDateDisplay(user.pending_notified_at)}` : 'Not emailed yet'}
                      </span>
                    </>
                  ) : (
                    'No change'
                  )}
                </Fact>
                <Fact name="Sync health">
                  <span className="inline-flex items-center gap-2">
                    <span className={cn('size-2 rounded-full', HEALTH_DOT[user.health])} aria-hidden />
                    {label(HEALTH, user.health)}
                  </span>
                  {user.last_data_at && (
                    <span className="block text-xs font-normal text-muted-foreground">Last data {timeAgo(user.last_data_at, now)}</span>
                  )}
                </Fact>
                <Fact name="Errors, 7 days">{user.errors_7d}</Fact>
                <Fact name="Bookings">{detail ? detail.stats.bookings.toLocaleString() : '...'}</Fact>
                <Fact name="Joined">{formatDateDisplay(user.created_at)}</Fact>
              </dl>

              {detail?.syncStatus && detail.syncStatus.length > 0 && (
                <section>
                  <h3 className="mb-2 text-xs font-medium text-muted-foreground">Sync steps</h3>
                  <ul className="space-y-1.5">
                    {detail.syncStatus.map((s) => (
                      <li key={s.sync_type} className="flex items-baseline justify-between gap-3 text-xs">
                        <span className="flex items-center gap-2 text-foreground">
                          <span
                            className={cn(
                              'size-1.5 rounded-full',
                              s.status === 'success' ? 'bg-success' : s.status === 'pending' ? 'bg-muted-foreground/50' : 'bg-danger',
                            )}
                            aria-hidden
                          />
                          {s.sync_type.replace(/_/g, ' ')}
                        </span>
                        <span className="text-muted-foreground tabular-nums">
                          {s.records_synced.toLocaleString()} records, {timeAgo(s.last_sync, now)}
                        </span>
                      </li>
                    ))}
                  </ul>
                </section>
              )}

              {userErrors.length > 0 && (
                <section>
                  <h3 className="mb-2 text-xs font-medium text-muted-foreground">Recent errors</h3>
                  <ul className="space-y-2">
                    {userErrors.slice(0, 5).map((e) => (
                      <li key={`${e.source}-${e.at}`} className="text-xs">
                        <span className="text-muted-foreground">
                          {e.source === 'stripe' ? 'Stripe' : 'OwnerRez'} · {e.event} · {timeAgo(e.at, now)}
                        </span>
                        <span className="mt-0.5 block break-words font-mono text-danger-fg">{e.message}</span>
                      </li>
                    ))}
                  </ul>
                </section>
              )}

              <section className="space-y-2 border-t border-border pt-4">
                <div className="grid grid-cols-2 gap-2">
                  <Button variant="outline" size="sm" onClick={() => onImpersonate(user)}>
                    Log in as user
                  </Button>
                  <Button variant="outline" size="sm" onClick={() => onResetSync(user)} disabled={!user.ownerrez_connected}>
                    Reset sync
                  </Button>
                  <Button variant="outline" size="sm" onClick={() => onToggleExempt(user)}>
                    {user.exempt ? 'Remove free access' : 'Give free access'}
                  </Button>
                  <Button variant="outline" size="sm" className="text-danger-fg hover:text-danger-fg" onClick={() => onDelete(user)}>
                    Delete account
                  </Button>
                </div>
              </section>
            </div>
          </>
        )}
      </SheetContent>
    </Sheet>
  )
}
