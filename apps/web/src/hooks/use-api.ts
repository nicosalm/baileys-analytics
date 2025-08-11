import useSWR, { mutate as globalMutate } from 'swr'
import { api } from '@/lib/api'
import { 
  TaxRule, 
  TaxRuleFormData, 
  PropertyTaxConfig,
  TaxContext 
} from '@/types/tax'
import type { ReportTemplate, CreateReportTemplate } from '@/schemas/reports'

export function useFinancial(from?: string, to?: string, tagIds?: string[]) {
  const key = from || to || tagIds ? ['/financial', from, to, tagIds] : null
  return useSWR<any>(key)
}

export function useOccupancy(from?: string, to?: string, tagIds?: string[]) {
  const key = from || to || tagIds ? ['/occupancy', from, to, tagIds] : null
  return useSWR<any>(key)
}

export function usePropertyMetrics(from?: string, to?: string, tagIds?: string[]) {
  const key = from || to || tagIds ? ['/property-metrics', from, to, tagIds] : null
  return useSWR<any>(key, async () => {
    if (!key) return null
    const result = await api.getPropertyMetrics(from || '', to || '', tagIds || [])
    if (!result.success) throw new Error(result.error)
    return result.data
  })
}

export function useGuests(from?: string, to?: string, tagIds?: string[]) {
  const key = from || to || tagIds ? ['/guests', from, to, tagIds] : null
  return useSWR<any>(key, async () => {
    if (!key) return null
    const result = await api.getGuests(from || '', to || '', tagIds || [])
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
    return result.data
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

export function useTaxRules() {
  return useSWR<TaxRule[]>('/tax-rules', async () => {
    const result = await api.getTaxRules()
    if (!result.success) throw new Error(result.error)
    return result.data
  })
}

export function usePropertyTaxConfigs() {
  return useSWR<PropertyTaxConfig[]>('/property-tax-configs', async () => {
    const result = await api.getPropertyTaxConfigs()
    if (!result.success) throw new Error(result.error)
    return result.data
  })
}

export async function createTaxRule(rule: TaxRuleFormData) {
  const result = await api.createTaxRule(rule)
  if (result.success) {
    await globalMutate('/tax-rules')
  }
  return result
}

export async function updateTaxRule(ruleId: string, rule: TaxRuleFormData) {
  const result = await api.updateTaxRule(ruleId, rule)
  if (result.success) {
    await globalMutate('/tax-rules')
  }
  return result
}

export async function deleteTaxRule(ruleId: string) {
  const result = await api.deleteTaxRule(ruleId)
  if (result.success) {
    await globalMutate('/tax-rules')
  }
  return result
}

export async function calculateTaxPreview(amount: number, context: TaxContext) {
  return api.calculateTaxPreview(amount, context)
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
  const result = await api.createReportTemplate(template)
  if (!result.success) throw new Error(result.error)
  
  // Invalidate the templates list cache
  await globalMutate('/report-templates')
  
  return result.data
}

export async function updateReportTemplate(id: string, template: ReportTemplate) {
  const result = await api.updateReportTemplate(id, template)
  if (!result.success) throw new Error(result.error)
  
  // Invalidate both the specific template and the list
  await globalMutate(`/report-templates/${id}`)
  await globalMutate('/report-templates')
  
  return result.data
}

export async function deleteReportTemplate(id: string) {
  const result = await api.deleteReportTemplate(id)
  if (!result.success) throw new Error(result.error)
  
  // Invalidate the templates list cache
  await globalMutate('/report-templates')
  
  return result.data
}

export async function generateReport(templateId: string) {
  const result = await api.generateReport(templateId)
  if (!result.success) throw new Error(result.error)
  return result.data
}