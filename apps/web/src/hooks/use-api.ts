import useSWR, { mutate as globalMutate } from 'swr'
import { api } from '@/lib/api'
import type { ReportTemplate, CreateReportTemplate } from '@/schemas/reports'
import type { Season, SeasonFormData } from '@/types/season'
import { filterValidUUIDs, isValidDateString } from '@/utils/validation'
import { measurePerformance } from '@/utils/performance'

// helper to create stable SWR cache keys from parameters
const createCacheKey = (prefix: string, ...parts: (string | string[] | undefined)[]) => {
  const serialized = parts.map(p => {
    if (p === undefined) return ''
    if (Array.isArray(p)) return p.join(',')
    return p
  }).join('|')
  return serialized ? `${prefix}:${serialized}` : null
}

// New batch endpoint hook for dashboards
export function useDashboardBatch(
  view: 'overview' | 'financial' | 'properties' | 'occupancy' | 'guests',
  from?: string,
  to?: string,
  tagIds?: string[],
  comparisonFrom?: string,
  comparisonTo?: string
) {
  const validFrom = from && isValidDateString(from) ? from : undefined
  const validTo = to && isValidDateString(to) ? to : undefined
  const validTagIds = tagIds ? filterValidUUIDs(tagIds) : undefined
  const validCompFrom = comparisonFrom && isValidDateString(comparisonFrom) ? comparisonFrom : undefined
  const validCompTo = comparisonTo && isValidDateString(comparisonTo) ? comparisonTo : undefined

  const key = (validFrom || validTo)
    ? createCacheKey('dashboard-batch', view, validFrom, validTo, validTagIds, validCompFrom, validCompTo)
    : null

  return useSWR<any>(key, async () => {
    const params = new URLSearchParams()
    params.append('view', view)
    if (validFrom) params.append('from', validFrom)
    if (validTo) params.append('to', validTo)
    if (validTagIds && validTagIds.length > 0) params.append('tags', validTagIds.join(','))
    if (validCompFrom) params.append('comparisonFrom', validCompFrom)
    if (validCompTo) params.append('comparisonTo', validCompTo)
    
    const endpoint = `/dashboard-batch?${params}`
    const result = await measurePerformance(
      () => api.request(endpoint),
      `dashboard-batch-${view}`,
      (res: any) => res.success && res.data?._cached === true
    )
    
    if (!result.success) throw new Error(result.error)
    return result.data
  })
}

export function useFinancial(
  from?: string, 
  to?: string, 
  tagIds?: string[],
  comparisonFrom?: string,
  comparisonTo?: string
) {
  const validFrom = from && isValidDateString(from) ? from : undefined
  const validTo = to && isValidDateString(to) ? to : undefined
  const validTagIds = tagIds ? filterValidUUIDs(tagIds) : undefined
  const validCompFrom = comparisonFrom && isValidDateString(comparisonFrom) ? comparisonFrom : undefined
  const validCompTo = comparisonTo && isValidDateString(comparisonTo) ? comparisonTo : undefined

  const key = (validFrom || validTo || validTagIds)
    ? createCacheKey('financial', validFrom, validTo, validTagIds, validCompFrom, validCompTo)
    : null
  return useSWR<any>(key, async () => {
    if (!key) return null
    const params = new URLSearchParams()
    if (validFrom) params.append('from', validFrom)
    if (validTo) params.append('to', validTo)
    if (validTagIds && validTagIds.length > 0) params.append('tags', validTagIds.join(','))
    if (validCompFrom) params.append('comparisonFrom', validCompFrom)
    if (validCompTo) params.append('comparisonTo', validCompTo)
    
    const endpoint = params.toString() ? `/financial?${params}` : '/financial'
    const result = await api.request(endpoint)
    if (!result.success) throw new Error(result.error)
    return result.data
  })
}

export function useOccupancy(
  from?: string, 
  to?: string, 
  tagIds?: string[],
  comparisonFrom?: string,
  comparisonTo?: string
) {
  const validFrom = from && isValidDateString(from) ? from : undefined
  const validTo = to && isValidDateString(to) ? to : undefined
  const validTagIds = tagIds ? filterValidUUIDs(tagIds) : undefined
  const validCompFrom = comparisonFrom && isValidDateString(comparisonFrom) ? comparisonFrom : undefined
  const validCompTo = comparisonTo && isValidDateString(comparisonTo) ? comparisonTo : undefined
  
  const key = validFrom || validTo || validTagIds ? ['/occupancy', validFrom, validTo, validTagIds, validCompFrom, validCompTo] : null
  return useSWR<any>(key, async () => {
    if (!key) return null
    const params = new URLSearchParams()
    if (validFrom) params.append('from', validFrom)
    if (validTo) params.append('to', validTo)
    if (validTagIds && validTagIds.length > 0) params.append('tags', validTagIds.join(','))
    if (validCompFrom) params.append('comparisonFrom', validCompFrom)
    if (validCompTo) params.append('comparisonTo', validCompTo)
    
    const endpoint = params.toString() ? `/occupancy?${params}` : '/occupancy'
    const result = await api.request(endpoint)
    if (!result.success) throw new Error(result.error)
    return result.data
  })
}

export function usePropertyMetrics(
  from?: string, 
  to?: string, 
  tagIds?: string[],
  comparisonFrom?: string,
  comparisonTo?: string
) {
  // Validate inputs
  const validFrom = from && isValidDateString(from) ? from : undefined
  const validTo = to && isValidDateString(to) ? to : undefined
  const validTagIds = tagIds ? filterValidUUIDs(tagIds) : undefined
  const validCompFrom = comparisonFrom && isValidDateString(comparisonFrom) ? comparisonFrom : undefined
  const validCompTo = comparisonTo && isValidDateString(comparisonTo) ? comparisonTo : undefined
  
  const key = validFrom || validTo || validTagIds ? ['/properties/metrics', validFrom, validTo, validTagIds, validCompFrom, validCompTo] : null
  return useSWR<any>(key, async () => {
    if (!key) return null
    const params = new URLSearchParams()
    if (validFrom) params.append('from', validFrom)
    if (validTo) params.append('to', validTo)
    if (validTagIds && validTagIds.length > 0) params.append('tags', validTagIds.join(','))
    if (validCompFrom) params.append('comparisonFrom', validCompFrom)
    if (validCompTo) params.append('comparisonTo', validCompTo)
    
    const endpoint = params.toString() ? `/properties/metrics?${params}` : '/properties/metrics'
    const result = await api.request(endpoint)
    if (!result.success) throw new Error(result.error)
    return result.data
  })
}

export function useGuests(
  from?: string, 
  to?: string, 
  tagIds?: string[],
  comparisonFrom?: string,
  comparisonTo?: string
) {
  // Validate inputs
  const validFrom = from && isValidDateString(from) ? from : undefined
  const validTo = to && isValidDateString(to) ? to : undefined
  const validTagIds = tagIds ? filterValidUUIDs(tagIds) : undefined
  const validCompFrom = comparisonFrom && isValidDateString(comparisonFrom) ? comparisonFrom : undefined
  const validCompTo = comparisonTo && isValidDateString(comparisonTo) ? comparisonTo : undefined
  
  const key = validFrom || validTo || validTagIds ? ['/guests', validFrom, validTo, validTagIds, validCompFrom, validCompTo] : null
  return useSWR<any>(key, async () => {
    if (!key) return null
    const params = new URLSearchParams()
    if (validFrom) params.append('from', validFrom)
    if (validTo) params.append('to', validTo)
    if (validTagIds && validTagIds.length > 0) params.append('tags', validTagIds.join(','))
    if (validCompFrom) params.append('comparisonFrom', validCompFrom)
    if (validCompTo) params.append('comparisonTo', validCompTo)
    
    const endpoint = params.toString() ? `/guests?${params}` : '/guests'
    const result = await api.request(endpoint)
    if (!result.success) throw new Error(result.error)
    return result.data
  })
}

export function useSeasonalAnalysis(year?: number) {
  const key = year ? ['/seasonal-analysis', year] : '/seasonal-analysis'
  return useSWR<any>(key, async () => {
    const result = await api.getSeasonalAnalysis(year)
    if (!result.success) throw new Error(result.error)
    return result.data
  })
}

export function useProperties() {
  return useSWR<any>('/properties', async () => {
    const result = await api.getProperties()
    if (!result.success) throw new Error(result.error)
    return result.data?.properties || []
  })
}

export function useTags() {
  return useSWR<any>('/tags', async () => {
    const result = await api.getTags()
    if (!result.success) throw new Error(result.error)
    return result.data
  })
}

export function useSyncStatus() {
  return useSWR<any>('/sync-status', async () => {
    const result = await api.getSyncStatus()
    if (!result.success) throw new Error(result.error)
    return result.data
  }, {
    refreshInterval: 10000,
  })
}


export async function manualSync() {
  const result = await api.manualSync()
  if (result.success) {
    await globalMutate('/sync-status')
    await globalMutate(() => true, undefined, true)
  }
  return result
}

export async function syncGuestDetails() {
  const result = await api.syncGuestDetails()
  if (result.success) {
    await globalMutate(() => true, undefined, true)
  }
  return result
}

export async function historicalSync() {
  const result = await api.historicalSync()
  if (result.success) {
    await globalMutate('/sync-status')
    await globalMutate(() => true, undefined, true)
  }
  return result
}

// Detail View Hooks
export function useBookingDetail(bookingId?: string) {
  return useSWR<any>(
    bookingId ? `/booking/${bookingId}/detail` : null,
    async () => {
      const result = await api.request(`/booking/${encodeURIComponent(bookingId!)}/detail`)
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
  
  // Use a more specific cache key that includes the exact dates and tags
  const cacheKey = propertyId ? `/property/${propertyId}/detail?${params.toString()}` : null
  
  return useSWR<any>(
    cacheKey,
    async () => {
      const url = `/property/${encodeURIComponent(propertyId!)}/detail${params.toString() ? `?${params}` : ''}`
      const result = await api.request(url)
      if (!result.success) throw new Error(result.error)
      return result.data
    },
    {
      revalidateOnMount: true,
      revalidateOnFocus: false,
      dedupingInterval: 0, // Force fresh fetch
      revalidateIfStale: true,
      revalidateOnReconnect: true
    }
  )
}

export function useGuestDetail(guestId?: string) {
  return useSWR<any>(
    guestId ? `/guests/${guestId}/detail` : null,
    async () => {
      const result = await api.request(`/guests/${encodeURIComponent(guestId!)}/detail`)
      if (!result.success) throw new Error(result.error)
      return result.data
    }
  )
}

export function usePeriodDetail(monthOrFrom?: string, yearOrTo?: string, tagIds?: string[], isDateRange: boolean = false) {
  const params = new URLSearchParams()
  
  if (isDateRange) {
    // When called with date range (for daily/weekly views)
    if (monthOrFrom) params.append('from', monthOrFrom)
    if (yearOrTo) params.append('to', yearOrTo)
  } else {
    // Legacy month/year format
    if (yearOrTo) params.append('year', yearOrTo)
    if (monthOrFrom) params.append('month', monthOrFrom)
  }
  
  if (tagIds && tagIds.length > 0) params.append('tags', tagIds.join(','))
  
  return useSWR<any>(
    monthOrFrom && yearOrTo ? [`/period-detail`, yearOrTo, monthOrFrom, tagIds, isDateRange] : null,
    async () => {
      const url = `/period-detail?${params}`
      const result = await api.request(url)
      if (!result.success) throw new Error(result.error)
      return result.data
    },
    {
      revalidateOnMount: true,
      revalidateOnFocus: false
    }
  )
}

export function usePropertyMonthDetail(propertyId?: string, month?: string, year?: string) {
  return useSWR<any>(
    propertyId && month && year ? `/property/${propertyId}/month/${year}/${month}` : null,
    async () => {
      const result = await api.request(`/property/${encodeURIComponent(propertyId!)}/month/${year}/${month}`)
      if (!result.success) throw new Error(result.error)
      return result.data
    }
  )
}

export function useDailyOccupancy(from?: string, to?: string, tagIds?: string[]) {
  const params = new URLSearchParams()
  if (from) params.append('from', from)
  if (to) params.append('to', to)
  if (tagIds && tagIds.length > 0) params.append('tags', tagIds.join(','))
  
  return useSWR<any>(
    from && to ? [`/occupancy/daily`, from, to, tagIds] : null,
    async () => {
      const result = await api.request(`/occupancy/daily?${params}`)
      if (!result.success) throw new Error(result.error)
      return result.data
    }
  )
}

export function useOverview(
  from?: string, 
  to?: string, 
  tagIds?: string[],
  comparisonFrom?: string,
  comparisonTo?: string
) {
  const params = new URLSearchParams()
  if (from) params.append('from', from)
  if (to) params.append('to', to)
  if (tagIds && tagIds.length > 0) params.append('tags', tagIds.join(','))
  if (comparisonFrom) params.append('comparisonFrom', comparisonFrom)
  if (comparisonTo) params.append('comparisonTo', comparisonTo)
  
  const key = params.toString() ? `/overview?${params}` : '/overview'
  
  return useSWR<any>(key, async () => {
    const result = await api.request(key)
    if (!result.success) throw new Error(result.error)
    return result.data
  })
}

// Report Template hooks
export function useReportTemplates() {
  return useSWR<ReportTemplate[]>('/reports/templates', async () => {
    const result = await api.getReportTemplates()
    if (!result.success) {
      // Return empty array if no templates exist yet
      if (result.status === 404) {
        return []
      }
      throw new Error(result.error)
    }
    return result.data || []
  })
}

export function useReportTemplate(id?: string) {
  return useSWR<ReportTemplate>(
    id ? `/reports/templates/${id}` : null,
    async () => {
      const result = await api.getReportTemplate(id!)
      if (!result.success) throw new Error(result.error)
      return result.data
    }
  )
}

export async function createReportTemplate(template: CreateReportTemplate) {
  // Optimistically add the new template
  const optimisticTemplate: ReportTemplate = {
    ...template,
    id: `temp-${Date.now()}`, // Temporary ID
    createdAt: new Date().toISOString(),
    lastModified: new Date().toISOString(),
    lastRun: undefined,
    lastExportUrl: undefined
  }
  
  await globalMutate(
    '/reports/templates',
    async (currentData: ReportTemplate[] | undefined) => {
      const apiResult = await api.createReportTemplate(template)
      if (!apiResult.success) {
        throw new Error(apiResult.error)
      }
      // Return updated list with actual server data
      return [...(currentData || []).filter(t => !t.id.startsWith('temp-')), apiResult.data]
    },
    {
      optimisticData: (currentData: ReportTemplate[] | undefined) =>
        [...(currentData || []), optimisticTemplate],
      rollbackOnError: true,
      populateCache: true,
      revalidate: false
    }
  )
  
  return optimisticTemplate
}

export async function updateReportTemplate(id: string, template: ReportTemplate) {
  // Optimistically update the template
  const optimisticTemplate: ReportTemplate = {
    ...template,
    id,
    lastModified: new Date().toISOString()
  }
  
  // Update the list cache
  await globalMutate(
    '/reports/templates',
    async (currentData: ReportTemplate[] | undefined) => {
      const apiResult = await api.updateReportTemplate(id, template)
      if (!apiResult.success) {
        throw new Error(apiResult.error)
      }
      // Return updated list with server data
      return currentData?.map(t => t.id === id ? apiResult.data : t) || []
    },
    {
      optimisticData: (currentData: ReportTemplate[] | undefined) =>
        currentData?.map(t => t.id === id ? optimisticTemplate : t) || [],
      rollbackOnError: true,
      populateCache: true,
      revalidate: false
    }
  )
  
  // Also update the individual template cache
  await globalMutate(
    `/reports/templates/${id}`,
    optimisticTemplate,
    { revalidate: false }
  )
  
  return optimisticTemplate
}

export async function deleteReportTemplate(id: string) {
  await globalMutate(
    '/reports/templates',
    async (currentData: ReportTemplate[] | undefined) => {
      const apiResult = await api.deleteReportTemplate(id)
      if (!apiResult.success) {
        throw new Error(apiResult.error)
      }
      // Return filtered list
      return currentData?.filter(t => t.id !== id) || []
    },
    {
      optimisticData: (currentData: ReportTemplate[] | undefined) =>
        currentData?.filter(t => t.id !== id) || [],
      rollbackOnError: true,
      populateCache: true,
      revalidate: false
    }
  )
  
  return { success: true }
}

export async function generateReport(templateId: string) {
  const result = await api.generateReport(templateId)
  if (!result.success) throw new Error(result.error)
  return result.data
}

// Platform Fee hooks
export function usePlatformFees(propertyId: string, month: string) {
  const key = propertyId && month ? ['/platform-fees', propertyId, month] : null
  return useSWR(key, async () => {
    if (!propertyId || !month) return []
    const result = await api.getPlatformFees(propertyId, month)
    if (!result.success) throw new Error(result.error)
    const data = result.data?.data || result.data || []
    return Array.isArray(data) ? data : []
  }, {
    revalidateOnMount: true,
    revalidateOnFocus: true,
    dedupingInterval: 0
  })
}

export async function savePlatformFee(data: any): Promise<void> {
  const result = await api.savePlatformFee(data)
  if (!result.success) {
    throw new Error(result.error)
  }
  // Invalidate cache
  await globalMutate((key: any) =>
    Array.isArray(key) && key[0] === '/platform-fees'
  )
}

// Operating Expenses hooks
export function useOperatingExpenses(propertyId?: string, month?: string) {
  const key = month ? ['/operating-expenses', propertyId || 'all', month] : null
  return useSWR(key, async () => {
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

export async function saveOperatingExpense(data: any): Promise<void> {
  const result = await api.saveOperatingExpense(data)
  if (!result.success) {
    throw new Error(result.error)
  }
  await globalMutate((key: any) =>
    Array.isArray(key) && key[0] === '/operating-expenses'
  )
  // also invalidate financial data
  await globalMutate((key: any) =>
    typeof key === 'string' && (key.includes('financial') || key.includes('dashboard-batch'))
  )
}

export async function saveOperatingExpensesBulk(data: any): Promise<void> {
  const result = await api.saveOperatingExpensesBulk(data)
  if (!result.success) {
    throw new Error(result.error)
  }
  await globalMutate((key: any) =>
    Array.isArray(key) && key[0] === '/operating-expenses'
  )
  await globalMutate((key: any) =>
    typeof key === 'string' && (key.includes('financial') || key.includes('dashboard-batch'))
  )
}

export async function deleteOperatingExpense(id: string): Promise<void> {
  const result = await api.deleteOperatingExpense(id)
  if (!result.success) {
    throw new Error(result.error)
  }
  await globalMutate((key: any) =>
    Array.isArray(key) && key[0] === '/operating-expenses'
  )
  await globalMutate((key: any) =>
    typeof key === 'string' && (key.includes('financial') || key.includes('dashboard-batch'))
  )
}

// Tax Remittance hooks
export function useTaxRemittance(propertyId?: string, periodStart?: string, periodEnd?: string) {
  const key = ['/tax-remittance', propertyId, periodStart, periodEnd].filter(Boolean)
  return useSWR(key.length > 1 ? key : null, async () => {
    const result = await api.getTaxRemittance(propertyId, periodStart, periodEnd)
    if (!result.success) throw new Error(result.error)
    return result.data?.data || result.data || []
  })
}

export function useCalculatedTax(from?: string, to?: string, propertyId?: string) {
  const key = from || to ? ['/tax-calculate-bulk', from, to, propertyId].filter(Boolean) : null
  return useSWR(key, async () => {
    const result = await api.calculateBulkTax(from, to, propertyId)
    if (!result.success) throw new Error(result.error)
    return result.data
  })
}

// Property Tax Status hooks
export function usePropertyTaxStatus() {
  return useSWR('/tax/status', async () => {
    const result = await api.getPropertyTaxStatus()
    if (!result.success) throw new Error(result.error)
    return result.data?.data || result.data || []
  })
}

// Property Tax Configs hook
export function usePropertyTaxConfigs() {
  return useSWR('/tax/configs', async () => {
    const result = await api.getPropertyTaxConfigs()
    if (!result.success) throw new Error(result.error)
    if (result.data?.status === 'success' && result.data?.data) {
      return result.data.data
    }
    return result.data || []
  })
}

export function useSeasons() {
  return useSWR<Season[]>('/seasons', async () => {
    const result = await api.getSeasons()
    if (!result.success) throw new Error(result.error)
    return result.data || []
  })
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

export async function savePropertyTaxConfig(data: any): Promise<void> {
  const result = await api.savePropertyTaxConfig(data)
  if (!result.success) {
    throw new Error(result.error)
  }
  // Invalidate cache
  await globalMutate('/tax/status')
  await globalMutate('/tax/configs')
}

// Tax Jurisdictions hook
export function useTaxJurisdictions(propertyId?: string) {
  return useSWR(
    propertyId ? `/tax/auto-detect?propertyId=${propertyId}` : null,
    async () => {
      const result = await api.request(`/tax/auto-detect?propertyId=${propertyId}`)
      if (!result.success) throw new Error(result.error)
      return result.data
    }
  )
}