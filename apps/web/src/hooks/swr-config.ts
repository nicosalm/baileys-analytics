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
  fetcher: async (key: string) => {
    const result = await api.request(key)
    if (!result.success) {
      throw new Error(result.error)
    }
    return result.data
  }
}
