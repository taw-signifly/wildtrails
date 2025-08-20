/**
 * Simple caching system for Petanque scoring engine
 * Implements basic TTL and size limits with minimal complexity
 */

export interface CacheMetrics {
  hits: number
  misses: number
  size: number
  hitRate: number
}

/**
 * Simple cache implementation with TTL and size limits
 */
export class AdvancedCache<T> {
  private cache = new Map<string, { value: T; timestamp: number }>()
  private metrics: CacheMetrics = { hits: 0, misses: 0, size: 0, hitRate: 0 }

  constructor(private config: { maxSize: number; ttl: number }) {}

  /**
   * Get value from cache with automatic cleanup
   */
  get(key: string): T | null {
    const entry = this.cache.get(key)
    
    if (!entry) {
      this.metrics.misses++
      this.updateHitRate()
      return null
    }

    // Check if entry has expired
    if (Date.now() - entry.timestamp > this.config.ttl) {
      this.cache.delete(key)
      this.metrics.misses++
      this.updateHitRate()
      return null
    }

    this.metrics.hits++
    this.updateHitRate()
    return entry.value
  }

  /**
   * Set value in cache with automatic eviction if needed
   */
  set(key: string, value: T): void {
    // Simple size-based eviction
    if (this.cache.size >= this.config.maxSize) {
      const firstKey = this.cache.keys().next().value
      if (firstKey) {
        this.cache.delete(firstKey)
      }
    }

    this.cache.set(key, { value, timestamp: Date.now() })
    this.metrics.size = this.cache.size
  }

  /**
   * Clear all cache entries
   */
  clear(): void {
    this.cache.clear()
    this.metrics.size = 0
  }

  /**
   * Get current cache metrics
   */
  getMetrics(): Readonly<CacheMetrics> {
    this.metrics.size = this.cache.size
    return { ...this.metrics }
  }

  private updateHitRate(): void {
    const total = this.metrics.hits + this.metrics.misses
    this.metrics.hitRate = total > 0 ? (this.metrics.hits / total) * 100 : 0
  }
}

export class CacheManager {
  private caches = new Map<string, AdvancedCache<unknown>>()

  /**
   * Create or get a named cache
   */
  getCache<T>(name: string): AdvancedCache<T> {
    if (!this.caches.has(name)) {
      this.caches.set(name, new AdvancedCache<T>({ maxSize: 1000, ttl: 5 * 60 * 1000 }))
    }
    return this.caches.get(name)! as AdvancedCache<T>
  }

  /**
   * Clear all caches
   */
  clearAll(): void {
    for (const cache of this.caches.values()) {
      cache.clear()
    }
  }

  /**
   * Get metrics for all caches
   */
  getAllMetrics(): Record<string, CacheMetrics> {
    const metrics: Record<string, CacheMetrics> = {}
    for (const [name, cache] of this.caches) {
      metrics[name] = cache.getMetrics()
    }
    return metrics
  }

  /**
   * Get total memory usage across all caches (simplified - just return cache count)
   */
  getTotalMemoryUsage(): number {
    return this.caches.size
  }

  /**
   * Get list of cache names
   */
  getCacheNames(): string[] {
    return Array.from(this.caches.keys())
  }
}

/**
 * Default cache manager instance
 */
export const defaultCacheManager = new CacheManager()