import useSWR, { mutate as globalMutate } from 'swr'
import { api } from '@/lib/api'
import type { Season, SeasonFormData } from '@/types/season'
import type { Goal, GoalFormData, GoalProgress } from '@/types/goal'
import type { Tag } from '@/types/dashboard'
import type { Database } from '@/types/database.types'
import { filterValidUUIDs, isValidDateString } from '@/utils/validation'

export type PropertyRow = Database['public']['Tables']['properties']['Row']
export type BookingRow = Database['public']['Tables']['bookings']['Row']
export type ExpenseTemplateRow = Database['public']['Tables']['expense_templates']['Row']
export type OperatingExpenseRow = Database['public']['Tables']['operating_expenses']['Row']

export interface SaveExpenseTemplatesData {
  propertyId: string
  templates: Array<{ category: string; amount: number; description?: string }>
}

export interface SaveOperatingExpenseData {
  propertyId: string
  year: number
  month: number
  category: string
  amount: number
  description?: string
}

export interface SaveOperatingExpensesBulkData {
  propertyId: string
  year: number
  month: number
  expenses: Array<{ category: string; amount: number; description?: string }>
}

export interface BookingDetailResponse {
  booking: BookingRow & {
    property_name?: string
    property_address?: string
    avgNightlyRate?: number
    notes?: string
  }
  charges: Array<{
    id: string
    type: string
    description: string
    amount: number
  }>
  tags: Array<{ id: string; name: string; color?: string }>
  guestTags: Array<{ id: string; name: string; color?: string }>
}

export interface PropertyDetailResponse {
  property: PropertyRow & {
    ownerrezId?: string
    maxGuests?: number | null
  }
  metrics: {
    totalRevenue: number
    totalBookings: number
    avgStayLength: number
    occupancyRate: number
    totalNights: number
    totalDays: number
    sellableDays?: number
    blockedNights?: number
    avgNightlyRate: number
    platformFees: number
    taxes: number
    operatingExpenses: number
    netRevenue: number
  }
  monthlyData: Array<{
    month: string
    revenue: number
    bookings: number
    occupancy: number
  }>
  revenueByPlatform: Array<{
    platform: string
    revenue: number
    percentage: number
  }>
  recentBookings?: Array<{
    id: string
    guestId?: string
    guestName: string
    arrival: string
    departure: string
    totalAmount: number
    status: string
  }>
  guestStats?: {
    totalGuests: number
    repeatGuests: number
  }
}

export interface GuestDetailResponse {
  guest: {
    name: string
    email: string | null
    phone: string | null
    source: string | null
    firstVisit: string
    lastVisit: string
    totalSpent: number
    bookingCount: number
    avgStayLength?: number
    isRepeat?: boolean
    notes: string | null
    tags?: Array<{ id: string; name: string; color?: string }>
  }
  bookings: Array<{
    id?: string
    propertyName: string
    nights?: number
    platform?: string
    arrival: string
    departure: string
    totalAmount: number
    guestListingSiteFee?: number
    hostServiceFee?: number
    status?: string
    ownerrezBookingId?: string
    charges?: Array<{ type: string; amount: number; description?: string }>
  }>
  spendingTrend: Array<{
    month: string
    amount: number
    bookings: number
  }>
}

export interface PeriodDetailResponse {
  metrics: {
    revenue: number
    bookings: number
    occupancyRate: number
    avgNightlyRate: number
  }
  costs: {
    platformFees: number
    taxes: number
    operatingExpenses: number
    netRevenue: number
  }
  topProperties?: Array<{
    propertyId: string
    propertyName: string
    revenue: number
    bookings: number
    occupancyRate: number
  }>
  bookings?: Array<{
    id: string
    guestId?: string
    guestName: string
    propertyId: string
    propertyName: string
    arrival: string
    departure: string
    totalAmount: number
    ownerrezBookingId?: string
  }>
}

export interface DailyOccupancyEntry {
  date: string
  occupancyRate: number
  bookedProperties: number
  totalProperties: number
}

export interface WebhookHealthResponse {
  lastWebhookHoursAgo: number | null
  lastWebhookTime: string | null
  status: string
  nextRetry: string | null
}

export interface SyncStatusResponse {
  propertyCount: number
  bookingCount: number
  guestCount: number
  lastPropertySync: string | null
  lastBookingSync: string | null
  syncHistory: Array<{
    id: string
    tenant_id: string
    sync_type: string
    last_sync: string | null
    status: string
    records_synced: number
    error_message: string | null
  }>
}

export function useDashboardBatch(
  view: 'overview' | 'financial' | 'properties' | 'occupancy' | 'guests' | 'guests-cancelled' | 'guests-inquiries',
  from?: string,
  to?: string,
  tagIds?: string[],
  comparisonFrom?: string,
  comparisonTo?: string,
  propertyIds?: string[]
) {
  const validFrom = from && isValidDateString(from) ? from : undefined
  const validTo = to && isValidDateString(to) ? to : undefined
  const validTagIds = tagIds ? filterValidUUIDs(tagIds) : undefined
  const validPropertyIds = propertyIds ? filterValidUUIDs(propertyIds) : undefined
  const validCompFrom = comparisonFrom && isValidDateString(comparisonFrom) ? comparisonFrom : undefined
  const validCompTo = comparisonTo && isValidDateString(comparisonTo) ? comparisonTo : undefined

  const key = (validFrom || validTo)
    ? `dashboard-batch:${[view, validFrom, validTo, validTagIds?.join(','), validPropertyIds?.join(','), validCompFrom, validCompTo].filter(Boolean).join('|')}`
    : null

  // eslint-disable-next-line @typescript-eslint/no-explicit-any -- response shape varies by view param
  const result = useSWR<Record<string, any>>(key, async () => {
    const params = new URLSearchParams()
    params.append('view', view)
    if (validFrom) params.append('from', validFrom)
    if (validTo) params.append('to', validTo)
    if (validTagIds && validTagIds.length > 0) params.append('tags', validTagIds.join(','))
    if (validPropertyIds && validPropertyIds.length > 0) params.append('properties', validPropertyIds.join(','))
    if (validCompFrom) params.append('comparisonFrom', validCompFrom)
    if (validCompTo) params.append('comparisonTo', validCompTo)

    const result = await api.request<Record<string, any>>(`/dashboard-batch?${params}`)
    if (!result.success) throw new Error(result.error)
    return result.data
  }, { refreshInterval: 120000, keepPreviousData: true })

  // first load with no error: show loading. retries exhausted: show error.
  // has data + revalidating: show stale data with opacity indicator.
  // has data + revalidation error: suppress error, keep showing data.
  const hasData = !!result.data
  return {
    ...result,
    isLoading: result.isLoading || (!hasData && !result.error),
    isStale: hasData && result.isValidating,
    error: !hasData ? result.error : undefined,
  }
}

export function useProperties() {
  return useSWR<PropertyRow[]>('/properties', async () => {
    const result = await api.getProperties()
    if (!result.success) throw new Error(result.error)
    return result.data?.properties || []
  })
}

export function useTags() {
  return useSWR<Tag[]>('/tags', async () => {
    const result = await api.getTags()
    if (!result.success) throw new Error(result.error)
    return result.data
  })
}

export interface PropertyGroup {
  id: string
  name: string
  description?: string
  propertyIds: string[]
  memberCount: number
}

export function usePropertyGroups() {
  return useSWR<PropertyGroup[]>('/property-groups', async () => {
    const result = await api.getPropertyGroups()
    if (!result.success) throw new Error(result.error)
    return result.data
  })
}

export async function createPropertyGroup(data: { name: string; description?: string; propertyIds: string[] }) {
  const result = await api.createPropertyGroup(data)
  if (result.success) {
    await globalMutate('/property-groups')
  }
  return result
}

export async function updatePropertyGroup(id: string, data: { name?: string; description?: string; propertyIds?: string[] }) {
  const result = await api.updatePropertyGroup(id, data)
  if (result.success) {
    await globalMutate('/property-groups')
  }
  return result
}

export async function deletePropertyGroup(id: string) {
  const result = await api.deletePropertyGroup(id)
  if (result.success) {
    await globalMutate('/property-groups')
  }
  return result
}

export function useWebhookHealth() {
  return useSWR<WebhookHealthResponse>('webhook-health', async () => {
    const result = await api.request<WebhookHealthResponse>('/webhooks/health')
    if (!result.success) throw new Error(result.error)
    return result.data
  }, { refreshInterval: 60000 })
}

export function useSyncStatus() {
  return useSWR<SyncStatusResponse>('/sync-status', async () => {
    const result = await api.getSyncStatus()
    if (!result.success) throw new Error(result.error)
    return result.data
  }, {
    refreshInterval: 10000,
  })
}

export function useBookingDetail(bookingId?: string) {
  return useSWR<BookingDetailResponse>(
    bookingId ? `/bookings/${bookingId}` : null,
    async () => {
      const result = await api.request<BookingDetailResponse>(`/bookings/${encodeURIComponent(bookingId!)}`)
      if (!result.success) throw new Error(result.error)
      return result.data
    }
  )
}

export function usePropertyDetail(propertyId?: string, from?: string, to?: string, tagIds?: string[]) {
  const params = new URLSearchParams()
  if (from) params.append('from', from)
  if (to) params.append('to', to)
  if (tagIds && tagIds.length > 0) params.append('tags', tagIds.join(','))

  const cacheKey = propertyId ? `/property/${propertyId}/detail?${params.toString()}` : null

  return useSWR<PropertyDetailResponse>(
    cacheKey,
    async () => {
      const url = `/property/${encodeURIComponent(propertyId!)}/detail${params.toString() ? `?${params}` : ''}`
      const result = await api.request<PropertyDetailResponse>(url)
      if (!result.success) throw new Error(result.error)
      return result.data
    },
    {
      revalidateOnMount: true,
      revalidateOnFocus: false,
      dedupingInterval: 0,
      revalidateIfStale: true,
      revalidateOnReconnect: true
    }
  )
}

export function useGuestDetail(guestId?: string) {
  return useSWR<GuestDetailResponse>(
    guestId ? `/guests/${guestId}/detail` : null,
    async () => {
      const result = await api.request<GuestDetailResponse>(`/guests/${encodeURIComponent(guestId!)}/detail`)
      if (!result.success) throw new Error(result.error)
      return result.data
    }
  )
}

export function usePeriodDetail(from?: string, to?: string, tagIds?: string[]) {
  const params = new URLSearchParams()

  if (from) params.append('from', from)
  if (to) params.append('to', to)
  if (tagIds && tagIds.length > 0) params.append('tags', tagIds.join(','))

  return useSWR<PeriodDetailResponse>(
    from && to ? [`/period-detail`, from, to, tagIds] : null,
    async () => {
      const url = `/period-detail?${params}`
      const result = await api.request<PeriodDetailResponse>(url)
      if (!result.success) throw new Error(result.error)
      return result.data
    },
    {
      revalidateOnMount: true,
      revalidateOnFocus: false
    }
  )
}

export function useDailyOccupancy(from?: string, to?: string, tagIds?: string[]) {
  const params = new URLSearchParams()
  if (from) params.append('from', from)
  if (to) params.append('to', to)
  if (tagIds && tagIds.length > 0) params.append('tags', tagIds.join(','))

  return useSWR<DailyOccupancyEntry[]>(
    from && to ? [`/occupancy/daily`, from, to, tagIds] : null,
    async () => {
      const result = await api.request<DailyOccupancyEntry[]>(`/occupancy/daily?${params}`)
      if (!result.success) throw new Error(result.error)
      return result.data
    },
    { keepPreviousData: true }
  )
}

export function useOperatingExpenses(propertyId?: string, month?: string) {
  const key = month ? ['/operating-expenses', propertyId || 'all', month] : null
  return useSWR<OperatingExpenseRow[]>(key, async () => {
    if (!month) return []
    const result = await api.getOperatingExpenses(propertyId, month)
    if (!result.success) throw new Error(result.error)
    const data = result.data?.data || result.data || []
    return Array.isArray(data) ? data : []
  }, {
    revalidateOnMount: true,
    revalidateOnFocus: true,
    dedupingInterval: 0
  })
}

export async function saveOperatingExpense(data: SaveOperatingExpenseData): Promise<void> {
  const result = await api.saveOperatingExpense(data)
  if (!result.success) {
    throw new Error(result.error)
  }
  await globalMutate((key: unknown) =>
    Array.isArray(key) && key[0] === '/operating-expenses'
  )
  await globalMutate((key: unknown) =>
    typeof key === 'string' && (key.includes('financial') || key.includes('dashboard-batch'))
  )
}

export async function saveOperatingExpensesBulk(data: SaveOperatingExpensesBulkData): Promise<void> {
  const result = await api.saveOperatingExpensesBulk(data)
  if (!result.success) {
    throw new Error(result.error)
  }
  await globalMutate((key: unknown) =>
    Array.isArray(key) && key[0] === '/operating-expenses'
  )
  await globalMutate((key: unknown) =>
    typeof key === 'string' && (key.includes('financial') || key.includes('dashboard-batch'))
  )
}

export async function deleteOperatingExpense(id: string): Promise<void> {
  const result = await api.deleteOperatingExpense(id)
  if (!result.success) {
    throw new Error(result.error)
  }
  await globalMutate((key: unknown) =>
    Array.isArray(key) && key[0] === '/operating-expenses'
  )
  await globalMutate((key: unknown) =>
    typeof key === 'string' && (key.includes('financial') || key.includes('dashboard-batch'))
  )
}

export function useExpenseTemplates(propertyId?: string) {
  const key = ['/expense-templates', propertyId || 'all']
  return useSWR<ExpenseTemplateRow[]>(key, async () => {
    const result = await api.getExpenseTemplates(propertyId)
    if (!result.success) throw new Error(result.error)
    return result.data?.data || []
  }, { revalidateOnMount: true, dedupingInterval: 0 })
}

export async function saveExpenseTemplates(data: SaveExpenseTemplatesData): Promise<void> {
  const result = await api.saveExpenseTemplates(data)
  if (!result.success) throw new Error(result.error)
  await globalMutate((key: unknown) => Array.isArray(key) && key[0] === '/expense-templates')
  await globalMutate((key: unknown) =>
    typeof key === 'string' && (key.includes('financial') || key.includes('dashboard-batch'))
  )
}

export function useSeasons() {
  return useSWR<Season[]>('/seasons', async () => {
    const result = await api.getSeasons()
    if (!result.success) throw new Error(result.error)
    return result.data || []
  }, { keepPreviousData: true })
}

export function useEarliestBookingDate() {
  return useSWR<string | null>('/bookings/earliest-date', async () => {
    const result = await api.getEarliestBookingDate()
    if (!result.success) return null
    return result.data?.earliestDate ?? null
  }, { keepPreviousData: true })
}

export interface PacingBucket {
  bookedNights: number
  revenue: number
  occupancy: number
  adr: number
  revpar: number
}

export interface PacingMonthSummary {
  month: string
  label: string
  daysInMonth: number
  totalAvailableNights: number
  priorAvailableNights: number
  current: PacingBucket
  priorAtThisPoint: PacingBucket
  priorFinal: PacingBucket
  paceDelta: number
}

export interface PacingProperty {
  propertyId: string
  propertyName: string
  propertyCode: string | null
  currentNights: number
  currentRevenue: number
  priorNightsAtThisPoint: number
  priorRevenueAtThisPoint: number
  priorNightsFinal: number
  priorRevenueFinal: number
  availableNights: number
  priorAvailableNights: number
  paceDelta: number
}

export interface PacingCurvePoint {
  daysOut: number
  currentNights: number
  priorNights: number
  currentRevenue: number
  priorRevenue: number
}

export interface PacingMonthDetail {
  byProperty: PacingProperty[]
  curve: PacingCurvePoint[]
  todayDaysOut: number
}

export interface PacingWindow {
  mode: 'season' | 'rolling'
  label: string
  seasonName?: string
  seasonYear?: number
}

export interface PacingData {
  months: PacingMonthSummary[]
  details: Record<string, PacingMonthDetail>
  propertyCount: number
  window: PacingWindow
}

export function usePacing(tagIds?: string[], propertyIds?: string[]) {
  const validTagIds = tagIds ? filterValidUUIDs(tagIds) : undefined
  const validPropertyIds = propertyIds ? filterValidUUIDs(propertyIds) : undefined

  const key = `pacing:${validTagIds?.join(',') || ''}:${validPropertyIds?.join(',') || ''}`

  const result = useSWR<PacingData>(key, async () => {
    const params = new URLSearchParams()
    if (validTagIds && validTagIds.length > 0) params.append('tags', validTagIds.join(','))
    if (validPropertyIds && validPropertyIds.length > 0) params.append('properties', validPropertyIds.join(','))

    const res = await api.request<PacingData>(`/pacing?${params}`)
    if (!res.success) throw new Error(res.error)
    return res.data
  }, { refreshInterval: 300000, keepPreviousData: true }) // 5 min refresh

  const hasData = !!result.data
  return {
    ...result,
    isLoading: result.isLoading || (!hasData && !result.error),
    error: !hasData ? result.error : undefined,
  }
}

export async function createSeason(data: SeasonFormData) {
  const result = await api.createSeason(data)
  if (result.success) {
    await globalMutate('/seasons')
  }
  return result
}

export async function updateSeason(id: string, data: SeasonFormData) {
  const result = await api.updateSeason(id, data)
  if (result.success) {
    await globalMutate('/seasons')
  }
  return result
}

export async function deleteSeason(id: string) {
  const result = await api.deleteSeason(id)
  if (result.success) {
    await globalMutate('/seasons')
  }
  return result
}

export async function toggleSeasonActive(id: string, isActive: boolean) {
  const result = await api.toggleSeasonActive(id, isActive)
  if (result.success) {
    await globalMutate('/seasons')
  }
  return result
}

export function useGoals() {
  return useSWR<Goal[]>('/goals', async () => {
    const result = await api.getGoals()
    if (!result.success) throw new Error(result.error)
    return result.data || []
  })
}

export function useGoalProgress() {
  return useSWR<GoalProgress[]>('/goals/progress', async () => {
    const result = await api.getGoalProgress()
    if (!result.success) throw new Error(result.error)
    return result.data || []
  }, { keepPreviousData: true })
}

export async function saveGoals(goals: GoalFormData[]) {
  const result = await api.saveGoals(goals)
  if (result.success) {
    await globalMutate('/goals')
    await globalMutate('/goals/progress')
  }
  return result
}

export function useBookingsForRange(from?: string, to?: string) {
  const key = from && to ? `bookings-range:${from}|${to}` : null
  return useSWR<BookingRow[]>(key, async () => {
    const result = await api.getBookings({ startDate: from!, endDate: to!, limit: '1000' })
    if (!result.success) throw new Error(result.error)
    return result.data
  }, { refreshInterval: 120000, keepPreviousData: true })
}
