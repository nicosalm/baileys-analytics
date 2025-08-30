import crypto from 'crypto'

interface CacheEntry<T> {
  data: T
  expires: number
  etag?: string
  hits: number
  lastAccessed: number
  size: number
}

interface CacheStats {
  size: number
  maxSize: number
  hits: number
  misses: number
  hitRate: number
  evictions: number
  avgAccessTime: number
  memoryUsage: number
  hotKeys: Array<{ key: string; hits: number }>
}

class CacheService {
  private cache = new Map<string, CacheEntry<unknown>>()
  private readonly maxSize = 200 // Increased max cache entries
  private readonly maxMemory = 50 * 1024 * 1024 // 50MB max memory
  private stats = {
    hits: 0,
    misses: 0,
    evictions: 0,
    totalAccessTime: 0,
    accessCount: 0
  }
  
  /**
   * Generate a cache key from request parameters
   */
  generateKey(...parts: unknown[]): string {
    const str = JSON.stringify(parts)
    return crypto.createHash('md5').update(str).digest('hex')
  }
  
  /**
   * Get cached data if valid with hit tracking
   */
  get<T>(key: string): T | null {
    const startTime = Date.now()
    const entry = this.cache.get(key)
    
    if (!entry) {
      this.stats.misses++
      this.trackAccessTime(startTime)
      return null
    }
    
    // Check if expired
    if (entry.expires < Date.now()) {
      this.cache.delete(key)
      this.stats.misses++
      this.trackAccessTime(startTime)
      return null
    }
    
    // Update hit stats
    entry.hits++
    entry.lastAccessed = Date.now()
    this.stats.hits++
    this.trackAccessTime(startTime)
    
    // Move to end for LRU (Map maintains insertion order)
    this.cache.delete(key)
    this.cache.set(key, entry)
    
    return entry.data as T
  }
  
  /**
   * Set cache with TTL and smart eviction
   */
  set<T>(key: string, data: T, ttlMs: number = 60000): void {
    const dataSize = this.estimateSize(data)
    
    // Check memory limit
    if (this.getMemoryUsage() + dataSize > this.maxMemory) {
      this.evictLeastValuable()
    }
    
    // Check entry count limit
    if (this.cache.size >= this.maxSize) {
      this.evictLeastValuable()
    }
    
    this.cache.set(key, {
      data,
      expires: Date.now() + ttlMs,
      etag: this.generateEtag(data),
      hits: 0,
      lastAccessed: Date.now(),
      size: dataSize
    })
  }
  
  /**
   * Smart eviction based on value (frequency * recency * size)
   */
  private evictLeastValuable(): void {
    let leastValuableKey: string | null = null
    let lowestValue = Infinity
    const now = Date.now()
    
    for (const [key, entry] of this.cache.entries()) {
      // Calculate value score (higher is better)
      const age = Math.max(1, now - entry.lastAccessed)
      const frequency = entry.hits + 1
      const recency = 1 / age
      const sizeWeight = 1 / Math.max(1, entry.size)
      
      // Combined score: frequently accessed, recently used, small items are more valuable
      const value = frequency * recency * sizeWeight * 1000000
      
      if (value < lowestValue) {
        lowestValue = value
        leastValuableKey = key
      }
    }
    
    if (leastValuableKey) {
      this.cache.delete(leastValuableKey)
      this.stats.evictions++
    }
  }
  
  /**
   * Get or fetch data with caching
   */
  async getOrFetch<T>(
    key: string,
    fetcher: () => Promise<T>,
    ttlMs: number = 60000
  ): Promise<T> {
    const cached = this.get<T>(key)
    if (cached !== null) {
      return cached
    }
    
    const data = await fetcher()
    this.set(key, data, ttlMs)
    return data
  }
  
  /**
   * Warm the cache with frequently accessed data
   */
  async warm(
    patterns: Array<{
      keyGenerator: () => string
      fetcher: () => Promise<unknown>
      ttl: number
    }>
  ): Promise<void> {
    const warmPromises = patterns.map(async ({ keyGenerator, fetcher, ttl }) => {
      try {
        const key = keyGenerator()
        const data = await fetcher()
        this.set(key, data, ttl)
      } catch (error) {
        // Silently fail cache warming
        console.error('Cache warming failed:', error)
      }
    })
    
    await Promise.allSettled(warmPromises)
  }
  
  /**
   * Clear specific cache or all
   */
  clear(pattern?: string): void {
    if (!pattern) {
      this.cache.clear()
      this.resetStats()
      return
    }
    
    for (const key of this.cache.keys()) {
      if (key.includes(pattern)) {
        this.cache.delete(key)
      }
    }
  }
  
  /**
   * Get detailed cache statistics
   */
  getStats(): CacheStats {
    const hotKeys = Array.from(this.cache.entries())
      .sort(([, a], [, b]) => b.hits - a.hits)
      .slice(0, 10)
      .map(([key, entry]) => ({ key, hits: entry.hits }))
    
    const totalHits = this.stats.hits
    const totalMisses = this.stats.misses
    const total = totalHits + totalMisses
    
    return {
      size: this.cache.size,
      maxSize: this.maxSize,
      hits: totalHits,
      misses: totalMisses,
      hitRate: total > 0 ? totalHits / total : 0,
      evictions: this.stats.evictions,
      avgAccessTime: this.stats.accessCount > 0 
        ? this.stats.totalAccessTime / this.stats.accessCount 
        : 0,
      memoryUsage: this.getMemoryUsage(),
      hotKeys
    }
  }
  
  /**
   * Invalidate cache entries by tags
   */
  invalidateByTags(tags: string[]): void {
    for (const [key] of this.cache.entries()) {
      if (tags.some(tag => key.includes(tag))) {
        this.cache.delete(key)
      }
    }
  }
  
  private trackAccessTime(startTime: number): void {
    const duration = Date.now() - startTime
    this.stats.totalAccessTime += duration
    this.stats.accessCount++
  }
  
  private estimateSize(data: unknown): number {
    // Rough estimation of object size in bytes
    const str = JSON.stringify(data)
    return str.length * 2 // UTF-16 characters
  }
  
  private getMemoryUsage(): number {
    let total = 0
    for (const entry of this.cache.values()) {
      total += entry.size
    }
    return total
  }
  
  private generateEtag(data: unknown): string {
    const str = JSON.stringify(data)
    return crypto.createHash('md5').update(str).digest('hex')
  }
  
  private resetStats(): void {
    this.stats = {
      hits: 0,
      misses: 0,
      evictions: 0,
      totalAccessTime: 0,
      accessCount: 0
    }
  }
}

// Singleton instance
export const cache = new CacheService()

// Cache TTL constants (in milliseconds)
export const CACHE_TTL = {
  SHORT: 30 * 1000,        // 30 seconds - for frequently changing data
  MEDIUM: 5 * 60 * 1000,    // 5 minutes - for normal data
  LONG: 30 * 60 * 1000,     // 30 minutes - for slow-changing data
  HOUR: 60 * 60 * 1000,     // 1 hour - for very stable data
  DAY: 24 * 60 * 60 * 1000  // 1 day - for static data
}

// Cache warming configuration
export const CACHE_WARMUP_CONFIG = {
  // Warm these on function cold start
  startup: [
    // Add patterns for data that should be pre-cached
  ],
  // Refresh these periodically
  periodic: [
    // Add patterns for data that should be refreshed
  ]
}