import { z } from 'zod'

const API_BASE = '/api'

type ApiResult<T> =
  | { success: true; data: T }
  | { success: false; error: string; status?: number }

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

  private async request<T>(
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

  async getTaxReport(from?: string, to?: string): Promise<ApiResult<any>> {
    const params = new URLSearchParams()
    if (from) params.append('from', from)
    if (to) params.append('to', to)

    return this.request(`/tax-report?${params}`)
  }

  async manualSync(): Promise<ApiResult<any>> {
    return this.request('/manual-sync', { method: 'POST' })
  }

  async getSyncStatus(): Promise<ApiResult<any>> {
    return this.request('/sync-status')
  }

  async getProperties(): Promise<ApiResult<any>> {
    return this.request('/properties')
  }

  async getPropertyMetrics(from?: string, to?: string): Promise<ApiResult<any>> {
    const params = new URLSearchParams()
    if (from) params.append('from', from)
    if (to) params.append('to', to)

    return this.request(`/property-metrics?${params}`)
  }

  async getRevenue(from?: string, to?: string): Promise<ApiResult<any>> {
    const params = new URLSearchParams()
    if (from) params.append('from', from)
    if (to) params.append('to', to)

    return this.request(`/revenue?${params}`)
  }

  async getOccupancy(from?: string, to?: string): Promise<ApiResult<any>> {
    const params = new URLSearchParams()
    if (from) params.append('from', from)
    if (to) params.append('to', to)

    return this.request(`/occupancy?${params}`)
  }

  async getTags(): Promise<ApiResult<any>> {
    return this.request('/tags')
  }
}

export const api = new ApiClient()
