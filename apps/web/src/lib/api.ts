const API_BASE = '/api'

type ApiResult<T> =
| { success: true; data: T }
| { success: false; error: string; status?: number }

export type DbResult<T> = ApiResult<T>


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


    // oauth methods
    oauth = {
        initiate: (): Promise<ApiResult<{ authUrl: string }>> => {
            return this.request('/oauth/initiate')
        },
        disconnect: (): Promise<ApiResult<{ success: boolean }>> => {
            return this.request('/oauth/disconnect', { method: 'POST' })
        },
        callback: (code: string, state: string): Promise<ApiResult<any>> => {
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


    async manualSync(): Promise<ApiResult<any>> {
        // use recovery sync for emergency use only
        return this.request('/sync/recovery', { 
            method: 'POST',
            headers: {
                'X-Force-Sync': 'true'
            }
        })
    }

    async syncGuestDetails(): Promise<ApiResult<any>> {
        return this.request('/sync/guest-details', { method: 'POST' })
    }

    async historicalSync(): Promise<ApiResult<any>> {
        return this.request('/initial-sync/full', { method: 'POST' })
    }

    async getSyncStatus(): Promise<ApiResult<any>> {
        return this.request('/sync-status')
    }

    async getProperties(): Promise<ApiResult<any>> {
        return this.request('/properties')
    }

    async getTags(): Promise<ApiResult<any>> {
        return this.request('/tags')
    }

    async getOperatingExpenses(propertyId?: string, month?: string): Promise<ApiResult<any>> {
        const params = new URLSearchParams()
        if (propertyId) params.append('property', propertyId)
        if (month) params.append('month', month)
        return this.request(`/operating-expenses?${params}`)
    }

    async saveOperatingExpense(data: any): Promise<ApiResult<any>> {
        return this.request('/operating-expenses', {
            method: 'POST',
            body: JSON.stringify(data)
        })
    }

    async saveOperatingExpensesBulk(data: any): Promise<ApiResult<any>> {
        return this.request('/operating-expenses/bulk', {
            method: 'POST',
            body: JSON.stringify(data)
        })
    }

    async deleteOperatingExpense(id: string): Promise<ApiResult<any>> {
        return this.request(`/operating-expenses/${id}`, {
            method: 'DELETE'
        })
    }

    async getExpenseTemplates(propertyId?: string): Promise<ApiResult<any>> {
        const params = new URLSearchParams()
        if (propertyId) params.append('property', propertyId)
        return this.request(`/expense-templates?${params}`)
    }

    async saveExpenseTemplates(data: any): Promise<ApiResult<any>> {
        return this.request('/expense-templates/bulk', {
            method: 'POST',
            body: JSON.stringify(data)
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

    async getGoals(): Promise<ApiResult<any>> {
        return this.request('/goals')
    }

    async saveGoals(goals: { metricKey: string; targetValue: number; isEnabled: boolean; period: string }[]): Promise<ApiResult<any>> {
        return this.request('/goals', {
            method: 'PUT',
            body: JSON.stringify(goals)
        })
    }

    async getGoalProgress(): Promise<ApiResult<any>> {
        return this.request('/goals/progress')
    }

    async getBookings(params: { startDate?: string; endDate?: string; limit?: string }): Promise<ApiResult<any>> {
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
