import { z } from 'zod'
import { filterValidUUIDs, isValidDateString } from '@/utils/validation'
import { aggregateDailyToWeekly, transformDailyToPeriodFormat } from '@/utils/occupancy-helpers'

const API_BASE = '/api'

type ApiResult<T> =
| { success: true; data: T }
| { success: false; error: string; status?: number }

export type DbResult<T> = ApiResult<T>

const tokenSchema = z.object({
    accessToken: z.string(),
    refreshToken: z.string(),
})

const userSchema = z.object({
    id: z.string(),
    email: z.string(),
    tenantId: z.string().nullable(),
    companyName: z.string().nullable(),
    hasOwnerRezConnection: z.boolean(),
    createdAt: z.string(),
})

const authResponseSchema = z.object({
    userId: z.string(),
    email: z.string(),
    tenantId: z.string().nullable().optional(),
}).merge(tokenSchema)

export type User = z.infer<typeof userSchema>
export type AuthResponse = z.infer<typeof authResponseSchema>
export type TokenPair = z.infer<typeof tokenSchema>

class ApiClient {
    private accessToken: string | null = null

    setAccessToken(token: string | null) {
        this.accessToken = token
    }

    async request<T>(
        path: string,
        options: RequestInit = {}
    ): Promise<ApiResult<T>> {
        try {
            const headers: Record<string, string> = {
                'Content-Type': 'application/json',
            }

            if (this.accessToken) {
                headers['Authorization'] = `Bearer ${this.accessToken}`
            }

            const response = await fetch(`${API_BASE}${path}`, {
                ...options,
                headers: {
                    ...headers,
                    ...options.headers,
                },
            })

            if (!response.ok) {
                const error = await response.json().catch(() => ({ error: 'Request failed' }))
                return {
                    success: false,
                    error: error.error || response.statusText,
                    status: response.status,
                }
            }

            const data = await response.json()
            return { success: true, data }
        } catch (error) {
            return {
                success: false,
                error: error instanceof Error ? error.message : 'Network error',
            }
        }
    }

    async signup(email: string, password: string): Promise<ApiResult<AuthResponse>> {
        const result = await this.request<AuthResponse>('/auth/signup', {
            method: 'POST',
            body: JSON.stringify({ email, password }),
        })

        if (result.success) {
            const parsed = authResponseSchema.safeParse(result.data)
            if (!parsed.success) {
                return { success: false, error: 'Invalid response format' }
            }
            return { success: true, data: parsed.data }
        }

        return result
    }

    async login(email: string, password: string): Promise<ApiResult<AuthResponse>> {
        const result = await this.request<AuthResponse>('/auth/login', {
            method: 'POST',
            body: JSON.stringify({ email, password }),
        })

        if (result.success) {
            const parsed = authResponseSchema.safeParse(result.data)
            if (!parsed.success) {
                return { success: false, error: 'Invalid response format' }
            }
            return { success: true, data: parsed.data }
        }

        return result
    }

    async me(): Promise<ApiResult<User>> {
        const result = await this.request<User>('/auth/me')

        if (result.success) {
            const parsed = userSchema.safeParse(result.data)
            if (!parsed.success) {
                return { success: false, error: 'Invalid response format' }
            }
            return { success: true, data: parsed.data }
        }

        return result
    }

    async refresh(refreshToken: string): Promise<ApiResult<AuthResponse>> {
        const result = await this.request<AuthResponse>('/auth/refresh', {
            method: 'POST',
            body: JSON.stringify({ refreshToken }),
        })

        if (result.success) {
            const parsed = authResponseSchema.safeParse(result.data)
            if (!parsed.success) {
                return { success: false, error: 'Invalid response format' }
            }
            return { success: true, data: parsed.data }
        }

        return result
    }

    async logout(): Promise<ApiResult<void>> {
        return this.request('/auth/logout', { method: 'POST' })
    }

    async initiateOAuth(): Promise<ApiResult<{ authUrl: string }>> {
        return this.request('/oauth/initiate')
    }

    async getFinancial(
        from?: string, 
        to?: string, 
        tagIds?: string[], 
        comparisonFrom?: string, 
        comparisonTo?: string
    ): Promise<ApiResult<any>> {
        const params = new URLSearchParams()
        if (from && isValidDateString(from)) params.append('from', from)
        if (to && isValidDateString(to)) params.append('to', to)
        if (tagIds && tagIds.length > 0) {
            const validTagIds = filterValidUUIDs(tagIds)
            if (validTagIds.length > 0) params.append('tags', validTagIds.join(','))
        }
        if (comparisonFrom && isValidDateString(comparisonFrom)) params.append('comparisonFrom', comparisonFrom)
        if (comparisonTo && isValidDateString(comparisonTo)) params.append('comparisonTo', comparisonTo)
        return this.request(`/financial?${params}`)
    }


    async manualSync(): Promise<ApiResult<any>> {
        return this.request('/manual-sync', { method: 'POST' })
    }

    async syncGuestDetails(): Promise<ApiResult<any>> {
        return this.request('/sync-guest-details', { method: 'POST' })
    }

    async historicalSync(fromDate?: string, toDate?: string): Promise<ApiResult<any>> {
        const params = new URLSearchParams({ type: 'historical' })
        if (fromDate) params.append('from', fromDate)
        if (toDate) params.append('to', toDate)

        return this.request(`/manual-sync?${params}`, { method: 'POST' })
    }

    async getSyncStatus(): Promise<ApiResult<any>> {
        return this.request('/sync-status')
    }

    async getProperties(): Promise<ApiResult<any>> {
        return this.request('/properties')
    }

    async getPropertyMetrics(from?: string, to?: string, tagIds?: string[]): Promise<ApiResult<any>> {
        const params = new URLSearchParams()
        if (from && isValidDateString(from)) params.append('from', from)
        if (to && isValidDateString(to)) params.append('to', to)
        if (tagIds && tagIds.length > 0) {
            const validTagIds = filterValidUUIDs(tagIds)
            if (validTagIds.length > 0) params.append('tags', validTagIds.join(','))
        }
        return this.request(`/property-metrics?${params}`)
    }

    async getOccupancy(
        from?: string, 
        to?: string, 
        tagIds?: string[], 
        comparisonFrom?: string, 
        comparisonTo?: string
    ): Promise<ApiResult<any>> {
        const params = new URLSearchParams()
        if (from && isValidDateString(from)) params.append('from', from)
        if (to && isValidDateString(to)) params.append('to', to)
        
        // Determine which endpoint to use based on date range
        let endpoint = '/occupancy'
        if (from && to) {
            const startDate = new Date(from)
            const endDate = new Date(to)
            const diffInDays = Math.floor((endDate.getTime() - startDate.getTime()) / (1000 * 60 * 60 * 24))
            
            // Use daily endpoint for shorter date ranges
            if (diffInDays <= 31) {
                endpoint = '/occupancy/daily'
                // For daily endpoint, we need to aggregate the daily data into the expected format
            } else if (diffInDays <= 90) {
                // For weekly, fetch daily data and aggregate it
                endpoint = '/occupancy/daily'
            }
        }
        
        if (tagIds && tagIds.length > 0) {
            const validTagIds = filterValidUUIDs(tagIds)
            if (validTagIds.length > 0) params.append('tags', validTagIds.join(','))
        }
        if (comparisonFrom && isValidDateString(comparisonFrom)) params.append('comparisonFrom', comparisonFrom)
        if (comparisonTo && isValidDateString(comparisonTo)) params.append('comparisonTo', comparisonTo)
        
        // For daily endpoint, fetch both daily and regular data
        if (endpoint === '/occupancy/daily' && from && to) {
            // Fetch daily data for the chart
            const dailyResult = await this.request(`${endpoint}?${params}`)
            
            if (!dailyResult.success) return dailyResult
            
            // Also fetch the regular occupancy data to get property breakdowns
            const regularResult = await this.request(`/occupancy?${params}`)
            
            // If comparison dates are provided, also fetch daily data for comparison period
            let comparisonDailyResult = null
            if (comparisonFrom && comparisonTo) {
                const compParams = new URLSearchParams()
                compParams.append('from', comparisonFrom)
                compParams.append('to', comparisonTo)
                if (tagIds && tagIds.length > 0) {
                    const validTagIds = filterValidUUIDs(tagIds)
                    if (validTagIds.length > 0) compParams.append('tags', validTagIds.join(','))
                }
                comparisonDailyResult = await this.request(`${endpoint}?${compParams}`)
            }
            
            // Transform daily data to match the expected occupancy format
            const dailyData = dailyResult.data as Array<{
                date: string
                occupancyRate: number
                bookedProperties: number
                totalProperties: number
            }>
            
            // Use property data from regular endpoint if available
            const regularData = regularResult.success ? regularResult.data as any : null
            const propertyData = regularData?.byProperty || []
            
            // Determine if we should aggregate to weekly
            const startDate = new Date(from)
            const endDate = new Date(to)
            const diffInDays = Math.floor((endDate.getTime() - startDate.getTime()) / (1000 * 60 * 60 * 24))
            const shouldAggregateWeekly = diffInDays > 31 && diffInDays <= 90
            
            // Transform daily data based on date range
            const byPeriod = shouldAggregateWeekly 
                ? aggregateDailyToWeekly(dailyData)
                : transformDailyToPeriodFormat(dailyData)
            
            // Check if we have comparison data
            if (regularData?.current && regularData?.previous && comparisonDailyResult?.success) {
                // Process comparison daily data similar to current period
                const comparisonDailyData = comparisonDailyResult.data as Array<{
                    date: string
                    occupancyRate: number
                    bookedProperties: number
                    totalProperties: number
                }>
                
                // Transform comparison data the same way
                const comparisonByPeriod = shouldAggregateWeekly
                    ? aggregateDailyToWeekly(comparisonDailyData)
                    : transformDailyToPeriodFormat(comparisonDailyData)
                
                // Return with properly formatted comparison data
                return {
                    success: true,
                    data: {
                        current: {
                            overall: regularData.current.overall,
                            byProperty: regularData.current.byProperty || [],
                            byMonth: byPeriod,
                            bookedNights: regularData.current.bookedNights,
                            availableNights: regularData.current.availableNights
                        },
                        previous: {
                            overall: regularData.previous.overall,
                            byProperty: regularData.previous.byProperty || [],
                            byMonth: comparisonByPeriod,
                            bookedNights: regularData.previous.bookedNights,
                            availableNights: regularData.previous.availableNights
                        }
                    }
                }
            } else if (regularData?.current && regularData?.previous) {
                // Regular comparison data without daily (shouldn't happen but handle it)
                return {
                    success: true,
                    data: {
                        current: {
                            overall: regularData.current.overall,
                            byProperty: regularData.current.byProperty || [],
                            byMonth: byPeriod,
                            bookedNights: regularData.current.bookedNights,
                            availableNights: regularData.current.availableNights
                        },
                        previous: regularData.previous
                    }
                }
            } else {
                // No comparison data, return simple format
                return {
                    success: true,
                    data: {
                        overall: regularData?.overall || 
                            (dailyData.reduce((sum, d) => sum + d.bookedProperties, 0) / 
                             dailyData.reduce((sum, d) => sum + d.totalProperties, 0) || 0),
                        byProperty: propertyData,
                        byMonth: byPeriod,
                        bookedNights: regularData?.bookedNights || 
                            dailyData.reduce((sum, d) => sum + d.bookedProperties, 0),
                        availableNights: regularData?.availableNights || 
                            dailyData.reduce((sum, d) => sum + d.totalProperties, 0)
                    }
                }
            }
        }
        
        // For monthly, use the regular endpoint
        return this.request(`${endpoint}?${params}`)
    }

    async getTags(): Promise<ApiResult<any>> {
        return this.request('/tags')
    }

    async getSeasonalAnalysis(year?: number): Promise<ApiResult<any>> {
        const params = new URLSearchParams()
        if (year) params.append('year', year.toString())

        return this.request(`/seasonal-analysis?${params}`)
    }

    async getGuests(from?: string, to?: string, tagIds?: string[]): Promise<ApiResult<any>> {
        const params = new URLSearchParams()
        if (from && isValidDateString(from)) params.append('from', from)
        if (to && isValidDateString(to)) params.append('to', to)
        if (tagIds && tagIds.length > 0) {
            const validTagIds = filterValidUUIDs(tagIds)
            if (validTagIds.length > 0) params.append('tags', validTagIds.join(','))
        }
        return this.request(`/guests?${params}`)
    }

    async getReportTemplates(): Promise<ApiResult<any>> {
        return this.request('/reports/templates')
    }

    async getReportTemplate(id: string): Promise<ApiResult<any>> {
        return this.request(`/reports/templates/${id}`)
    }

    async createReportTemplate(template: any): Promise<ApiResult<any>> {
        return this.request('/reports/templates', {
            method: 'POST',
            body: JSON.stringify(template)
        })
    }

    async updateReportTemplate(id: string, template: any): Promise<ApiResult<any>> {
        return this.request(`/reports/templates/${id}`, {
            method: 'PUT',
            body: JSON.stringify(template)
        })
    }

    async deleteReportTemplate(id: string): Promise<ApiResult<any>> {
        return this.request(`/reports/templates/${id}`, {
            method: 'DELETE'
        })
    }

    async generateReport(templateId: string): Promise<ApiResult<any>> {
        return this.request(`/reports/generate/${templateId}`, {
            method: 'POST'
        })
    }

    async getPlatformFees(propertyId: string, month: string): Promise<ApiResult<any>> {
        const params = new URLSearchParams()
        params.append('property', propertyId)
        params.append('month', month)
        return this.request(`/platform-fees?${params}`)
    }

    async savePlatformFee(data: any): Promise<ApiResult<any>> {
        return this.request('/platform-fees', {
            method: 'POST',
            body: JSON.stringify(data)
        })
    }

    async deletePlatformFee(id: string): Promise<ApiResult<any>> {
        return this.request(`/platform-fees/${id}`, {
            method: 'DELETE'
        })
    }

    async getTaxRemittance(propertyId?: string, periodStart?: string, periodEnd?: string): Promise<ApiResult<any>> {
        const params = new URLSearchParams()
        if (propertyId) params.append('property', propertyId)
        if (periodStart) params.append('start', periodStart)
        if (periodEnd) params.append('end', periodEnd)
        return this.request(`/tax-remittance?${params}`)
    }

    async calculateTax(data: any): Promise<ApiResult<any>> {
        return this.request('/tax/calculate', {
            method: 'POST',
            body: JSON.stringify(data)
        })
    }

    async calculateBulkTax(from?: string, to?: string, propertyId?: string): Promise<ApiResult<any>> {
        const params = new URLSearchParams()
        if (from) params.append('from', from)
        if (to) params.append('to', to)
        if (propertyId) params.append('propertyId', propertyId)
        return this.request(`/tax-calculate-bulk?${params}`)
    }

    async getPropertyTaxStatus(): Promise<ApiResult<any>> {
        return this.request('/tax/status')
    }

    async getPropertyTaxConfigs(): Promise<ApiResult<any>> {
        return this.request('/tax/configs')
    }

    async getTaxJurisdictions(): Promise<ApiResult<any>> {
        return this.request('/tax/jurisdictions')
    }

    async savePropertyTaxConfig(data: any): Promise<ApiResult<any>> {
        return this.request('/tax/configs', {
            method: 'POST',
            body: JSON.stringify(data)
        })
    }

    async updatePropertyTaxConfig(id: string, data: any): Promise<ApiResult<any>> {
        return this.request(`/tax/configs/${id}`, {
            method: 'PUT',
            body: JSON.stringify(data)
        })
    }

    async deletePropertyTaxConfig(configId: string): Promise<ApiResult<any>> {
        return this.request(`/tax/configs/${configId}`, {
            method: 'DELETE'
        })
    }

    async getSeasons(): Promise<ApiResult<any>> {
        return this.request('/seasons')
    }

    async createSeason(data: { name: string; startMonth: number; startDay: number; endMonth: number; endDay: number }): Promise<ApiResult<any>> {
        return this.request('/seasons', {
            method: 'POST',
            body: JSON.stringify(data)
        })
    }

    async updateSeason(id: string, data: { name: string; startMonth: number; startDay: number; endMonth: number; endDay: number }): Promise<ApiResult<any>> {
        return this.request(`/seasons/${id}`, {
            method: 'PUT',
            body: JSON.stringify(data)
        })
    }

    async deleteSeason(id: string): Promise<ApiResult<any>> {
        return this.request(`/seasons/${id}`, {
            method: 'DELETE'
        })
    }

    async toggleSeasonActive(id: string, isActive: boolean): Promise<ApiResult<any>> {
        return this.request(`/seasons/${id}`, {
            method: 'PATCH',
            body: JSON.stringify({ isActive })
        })
    }
    
    async getPropertyPlatforms(propertyId: string): Promise<ApiResult<string[]>> {
        return this.request(`/tax/platforms?propertyId=${propertyId}`)
    }

}

export const api = new ApiClient()

export const authenticatedFetch = async (
    path: string,
    options: RequestInit = {}
): Promise<Response> => {
    const headers: Record<string, string> = {
        'Content-Type': 'application/json',
    }

    const token = api['accessToken'] // Access private property for helper
    if (token) {
        headers['Authorization'] = `Bearer ${token}`
    }

    return fetch(`${API_BASE}${path}`, {
        ...options,
        headers: {
            ...headers,
            ...options.headers,
        },
    })
}
