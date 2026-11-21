import { preload } from 'swr'
import type { DashboardTab } from '@/types/dashboard'
import { api } from '@/lib/api'
import { seasonsFetcher } from '@/hooks/use-api'

// a stored token that is still good for a minute; an expired one would fail and settle the wrong period
function storedAccessToken(): string | null {
  try {
    const session = JSON.parse(localStorage.getItem('baileys-auth') ?? 'null')
    return session?.access_token && session.expires_at * 1000 > Date.now() + 60_000 ? session.access_token : null
  } catch {
    return null
  }
}

// React.lazy and the early prefetch call these same imports, so the browser fetches each chunk once
export const loadDashboardLayout = () => import('@/pages/DashboardLayout')

export const loadTab = {
  overview: () => import('@/components/dashboards/OverviewDashboard'),
  financial: () => import('@/components/dashboards/FinancialDashboard'),
  properties: () => import('@/components/dashboards/PropertiesDashboard'),
  occupancy: () => import('@/components/dashboards/OccupancyDashboard'),
  guests: () => import('@/components/dashboards/GuestsDashboard'),
} satisfies Record<DashboardTab, () => Promise<unknown>>

// on a dashboard url, start the layout and the open tab (which pulls in the chart library)
// while sign-in is still being checked, instead of after the layout has rendered
export function prefetchDashboard(pathname: string) {
  const match = pathname.match(/^\/dashboard(?:\/([a-z]+))?/)
  if (!match) return
  const tab = (match[1] && match[1] in loadTab ? match[1] : 'overview') as DashboardTab
  void loadDashboardLayout()
  void loadTab[tab]()

  // seasons pick the opening period, so a returning visitor loads them alongside sign-in
  const token = storedAccessToken()
  if (token) {
    api.setAccessToken(token)
    preload('/seasons', seasonsFetcher)
  }
}
