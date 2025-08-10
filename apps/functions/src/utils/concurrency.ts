import pLimit from 'p-limit'

// Create reusable concurrency limiters
export const createLimiter = (concurrency: number = 5) => pLimit(concurrency)

// Default limiters for common use cases
export const apiLimiter = createLimiter(5)  // For external API calls
export const dbLimiter = createLimiter(10)  // For database operations
export const heavyLimiter = createLimiter(2)  // For heavy computations

// Batch process items with concurrency control
export async function batchProcess<T, R>(
  items: T[],
  processor: (item: T) => Promise<R>,
  options: {
    concurrency?: number
    batchSize?: number
    onProgress?: (completed: number, total: number) => void
  } = {}
): Promise<R[]> {
  const { concurrency = 5, batchSize, onProgress } = options
  const limit = pLimit(concurrency)
  
  let completed = 0
  const total = items.length
  
  // If batch size specified, process in batches
  if (batchSize) {
    const results: R[] = []
    for (let i = 0; i < items.length; i += batchSize) {
      const batch = items.slice(i, i + batchSize)
      const batchResults = await Promise.all(
        batch.map(item => 
          limit(async () => {
            const result = await processor(item)
            completed++
            onProgress?.(completed, total)
            return result
          })
        )
      )
      results.push(...batchResults)
    }
    return results
  }
  
  // Otherwise process all with concurrency limit
  return Promise.all(
    items.map(item => 
      limit(async () => {
        const result = await processor(item)
        completed++
        onProgress?.(completed, total)
        return result
      })
    )
  )
}

// Retry with exponential backoff
export async function retryWithBackoff<T>(
  fn: () => Promise<T>,
  options: {
    maxRetries?: number
    initialDelay?: number
    maxDelay?: number
    factor?: number
  } = {}
): Promise<T> {
  const {
    maxRetries = 3,
    initialDelay = 1000,
    maxDelay = 30000,
    factor = 2
  } = options
  
  let delay = initialDelay
  let lastError: Error
  
  for (let i = 0; i <= maxRetries; i++) {
    try {
      return await fn()
    } catch (error) {
      lastError = error as Error
      
      if (i === maxRetries) {
        throw lastError
      }
      
      await new Promise(resolve => setTimeout(resolve, delay))
      delay = Math.min(delay * factor, maxDelay)
    }
  }
  
  throw lastError!
}