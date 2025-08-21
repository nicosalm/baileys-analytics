import { z } from 'zod'
import { filterValidUUIDs, isValidDateString } from '@/utils/validation'

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

    async getFinancial(from?: string, to?: string, tagIds?: string[]): Promise<ApiResult<any>> {
        const params = new URLSearchParams()
        if (from && isValidDateString(from)) params.append('from', from)
        if (to && isValidDateString(to)) params.append('to', to)
        if (tagIds && tagIds.length > 0) {
            const validTagIds = filterValidUUIDs(tagIds)
            if (validTagIds.length > 0) params.append('tags', validTagIds.join(','))
        }
        return this.request(`/financial?${params}`)
    }


    async manualSync(): Promise<ApiResult<any>> {
        return this.request('/manual-sync', { method: 'POST' })
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

    async getOccupancy(from?: string, to?: string, tagIds?: string[]): Promise<ApiResult<any>> {
        const params = new URLSearchParams()
        if (from && isValidDateString(from)) params.append('from', from)
        if (to && isValidDateString(to)) params.append('to', to)
        if (tagIds && tagIds.length > 0) {
            const validTagIds = filterValidUUIDs(tagIds)
            if (validTagIds.length > 0) params.append('tags', validTagIds.join(','))
        }
        return this.request(`/occupancy?${params}`)
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
        return this.request('/report-templates')
    }

    async getReportTemplate(id: string): Promise<ApiResult<any>> {
        return this.request(`/report-templates/${id}`)
    }

    async createReportTemplate(template: any): Promise<ApiResult<any>> {
        return this.request('/report-templates', {
            method: 'POST',
            body: JSON.stringify(template)
        })
    }

    async updateReportTemplate(id: string, template: any): Promise<ApiResult<any>> {
        return this.request(`/report-templates/${id}`, {
            method: 'PUT',
            body: JSON.stringify(template)
        })
    }

    async deleteReportTemplate(id: string): Promise<ApiResult<any>> {
        return this.request(`/report-templates/${id}`, {
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
        return this.request('/tax-calculate', {
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
        return this.request('/property-tax-status')
    }

    async getPropertyTaxConfigs(): Promise<ApiResult<any>> {
        return this.request('/property-tax-configs')
    }

    async getTaxJurisdictions(): Promise<ApiResult<any>> {
        return this.request('/tax-jurisdictions')
    }

    async savePropertyTaxConfig(data: any): Promise<ApiResult<any>> {
        return this.request('/property-tax-configs', {
            method: 'POST',
            body: JSON.stringify(data)
        })
    }

    async updatePropertyTaxConfig(id: string, data: any): Promise<ApiResult<any>> {
        return this.request(`/property-tax-configs/${id}`, {
            method: 'PUT',
            body: JSON.stringify(data)
        })
    }

    async deletePropertyTaxConfig(configId: string): Promise<ApiResult<any>> {
        return this.request(`/property-tax-configs/${configId}`, {
            method: 'DELETE'
        })
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
