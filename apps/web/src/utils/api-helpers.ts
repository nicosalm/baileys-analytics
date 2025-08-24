import { z } from 'zod'

export type ApiResult<T> =
  | { success: true; data: T }
  | { success: false; error: string; status?: number; code?: string }

export const ERROR_MESSAGES = {
  NETWORK: 'Network error. Please check your connection.',
  UNAUTHORIZED: 'You need to be logged in to perform this action.',
  FORBIDDEN: 'You do not have permission to perform this action.',
  NOT_FOUND: 'The requested resource was not found.',
  VALIDATION: 'Invalid input. Please check your data.',
  SERVER: 'Server error. Please try again later.',
  UNKNOWN: 'An unexpected error occurred.'
} as const

export const parseApiError = (error: unknown): string => {
  if (typeof error === 'string') return error
  
  if (error && typeof error === 'object') {
    if ('message' in error && typeof error.message === 'string') {
      return error.message
    }
    if ('error' in error && typeof error.error === 'string') {
      return error.error
    }
  }
  
  return ERROR_MESSAGES.UNKNOWN
}

export const getErrorMessageByStatus = (status: number): string => {
  switch (status) {
    case 401:
      return ERROR_MESSAGES.UNAUTHORIZED
    case 403:
      return ERROR_MESSAGES.FORBIDDEN
    case 404:
      return ERROR_MESSAGES.NOT_FOUND
    case 400:
      return ERROR_MESSAGES.VALIDATION
    case 500:
    case 502:
    case 503:
      return ERROR_MESSAGES.SERVER
    default:
      return ERROR_MESSAGES.UNKNOWN
  }
}

export const buildQueryString = (params: Record<string, any>): string => {
  const searchParams = new URLSearchParams()
  
  Object.entries(params).forEach(([key, value]) => {
    if (value !== undefined && value !== null && value !== '') {
      if (Array.isArray(value)) {
        if (value.length > 0) {
          searchParams.append(key, value.join(','))
        }
      } else {
        searchParams.append(key, String(value))
      }
    }
  })
  
  const queryString = searchParams.toString()
  return queryString ? `?${queryString}` : ''
}

export const parseApiResponse = <T>(
  data: unknown,
  schema: z.ZodSchema<T>
): ApiResult<T> => {
  try {
    const parsed = schema.parse(data)
    return { success: true, data: parsed }
  } catch (error) {
    if (error instanceof z.ZodError) {
      const message = error.issues.map((e: z.ZodIssue) => `${e.path.join('.')}: ${e.message}`).join(', ')
      return { success: false, error: `Validation error: ${message}` }
    }
    return { success: false, error: parseApiError(error) }
  }
}

export const createSwrKey = (
  endpoint: string,
  params?: Record<string, any>
): string | null => {
  if (!endpoint) return null
  
  const validParams = params ? Object.entries(params).reduce((acc, [key, value]) => {
    if (value !== undefined && value !== null) {
      acc[key] = value
    }
    return acc
  }, {} as Record<string, any>) : {}
  
  if (params && Object.keys(validParams).length === 0) {
    return null
  }
  
  return endpoint + buildQueryString(validParams)
}

export const batchApiCalls = async <T extends readonly unknown[]>(
  calls: [...{ [K in keyof T]: Promise<T[K]> }]
): Promise<{ [K in keyof T]: ApiResult<T[K]> }> => {
  const results = await Promise.allSettled(calls)
  
  return results.map((result) => {
    if (result.status === 'fulfilled') {
      return { success: true, data: result.value } as ApiResult<any>
    } else {
      return { success: false, error: parseApiError(result.reason) } as ApiResult<any>
    }
  }) as { [K in keyof T]: ApiResult<T[K]> }
}

export const retryApiCall = async <T>(
  fn: () => Promise<T>,
  maxRetries = 3,
  baseDelay = 1000
): Promise<T> => {
  let lastError: unknown
  
  for (let i = 0; i < maxRetries; i++) {
    try {
      return await fn()
    } catch (error) {
      lastError = error
      
      if (error && typeof error === 'object' && 'status' in error) {
        const status = (error as any).status
        if (status >= 400 && status < 500) {
          throw error
        }
      }
      
      if (i < maxRetries - 1) {
        const delay = baseDelay * Math.pow(2, i)
        await new Promise(resolve => setTimeout(resolve, delay))
      }
    }
  }
  
  throw lastError
}

export const createOptimisticUpdate = <T>(
  currentData: T | undefined,
  updateFn: (data: T) => T
): T | undefined => {
  if (!currentData) return undefined
  return updateFn(currentData)
}

export const formatApiDateParams = (
  from?: Date | string | null,
  to?: Date | string | null
): { from?: string; to?: string } => {
  const params: { from?: string; to?: string } = {}
  
  if (from) {
    const fromDate = typeof from === 'string' ? from : from.toISOString().split('T')[0]
    params.from = fromDate
  }
  
  if (to) {
    const toDate = typeof to === 'string' ? to : to.toISOString().split('T')[0]
    params.to = toDate
  }
  
  return params
}

export const isApiSuccess = <T>(result: ApiResult<T>): result is { success: true; data: T } => {
  return result.success === true
}

export const unwrapApiResult = <T>(result: ApiResult<T>): T => {
  if (isApiSuccess(result)) {
    return result.data
  }
  throw new Error(result.error)
}