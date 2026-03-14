import type { Tag } from '@/types/dashboard'
import type { Season } from '@/types/season'
import type { Goal, GoalProgress } from '@/types/goal'
import type {
  PropertyRow,
  BookingRow,
  ExpenseTemplateRow,
  OperatingExpenseRow,
  PropertyTaxConfigRow,
  SaveExpenseTemplatesData,
  SaveOperatingExpenseData,
  SaveOperatingExpensesBulkData,
  SavePropertyTaxConfigData,
  SyncStatusResponse,
} from '@/hooks/use-api'

const API_BASE = '/api'

type ApiResult<T> =
| { success: true; data: T }
| { success: false; error: string; status?: number }

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
                // For 401s, clear the in-memory token but don't nuke localStorage
                // or force-redirect. The AuthProvider's onAuthStateChange listener
                // will detect session expiry (via Supabase auto-refresh failure)
                // and handle the redirect through ProtectedRoute naturally.
                if (response.status === 401) {
                    this.accessToken = null
                }

                const error = await response.json().catch(() => ({ error: 'Request failed' }))
                return {
                    success: false,
                    error: response.status === 401
                        ? 'Session expired. Please log in again.'
                        : (error.error || response.statusText),
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

    oauth = {
        initiate: (): Promise<ApiResult<{ authUrl: string }>> => {
            return this.request('/oauth/initiate')
        },
        disconnect: (): Promise<ApiResult<{ success: boolean }>> => {
            return this.request('/oauth/disconnect', { method: 'POST' })
        },
        callback: (code: string, state: string): Promise<ApiResult<{ success: boolean }>> => {
            return this.request('/oauth/callback', {
                method: 'POST',
                body: JSON.stringify({ code, state })
            })
        }
    }

    async initiateOAuth(): Promise<ApiResult<{ authUrl: string }>> {
        return this.oauth.initiate()
    }

    async disconnectOwnerRez(): Promise<ApiResult<{ success: boolean }>> {
        return this.oauth.disconnect()
    }

    async getSyncStatus(): Promise<ApiResult<SyncStatusResponse>> {
        return this.request('/sync-status')
    }

    async getProperties(): Promise<ApiResult<{ properties: PropertyRow[] }>> {
        return this.request('/properties')
    }

    async getTags(): Promise<ApiResult<Tag[]>> {
        return this.request('/tags')
    }

    async getOperatingExpenses(propertyId?: string, month?: string): Promise<ApiResult<{ data: OperatingExpenseRow[] }>> {
        const params = new URLSearchParams()
        if (propertyId) params.append('property', propertyId)
        if (month) params.append('month', month)
        return this.request(`/operating-expenses?${params}`)
    }

    async saveOperatingExpense(data: SaveOperatingExpenseData): Promise<ApiResult<void>> {
        return this.request('/operating-expenses', {
            method: 'POST',
            body: JSON.stringify(data)
        })
    }

    async saveOperatingExpensesBulk(data: SaveOperatingExpensesBulkData): Promise<ApiResult<void>> {
        return this.request('/operating-expenses/bulk', {
            method: 'POST',
            body: JSON.stringify(data)
        })
    }

    async deleteOperatingExpense(id: string): Promise<ApiResult<void>> {
        return this.request(`/operating-expenses/${id}`, {
            method: 'DELETE'
        })
    }

    async getExpenseTemplates(propertyId?: string): Promise<ApiResult<{ data: ExpenseTemplateRow[] }>> {
        const params = new URLSearchParams()
        if (propertyId) params.append('property', propertyId)
        return this.request(`/expense-templates?${params}`)
    }

    async saveExpenseTemplates(data: SaveExpenseTemplatesData): Promise<ApiResult<void>> {
        return this.request('/expense-templates/bulk', {
            method: 'POST',
            body: JSON.stringify(data)
        })
    }

    async getTaxRemittance(propertyId?: string, periodStart?: string, periodEnd?: string): Promise<ApiResult<{ data: Record<string, unknown>[] }>> {
        const params = new URLSearchParams()
        if (propertyId) params.append('property', propertyId)
        if (periodStart) params.append('start', periodStart)
        if (periodEnd) params.append('end', periodEnd)
        return this.request(`/tax-remittance?${params}`)
    }

    async calculateTax(data: { bookingId: string }): Promise<ApiResult<Record<string, unknown>>> {
        return this.request('/tax/calculate', {
            method: 'POST',
            body: JSON.stringify(data)
        })
    }

    async calculateBulkTax(from?: string, to?: string, propertyId?: string): Promise<ApiResult<Record<string, unknown>>> {
        const params = new URLSearchParams()
        if (from) params.append('from', from)
        if (to) params.append('to', to)
        if (propertyId) params.append('propertyId', propertyId)
        return this.request(`/tax-calculate-bulk?${params}`)
    }

    async getPropertyTaxStatus(): Promise<ApiResult<{ data: Record<string, unknown>[] }>> {
        return this.request('/tax/status')
    }

    async getPropertyTaxConfigs(): Promise<ApiResult<{ status: string; data: PropertyTaxConfigRow[] }>> {
        return this.request('/tax/configs')
    }

    async getTaxJurisdictions(): Promise<ApiResult<Record<string, unknown>[]>> {
        return this.request('/tax/jurisdictions')
    }

    async savePropertyTaxConfig(data: SavePropertyTaxConfigData): Promise<ApiResult<void>> {
        return this.request('/tax/configs', {
            method: 'POST',
            body: JSON.stringify(data)
        })
    }

    async updatePropertyTaxConfig(id: string, data: SavePropertyTaxConfigData): Promise<ApiResult<void>> {
        return this.request(`/tax/configs/${id}`, {
            method: 'PUT',
            body: JSON.stringify(data)
        })
    }

    async deletePropertyTaxConfig(configId: string): Promise<ApiResult<void>> {
        return this.request(`/tax/configs/${configId}`, {
            method: 'DELETE'
        })
    }

    async getSeasons(): Promise<ApiResult<Season[]>> {
        return this.request('/seasons')
    }

    async createSeason(data: { name: string; startMonth: number; startDay: number; endMonth: number; endDay: number }): Promise<ApiResult<Season>> {
        return this.request('/seasons', {
            method: 'POST',
            body: JSON.stringify(data)
        })
    }

    async updateSeason(id: string, data: { name: string; startMonth: number; startDay: number; endMonth: number; endDay: number }): Promise<ApiResult<Season>> {
        return this.request(`/seasons/${id}`, {
            method: 'PUT',
            body: JSON.stringify(data)
        })
    }

    async deleteSeason(id: string): Promise<ApiResult<void>> {
        return this.request(`/seasons/${id}`, {
            method: 'DELETE'
        })
    }

    async toggleSeasonActive(id: string, isActive: boolean): Promise<ApiResult<void>> {
        return this.request(`/seasons/${id}`, {
            method: 'PATCH',
            body: JSON.stringify({ isActive })
        })
    }

    async getPropertyPlatforms(propertyId: string): Promise<ApiResult<string[]>> {
        return this.request(`/tax/platforms?propertyId=${propertyId}`)
    }

    async getGoals(): Promise<ApiResult<Goal[]>> {
        return this.request('/goals')
    }

    async saveGoals(goals: { metricKey: string; targetValue: number; isEnabled: boolean; period: string }[]): Promise<ApiResult<void>> {
        return this.request('/goals', {
            method: 'PUT',
            body: JSON.stringify(goals)
        })
    }

    async getGoalProgress(): Promise<ApiResult<GoalProgress[]>> {
        return this.request('/goals/progress')
    }

    async getBookings(params: { startDate?: string; endDate?: string; limit?: string }): Promise<ApiResult<BookingRow[]>> {
        const qs = new URLSearchParams()
        if (params.startDate) qs.append('startDate', params.startDate)
        if (params.endDate) qs.append('endDate', params.endDate)
        if (params.limit) qs.append('limit', params.limit)
        return this.request(`/bookings?${qs.toString()}`)
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

    const token = api['accessToken']
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
