/**
 * Performance monitoring utilities for API calls
 */

interface PerformanceMetric {
  endpoint: string
  duration: number
  cached: boolean
  timestamp: number
}

class PerformanceMonitor {
  private metrics: PerformanceMetric[] = []
  private readonly maxMetrics = 100
  
  /**
   * Record an API call performance metric
   */
  record(endpoint: string, startTime: number, cached: boolean = false) {
    const duration = Date.now() - startTime
    
    // Add new metric
    this.metrics.push({
      endpoint,
      duration,
      cached,
      timestamp: Date.now()
    })
    
    // Keep only recent metrics
    if (this.metrics.length > this.maxMetrics) {
      this.metrics = this.metrics.slice(-this.maxMetrics)
    }
    
  }
  
  /**
   * Get average performance for an endpoint
   */
  getAverageTime(endpoint: string): number {
    const relevantMetrics = this.metrics.filter(m => m.endpoint === endpoint)
    if (relevantMetrics.length === 0) return 0
    
    const sum = relevantMetrics.reduce((acc, m) => acc + m.duration, 0)
    return Math.round(sum / relevantMetrics.length)
  }
  
  /**
   * Get cache hit rate for an endpoint
   */
  getCacheHitRate(endpoint: string): number {
    const relevantMetrics = this.metrics.filter(m => m.endpoint === endpoint)
    if (relevantMetrics.length === 0) return 0
    
    const cachedCount = relevantMetrics.filter(m => m.cached).length
    return (cachedCount / relevantMetrics.length) * 100
  }
  
  /**
   * Get performance summary
   */
  getSummary() {
    const endpoints = [...new Set(this.metrics.map(m => m.endpoint))]
    
    return endpoints.map(endpoint => {
      const metrics = this.metrics.filter(m => m.endpoint === endpoint)
      const avgTime = this.getAverageTime(endpoint)
      const cacheHitRate = this.getCacheHitRate(endpoint)
      const callCount = metrics.length
      
      return {
        endpoint,
        avgTime,
        cacheHitRate,
        callCount
      }
    }).sort((a, b) => b.callCount - a.callCount)
  }
  
  /**
   * Clear all metrics
   */
  clear() {
    this.metrics = []
  }
}

// Singleton instance
export const performanceMonitor = new PerformanceMonitor()

/**
 * Helper function to measure async operation performance
 */
export async function measurePerformance<T>(
  operation: () => Promise<T>,
  endpoint: string,
  checkCached?: (result: T) => boolean
): Promise<T> {
  const startTime = Date.now()
  
  try {
    const result = await operation()
    const cached = checkCached ? checkCached(result) : false
    performanceMonitor.record(endpoint, startTime, cached)
    return result
  } catch (error) {
    performanceMonitor.record(endpoint, startTime, false)
    throw error
  }
}

