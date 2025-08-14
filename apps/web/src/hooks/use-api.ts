import useSWR, { mutate as globalMutate } from 'swr'
import { api } from '@/lib/api'
import type { ReportTemplate, CreateReportTemplate } from '@/schemas/reports'
import { filterValidUUIDs, isValidDateString } from '@/utils/validation'

export function useFinancial(from?: string, to?: string, tagIds?: string[]) {
  // Validate inputs
  const validFrom = from && isValidDateString(from) ? from : undefined
  const validTo = to && isValidDateString(to) ? to : undefined
  const validTagIds = tagIds ? filterValidUUIDs(tagIds) : undefined
  
  const key = validFrom || validTo || validTagIds ? ['/financial', validFrom, validTo, validTagIds] : null
  return useSWR<any>(key)
}

export function useOccupancy(from?: string, to?: string, tagIds?: string[]) {
  // Validate inputs
  const validFrom = from && isValidDateString(from) ? from : undefined
  const validTo = to && isValidDateString(to) ? to : undefined
  const validTagIds = tagIds ? filterValidUUIDs(tagIds) : undefined
  
  const key = validFrom || validTo || validTagIds ? ['/occupancy', validFrom, validTo, validTagIds] : null
  return useSWR<any>(key)
}

export function usePropertyMetrics(from?: string, to?: string, tagIds?: string[]) {
  // Validate inputs
  const validFrom = from && isValidDateString(from) ? from : undefined
  const validTo = to && isValidDateString(to) ? to : undefined
  const validTagIds = tagIds ? filterValidUUIDs(tagIds) : undefined
  
  const key = validFrom || validTo || validTagIds ? ['/property-metrics', validFrom, validTo, validTagIds] : null
  return useSWR<any>(key, async () => {
    if (!key) return null
    const result = await api.getPropertyMetrics(validFrom || '', validTo || '', validTagIds || [])
    if (!result.success) throw new Error(result.error)
    return result.data
  })
}

export function useGuests(from?: string, to?: string, tagIds?: string[]) {
  // Validate inputs
  const validFrom = from && isValidDateString(from) ? from : undefined
  const validTo = to && isValidDateString(to) ? to : undefined
  const validTagIds = tagIds ? filterValidUUIDs(tagIds) : undefined
  
  const key = validFrom || validTo || validTagIds ? ['/guests', validFrom, validTo, validTagIds] : null
  return useSWR<any>(key, async () => {
    if (!key) return null
    const result = await api.getGuests(validFrom || '', validTo || '', validTagIds || [])
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

export async function historicalSync(fromDate?: string, toDate?: string) {
  const result = await api.historicalSync(fromDate, toDate)
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
      console.log('usePropertyDetail - Fetching URL:', url, 'with params:', params.toString())
      const result = await api.request(url)
      if (!result.success) throw new Error(result.error)
      console.log('usePropertyDetail - Data received for date range:', from, 'to', to, 'tags:', tagIds)
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
    guestId ? `/guest/${guestId}/detail` : null,
    async () => {
      const result = await api.request(`/guest/${encodeURIComponent(guestId!)}/detail`)
      if (!result.success) throw new Error(result.error)
      return result.data
    }
  )
}

export function useMonthDetail(month?: string, year?: string, tagIds?: string[]) {
  const params = new URLSearchParams()
  if (year) params.append('year', year)
  if (month) params.append('month', month)
  if (tagIds && tagIds.length > 0) params.append('tags', tagIds.join(','))
  
  return useSWR<any>(
    month && year ? [`/month-detail`, year, month, tagIds] : null,
    async () => {
      const url = `/month-detail?${params}`
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

export function useOverview(from?: string, to?: string, tagIds?: string[]) {
  const params = new URLSearchParams()
  if (from) params.append('from', from)
  if (to) params.append('to', to)
  if (tagIds && tagIds.length > 0) params.append('tags', tagIds.join(','))
  
  const key = params.toString() ? `/overview?${params}` : '/overview'
  
  return useSWR<any>(key, async () => {
    const result = await api.request(key)
    if (!result.success) throw new Error(result.error)
    return result.data
  })
}

// Report Template hooks
export function useReportTemplates() {
  return useSWR<ReportTemplate[]>('/report-templates', async () => {
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
    id ? `/report-templates/${id}` : null,
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
    '/report-templates',
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
    '/report-templates',
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
    `/report-templates/${id}`,
    optimisticTemplate,
    { revalidate: false }
  )
  
  return optimisticTemplate
}

export async function deleteReportTemplate(id: string) {
  await globalMutate(
    '/report-templates',
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
  return useSWR('/property-tax-status', async () => {
    const result = await api.getPropertyTaxStatus()
    if (!result.success) throw new Error(result.error)
    return result.data?.data || result.data || []
  })
}

// Property Tax Configs hook
export function usePropertyTaxConfigs() {
  return useSWR('/property-tax-configs', async () => {
    const result = await api.getPropertyTaxConfigs()
    if (!result.success) throw new Error(result.error)
    // Handle both formats - the API returns { status: 'success', data: [...] }
    if (result.data?.status === 'success' && result.data?.data) {
      return result.data.data
    }
    return result.data || []
  })
}

export async function savePropertyTaxConfig(data: any): Promise<void> {
  const result = await api.savePropertyTaxConfig(data)
  if (!result.success) {
    throw new Error(result.error)
  }
  // Invalidate cache
  await globalMutate('/property-tax-status')
}