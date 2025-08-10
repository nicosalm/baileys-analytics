import { SWRConfiguration } from 'swr'
import { api } from '@/lib/api'

export const swrConfig: SWRConfiguration = {
  revalidateOnFocus: true,
  revalidateOnReconnect: true,
  shouldRetryOnError: true,
  errorRetryCount: 3,
  errorRetryInterval: 5000,
  dedupingInterval: 2000,
  focusThrottleInterval: 5000,
  fetcher: async (key: string | [string, ...any[]]) => {
    if (Array.isArray(key)) {
      const [path, ...params] = key
      return fetcherWithParams(path, params)
    }
    const result = await api.request(key)
    if (!result.success) {
      throw new Error(result.error)
    }
    return result.data
  },
  onError: (error) => {
    console.error('SWR Error:', error)
  }
}

async function fetcherWithParams(path: string, params: any[]) {
  let result: any
  
  switch (path) {
    case '/financial':
      result = await api.getFinancial(...params)
      break
    case '/occupancy':
      result = await api.getOccupancy(...params)
      break
    case '/property-metrics':
      result = await api.getPropertyMetrics(...params)
      break
    case '/guests':
      result = await api.getGuests(...params)
      break
    case '/seasonal-analysis':
      result = await api.getSeasonalAnalysis(...params)
      break
    default:
      result = await api.request(path)
  }
  
  if (!result.success) {
    throw new Error(result.error)
  }
  return result.data
}