import { z } from 'zod'
import {
    TaxRule,
    TaxRuleFormData,
    PropertyTaxConfig,
    TaxCalculationResult,
    TaxContext
} from '@/types/tax'

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
        if (from) params.append('from', from)
        if (to) params.append('to', to)
        if (tagIds && tagIds.length > 0) params.append('tags', tagIds.join(','))

        return this.request(`/financial?${params}`)
    }

    async getTaxRules(): Promise<ApiResult<TaxRule[]>> {
        const result = await this.request<{ status: string; data: TaxRule[] }>('/tax-rules')

        if (result.success && result.data.status === 'success') {
            return { success: true, data: result.data.data }
        }

        return {
            success: false,
            error: result.success ? 'Failed to fetch tax rules' : result.error
        }
    }

    async getPropertyTaxConfigs(): Promise<ApiResult<PropertyTaxConfig[]>> {
        const result = await this.request<{ status: string; data: PropertyTaxConfig[] }>('/property-tax-configs')

        if (result.success && result.data.status === 'success') {
            return { success: true, data: result.data.data }
        }

        return {
            success: false,
            error: result.success ? 'Failed to fetch property tax configs' : result.error
        }
    }

    async createTaxRule(rule: TaxRuleFormData): Promise<ApiResult<TaxRule>> {
        const result = await this.request<{ status: string; data: TaxRule }>('/tax-rules', {
            method: 'POST',
            body: JSON.stringify(rule)
        })

        if (result.success && result.data.status === 'success') {
            return { success: true, data: result.data.data }
        }

        return {
            success: false,
            error: result.success ? 'Failed to create tax rule' : result.error
        }
    }

    async updateTaxRule(ruleId: string, rule: TaxRuleFormData): Promise<ApiResult<TaxRule>> {
        const result = await this.request<{ status: string; data: TaxRule }>(`/tax-rules/${ruleId}`, {
            method: 'PUT',
            body: JSON.stringify(rule)
        })

        if (result.success && result.data.status === 'success') {
            return { success: true, data: result.data.data }
        }

        return {
            success: false,
            error: result.success ? 'Failed to update tax rule' : result.error
        }
    }

    async deleteTaxRule(ruleId: string): Promise<ApiResult<void>> {
        const result = await this.request<{ status: string }>(`/tax-rules/${ruleId}`, {
            method: 'DELETE'
        })

        if (result.success && result.data.status === 'success') {
            return { success: true, data: undefined }
        }

        return {
            success: false,
            error: result.success ? 'Failed to delete tax rule' : result.error
        }
    }

    async calculateTaxPreview(amount: number, context: TaxContext): Promise<ApiResult<TaxCalculationResult>> {
        const result = await this.request<{ status: string; data: TaxCalculationResult }>('/tax-preview', {
            method: 'POST',
            body: JSON.stringify({ amount, context })
        })

        if (result.success && result.data.status === 'success') {
            return { success: true, data: result.data.data }
        }

        return {
            success: false,
            error: result.success ? 'Failed to calculate tax preview' : result.error
        }
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
        if (from) params.append('from', from)
        if (to) params.append('to', to)
        if (tagIds && tagIds.length > 0) params.append('tags', tagIds.join(','))

        return this.request(`/property-metrics?${params}`)
    }

    async getOccupancy(from?: string, to?: string, tagIds?: string[]): Promise<ApiResult<any>> {
        const params = new URLSearchParams()
        if (from) params.append('from', from)
        if (to) params.append('to', to)
        if (tagIds && tagIds.length > 0) params.append('tags', tagIds.join(','))

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
        if (from) params.append('from', from)
        if (to) params.append('to', to)
        if (tagIds && tagIds.length > 0) params.append('tags', tagIds.join(','))

        return this.request(`/guests?${params}`)
    }

    async getVIPSettings(): Promise<ApiResult<{ vipSpendThreshold: number; vipBookingThreshold: number }>> {
        const result = await this.request<{ status: string; data: { vipSpendThreshold: number; vipBookingThreshold: number } }>('/vip-settings')

        if (result.success && result.data.status === 'success') {
            return { success: true, data: result.data.data }
        }

        return {
            success: false,
            error: result.success ? 'Failed to fetch VIP settings' : result.error
        }
    }

    async updateVIPSettings(settings: { vipSpendThreshold?: number; vipBookingThreshold?: number }): Promise<ApiResult<{ vipSpendThreshold: number; vipBookingThreshold: number }>> {
        const result = await this.request<{ status: string; data: { vipSpendThreshold: number; vipBookingThreshold: number } }>('/vip-settings', {
            method: 'PUT',
            body: JSON.stringify(settings)
        })

        if (result.success && result.data.status === 'success') {
            return { success: true, data: result.data.data }
        }

        return {
            success: false,
            error: result.success ? 'Failed to update VIP settings' : result.error
        }
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
