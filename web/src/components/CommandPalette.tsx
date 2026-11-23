import { useCallback, useEffect, useMemo, useState } from 'react'
import { Command } from 'cmdk'
import { useLocation, useNavigate } from 'react-router-dom'
import { Search } from 'lucide-react'
import { useAuth } from '@/contexts/auth'
import { useTheme } from '@/contexts/theme'
import useSWR from 'swr'
import { useOptionalModal } from '@/contexts/modal'
import { useOptionalDashboard } from '@/contexts/dashboard'
import { useEarliestBookingDate, useProperties, useSeasons, useTags } from '@/hooks/use-api'
import { api } from '@/lib/api'
import { buildPeriodOptions } from '@/utils/period-options'
import { useIsAdmin } from '@/components/AccountMenu'
import { Dialog, DialogContent, DialogTitle } from '@/components/ui/dialog'
import { cn } from '@/lib/utils'

interface PaletteItem {
  id: string
  label: string
  hint?: string
  // extra words that should match, such as "p&l" for Financials
  keywords?: string[]
  run: () => void
}

interface PaletteGroup {
  heading: string
  items: PaletteItem[]
}

const DASHBOARDS = [
  { id: 'overview', label: 'Overview', keywords: ['home', 'kpi', 'goals', 'activity'] },
  { id: 'financial', label: 'Financials', keywords: ['p&l', 'profit', 'cash flow', 'taxes', 'revenue', 'expenses'] },
  { id: 'properties', label: 'Properties', keywords: ['performance', 'profitability', 'platforms'] },
  { id: 'occupancy', label: 'Occupancy', keywords: ['calendar', 'timeline', 'pace', 'gaps', 'rate scenario'] },
  { id: 'guests', label: 'Guests', keywords: ['guest list', 'cancelled', 'inquiries', 'repeat stays'] },
]

const SETTINGS = [
  { id: 'account', label: 'Account', keywords: ['email', 'password', 'company name', 'delete'] },
  { id: 'goals', label: 'Goals', keywords: ['targets'] },
  { id: 'expenses', label: 'Expenses', keywords: ['operating expenses', 'templates', 'overrides'] },
  { id: 'property-groups', label: 'Property groups', keywords: ['groups'] },
  { id: 'seasons', label: 'Seasons', keywords: ['peak season', 'period'] },
  { id: 'integrations', label: 'Integrations', keywords: ['ownerrez', 'sync', 'webhooks', 're-sync'] },
  { id: 'billing', label: 'Billing', keywords: ['plan', 'subscription', 'payments', 'stripe'] },
]

// every typed word must appear in the label, code or keywords; label and word-start matches rank first.
// cmdk's default fuzzy match accepts scattered letters across all keywords, which surfaces unrelated rows.
const matchScore = (_value: string, search: string, keywords: string[] = []) => {
  const tokens = search.toLowerCase().trim().split(/\s+/).filter(Boolean)
  if (tokens.length === 0) return 1
  const [label = '', ...rest] = keywords.map((k) => k.toLowerCase())
  const haystack = [label, ...rest].join(' ')
  if (!tokens.every((t) => haystack.includes(t))) return 0
  const query = tokens.join(' ')
  if (label.startsWith(query)) return 1
  const words = haystack.split(/[\s,/-]+/)
  return tokens.every((t) => words.some((w) => w.startsWith(t))) ? 0.75 : 0.4
}

interface SearchResults {
  guests: { id: string; name: string; email: string | null; lastStay: string; stays: number }[]
  bookings: {
    id: string
    guestName: string
    propertyName: string | null
    propertyCode: string | null
    arrival: string
    departure: string
    status: string | null
    reservation: string
  }[]
}

const fetchSearch = async ([, q]: [string, string]) => {
  const result = await api.request<SearchResults>(`/search?q=${encodeURIComponent(q)}`)
  if (!result.success) throw new Error(result.error)
  return result.data
}

const shortDate = (iso: string, withYear: boolean) =>
  new Date(`${iso.slice(0, 10)}T00:00:00`).toLocaleDateString('en-US', {
    month: 'short',
    day: 'numeric',
    ...(withYear ? { year: 'numeric' } : {}),
  })

const stayRange = (arrival: string, departure: string) => `${shortDate(arrival, false)} – ${shortDate(departure, true)}`

const useDebounced = (value: string, ms: number) => {
  const [debounced, setDebounced] = useState(value)
  useEffect(() => {
    const t = setTimeout(() => setDebounced(value), ms)
    return () => clearTimeout(t)
  }, [value, ms])
  return debounced
}

const isMac = typeof navigator !== 'undefined' && /Mac|iPhone|iPad/.test(navigator.userAgent)

// row metrics match the dropdown menus; cmdk marks the keyboard selection, so hover is not styled separately
const itemClass =
  'flex cursor-pointer select-none items-center justify-between gap-3 rounded-sm px-2 py-1.5 text-sm text-foreground outline-none data-[selected=true]:bg-accent data-[selected=true]:text-accent-foreground'

export const CommandPalette = () => {
  const [open, setOpen] = useState(false)
  const [query, setQuery] = useState('')
  const navigate = useNavigate()
  const location = useLocation()
  const { state, logout } = useAuth()
  const { setTheme } = useTheme()
  const modal = useOptionalModal()
  const dashboard = useOptionalDashboard()

  const user = state.status === 'authenticated' ? state.user : null
  const isDemo = user?.isDemo === true
  const isAdmin = useIsAdmin(!!user && !isDemo)
  // before paying, the account's data endpoints answer 403, so the palette leaves them alone
  const canReadData = isDemo || user?.hasActivePlan === true
  const { data: properties = [] } = useProperties(canReadData)
  const { data: tags = [] } = useTags(canReadData)
  const { data: seasons = [] } = useSeasons(canReadData)
  const { data: earliestDate } = useEarliestBookingDate(canReadData)

  // guests and bookings come from the server; they open in a dialog, so they need a page that hosts modals
  const term = useDebounced(query.trim(), 200)
  const { data: remote, isLoading: searching } = useSWR(
    open && modal && term.length >= 2 ? (['palette-search', term] as [string, string]) : null,
    fetchSearch,
    { keepPreviousData: true, revalidateOnFocus: false },
  )

  useEffect(() => {
    const onKeyDown = (e: KeyboardEvent) => {
      if (e.key.toLowerCase() === 'k' && (e.metaKey || e.ctrlKey) && !e.altKey && !e.shiftKey) {
        e.preventDefault()
        setOpen((v) => !v)
      }
    }
    window.addEventListener('keydown', onKeyDown)
    return () => window.removeEventListener('keydown', onKeyDown)
  }, [])

  const close = useCallback(() => setOpen(false), [])

  // each opening starts from an empty query
  useEffect(() => {
    if (!open) setQuery('')
  }, [open])

  const groups = useMemo<PaletteGroup[]>(() => {
    // dashboard links keep the current filters when moving between dashboards
    const search = location.pathname.startsWith('/dashboard') ? location.search : ''
    const list: PaletteGroup[] = [
      {
        heading: 'Dashboards',
        items: DASHBOARDS.map((d) => ({
          id: `dashboard-${d.id}`,
          label: d.label,
          keywords: d.keywords,
          run: () => navigate(`/dashboard/${d.id}${search}`),
        })),
      },
    ]

    // the property detail opens in place, so it needs a page that hosts modals
    if (modal && properties.length > 0) {
      list.push({
        heading: 'Properties',
        items: properties.map((p) => ({
          id: `property-${p.id}`,
          label: p.name,
          hint: p.internal_code ?? undefined,
          keywords: p.internal_code ? [p.internal_code] : undefined,
          run: () => modal.openModal({ type: 'property', propertyId: p.id, propertyName: p.name }),
        })),
      })
    }

    if (modal && remote && term.length >= 2) {
      // the typed term rides along as a keyword so the client filter never hides a server match
      if (remote.guests.length > 0) {
        list.push({
          heading: 'Guests',
          items: remote.guests.map((g) => ({
            id: `guest-${g.id}`,
            label: g.name,
            hint: g.email ?? `Last stay ${shortDate(g.lastStay, true)}`,
            keywords: [g.email ?? '', term],
            run: () => modal.openModal({ type: 'guest', guestId: g.id, guestName: g.name }),
          })),
        })
      }
      if (remote.bookings.length > 0) {
        list.push({
          heading: 'Bookings',
          items: remote.bookings.map((b) => {
            const cancelled = b.status === 'canceled' || b.status === 'cancelled'
            const where = b.propertyCode ?? b.propertyName
            return {
              id: `booking-${b.id}`,
              label: `${b.guestName}${where ? ` · ${where}` : ''}`,
              hint: `${cancelled ? 'Cancelled · ' : ''}${stayRange(b.arrival, b.departure)}`,
              keywords: [b.reservation, b.propertyName ?? '', term],
              run: () => modal.openModal({ type: 'booking', bookingId: b.id, guestName: b.guestName }),
            }
          }),
        })
      }
    }

    // periods and tags change the dashboard's filters, and only appear once something is typed
    if (dashboard && query.trim()) {
      const activeSeasons = seasons.filter((season) => season.isActive)
      const current = dashboard.filters.dateRange
      list.push({
        heading: 'Periods',
        items: buildPeriodOptions(activeSeasons, earliestDate).map((option) => {
          const range = option.getRange(activeSeasons)
          const isCurrent = range.from === current.from && range.to === current.to
          return {
            id: `period-${option.id}`,
            label: option.label,
            hint: isCurrent ? 'Current' : 'Period',
            keywords: ['period', 'date range'],
            // a new period clears any comparison, so re-choosing the current one changes nothing
            run: () => {
              if (!isCurrent) dashboard.updateDateRange(range)
            },
          }
        }),
      })
      if (tags.length > 0) {
        list.push({
          heading: 'Tags',
          items: tags.map((tag) => {
            const active = dashboard.filters.selectedTags.some((t) => t.id === tag.id)
            return {
              id: `tag-${tag.id}`,
              label: tag.name,
              hint: active ? 'Remove filter' : 'Filter',
              keywords: ['tag', 'filter'],
              run: () => dashboard.toggleTag(tag),
            }
          }),
        })
      }
    }

    if (!isDemo) {
      list.push({
        heading: 'Settings',
        items: SETTINGS.map((s) => ({
          id: `settings-${s.id}`,
          label: s.label,
          hint: 'Settings',
          keywords: ['settings', ...s.keywords],
          run: () => navigate(`/settings?tab=${s.id}`),
        })),
      })
    }

    list.push({
      heading: 'Actions',
      items: [
        { id: 'theme-light', label: 'Light theme', keywords: ['appearance', 'mode'], run: () => setTheme('light') },
        { id: 'theme-dark', label: 'Dark theme', keywords: ['appearance', 'mode'], run: () => setTheme('dark') },
        { id: 'theme-system', label: 'System theme', keywords: ['appearance', 'mode', 'auto'], run: () => setTheme('system') },
        ...(isAdmin
          ? [{ id: 'admin', label: 'Admin Dashboard', keywords: ['admin', 'users', 'tenants'], run: () => navigate('/admin') }]
          : []),
        ...(isDemo
          ? [
              { id: 'site', label: 'Back to the site', keywords: ['home', 'landing', 'leave', 'exit demo'], run: () => navigate('/') },
              { id: 'signup', label: 'Create an account', keywords: ['sign up'], run: () => navigate('/signup') },
              { id: 'signin', label: 'Sign in', keywords: ['log in', 'login', 'account'], run: () => navigate('/login') },
            ]
          : []),
        {
          id: 'feedback',
          label: 'Send feedback',
          keywords: ['support', 'contact', 'email'],
          run: () => {
            window.location.href = 'mailto:support@baileysanalytics.com'
          },
        },
        ...(isDemo
          ? []
          : [
              {
                id: 'logout',
                label: 'Log out',
                keywords: ['sign out', 'logout'],
                run: async () => {
                  await logout()
                  navigate('/')
                },
              },
            ]),
      ],
    })
    return list
  }, [
    location.pathname,
    location.search,
    modal,
    dashboard,
    properties,
    remote,
    term,
    query,
    seasons,
    earliestDate,
    tags,
    isDemo,
    isAdmin,
    navigate,
    setTheme,
    logout,
  ])

  if (!user) return null

  return (
    <>
      <button
        type="button"
        onClick={() => setOpen(true)}
        aria-label="Search"
        className="flex h-9 items-center gap-2 rounded-md px-2 text-sm text-muted-foreground transition-colors cursor-pointer hover:bg-muted hover:text-foreground lg:w-44 lg:border lg:border-border lg:px-3"
      >
        <Search className="size-4 shrink-0" aria-hidden />
        <span className="hidden lg:inline">Search</span>
        <kbd className="ml-auto hidden rounded border border-border px-1.5 font-sans text-[11px] text-muted-foreground lg:inline">
          {isMac ? '⌘K' : 'Ctrl K'}
        </kbd>
      </button>

      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent className="top-[20%] translate-y-0 gap-0 overflow-hidden p-0 sm:max-w-lg" showCloseButton={false}>
          <DialogTitle className="sr-only">Search</DialogTitle>
          <Command label="Search" loop filter={matchScore}>
            <div className="flex items-center gap-2 border-b border-border px-3">
              <Search className="size-4 shrink-0 text-muted-foreground" aria-hidden />
              <Command.Input
                autoFocus
                value={query}
                onValueChange={setQuery}
                placeholder={modal ? 'Search guests, bookings, properties, pages' : 'Search pages and settings'}
                className="h-12 w-full bg-transparent text-sm text-foreground outline-none placeholder:text-muted-foreground"
              />
            </div>
            <Command.List className="max-h-[min(60vh,360px)] overflow-y-auto p-1">
              {searching && !remote && (
                <Command.Loading>
                  <p className="px-2 py-1.5 text-sm text-muted-foreground">Searching...</p>
                </Command.Loading>
              )}
              <Command.Empty className="py-8 text-center text-sm text-muted-foreground">
                {searching ? 'Searching...' : 'No results'}
              </Command.Empty>
              {groups.map((group) => (
                <Command.Group
                  key={group.heading}
                  heading={group.heading}
                  className="[&_[cmdk-group-heading]]:px-2 [&_[cmdk-group-heading]]:pt-2 [&_[cmdk-group-heading]]:pb-1 [&_[cmdk-group-heading]]:text-xs [&_[cmdk-group-heading]]:font-medium [&_[cmdk-group-heading]]:text-muted-foreground"
                >
                  {group.items.map((item) => (
                    <Command.Item
                      key={item.id}
                      value={item.id}
                      // the label leads so the filter can rank label matches first
                      keywords={[item.label, ...(item.hint ? [item.hint] : []), ...(item.keywords ?? [])]}
                      onSelect={() => {
                        close()
                        item.run()
                      }}
                      className={cn(itemClass)}
                    >
                      <span className="truncate">{item.label}</span>
                      {item.hint && <span className="shrink-0 text-xs text-muted-foreground">{item.hint}</span>}
                    </Command.Item>
                  ))}
                </Command.Group>
              ))}
            </Command.List>
          </Command>
        </DialogContent>
      </Dialog>
    </>
  )
}
