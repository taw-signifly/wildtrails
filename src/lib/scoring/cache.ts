/**
 * Advanced caching system for Petanque scoring engine
 * Implements TTL, LRU eviction, size limits, and memory monitoring
 */

import { CacheError, createCacheError } from './errors'

export interface CacheEntry<T> {
  value: T
  timestamp: number
  hits: number
  size: number
  lastAccessed: number
}

export interface CacheConfig {
  maxSize: number
  ttl: number // Time to live in milliseconds
  maxMemoryMB: number
  enableMetrics: boolean
  evictionPolicy: 'lru' | 'lfu' | 'fifo'
}

export interface CacheMetrics {
  hits: number
  misses: number
  evictions: number
  size: number
  memoryUsageMB: number
  hitRate: number
  averageAge: number
  oldestEntry: number
  newestEntry: number
}

/**
 * Advanced cache implementation with TTL, size limits, and LRU eviction
 */
export class AdvancedCache<T> {
  private cache = new Map<string, CacheEntry<T>>()
  private accessOrder: string[] = [] // For LRU tracking
  private metrics: CacheMetrics = {
    hits: 0,
    misses: 0,
    evictions: 0,
    size: 0,
    memoryUsageMB: 0,
    hitRate: 0,
    averageAge: 0,
    oldestEntry: 0,
    newestEntry: 0
  }

  constructor(private config: CacheConfig) {
    // Start periodic cleanup
    if (typeof window === 'undefined') { // Only in Node.js environment
      setInterval(() => this.performMaintenance(), Math.min(config.ttl / 4, 60000))
    }
  }

  /**
   * Get value from cache with automatic cleanup
   */
  get(key: string): T | null {
    try {
      const entry = this.cache.get(key)
      
      if (!entry) {
        this.metrics.misses++
        this.updateMetrics()
        return null
      }

      const now = Date.now()
      
      // Check if entry has expired
      if (now - entry.timestamp > this.config.ttl) {
        this.cache.delete(key)
        this.removeFromAccessOrder(key)
        this.metrics.misses++
        this.metrics.evictions++
        this.updateMetrics()
        return null
      }

      // Update access tracking
      entry.hits++
      entry.lastAccessed = now
      this.updateAccessOrder(key)
      
      this.metrics.hits++
      this.updateMetrics()
      
      return entry.value
    } catch (error) {
      throw createCacheError(
        `Failed to get cache entry: ${error instanceof Error ? error.message : 'Unknown error'}`,
        'cache_get',
        { key, cacheSize: this.cache.size }
      )
    }
  }

  /**
   * Set value in cache with automatic eviction if needed
   */
  set(key: string, value: T, customTTL?: number): void {
    try {
      const now = Date.now()
      const size = this.estimateSize(value)
      
      // Check memory limits before adding
      if (this.metrics.memoryUsageMB + (size / 1024 / 1024) > this.config.maxMemoryMB) {
        this.evictEntries(1)
      }
      
      // Check size limits
      if (this.cache.size >= this.config.maxSize) {
        this.evictEntries(1)
      }

      const entry: CacheEntry<T> = {
        value,
        timestamp: now,
        hits: 0,
        size,
        lastAccessed: now
      }

      // Remove existing entry if updating
      if (this.cache.has(key)) {
        this.removeFromAccessOrder(key)
      }

      this.cache.set(key, entry)
      this.accessOrder.push(key)
      
      this.updateMetrics()
    } catch (error) {
      throw createCacheError(
        `Failed to set cache entry: ${error instanceof Error ? error.message : 'Unknown error'}`,
        'cache_set',
        { key, cacheSize: this.cache.size, memoryUsage: this.metrics.memoryUsageMB }
      )
    }
  }

  /**
   * Check if key exists and is not expired
   */
  has(key: string): boolean {
    const entry = this.cache.get(key)
    if (!entry) return false
    
    const now = Date.now()
    if (now - entry.timestamp > this.config.ttl) {
      this.cache.delete(key)
      this.removeFromAccessOrder(key)
      this.metrics.evictions++
      this.updateMetrics()
      return false
    }
    
    return true
  }

  /**
   * Delete specific key
   */
  delete(key: string): boolean {
    const existed = this.cache.delete(key)
    if (existed) {
      this.removeFromAccessOrder(key)
      this.updateMetrics()
    }
    return existed
  }

  /**
   * Clear all cache entries
   */
  clear(): void {
    this.cache.clear()
    this.accessOrder = []
    this.metrics.evictions += this.metrics.size
    this.updateMetrics()
  }

  /**
   * Get current cache metrics
   */
  getMetrics(): Readonly<CacheMetrics> {
    this.updateMetrics()
    return { ...this.metrics }
  }

  /**
   * Get cache configuration
   */
  getConfig(): Readonly<CacheConfig> {
    return { ...this.config }
  }

  /**
   * Update cache configuration
   */
  updateConfig(newConfig: Partial<CacheConfig>): void {
    this.config = { ...this.config, ...newConfig }
    
    // Trigger cleanup if limits were reduced
    if (newConfig.maxSize && this.cache.size > newConfig.maxSize) {
      this.evictEntries(this.cache.size - newConfig.maxSize)
    }
  }

  /**
   * Get all cache keys (for debugging)
   */
  keys(): string[] {
    return Array.from(this.cache.keys())
  }

  /**
   * Get cache size
   */
  size(): number {
    return this.cache.size
  }

  /**
   * Perform maintenance - cleanup expired entries, optimize memory
   */
  private performMaintenance(): void {
    try {
      const now = Date.now()
      const expired: string[] = []

      // Find expired entries
      for (const [key, entry] of this.cache) {
        if (now - entry.timestamp > this.config.ttl) {
          expired.push(key)
        }
      }

      // Remove expired entries
      for (const key of expired) {
        this.cache.delete(key)
        this.removeFromAccessOrder(key)
        this.metrics.evictions++
      }

      // Check memory limits
      this.updateMetrics()
      if (this.metrics.memoryUsageMB > this.config.maxMemoryMB * 0.9) {
        this.evictEntries(Math.ceil(this.cache.size * 0.1)) // Evict 10%
      }

      // Check size limits
      if (this.cache.size > this.config.maxSize * 0.9) {
        this.evictEntries(this.cache.size - Math.floor(this.config.maxSize * 0.8))
      }
    } catch (error) {
      console.warn('[AdvancedCache] Maintenance failed:', error)
    }
  }

  /**
   * Evict entries based on configured policy
   */
  private evictEntries(count: number): void {
    if (count <= 0) return

    const toEvict: string[] = []

    switch (this.config.evictionPolicy) {
      case 'lru':
        // Evict least recently used
        toEvict.push(...this.accessOrder.slice(0, count))
        break
        
      case 'lfu':
        // Evict least frequently used
        const byFrequency = Array.from(this.cache.entries())
          .sort((a, b) => a[1].hits - b[1].hits)
          .slice(0, count)
          .map(([key]) => key)
        toEvict.push(...byFrequency)
        break
        
      case 'fifo':
        // Evict oldest entries
        const byAge = Array.from(this.cache.entries())
          .sort((a, b) => a[1].timestamp - b[1].timestamp)
          .slice(0, count)
          .map(([key]) => key)
        toEvict.push(...byAge)
        break
    }

    // Perform eviction
    for (const key of toEvict) {
      this.cache.delete(key)
      this.removeFromAccessOrder(key)
      this.metrics.evictions++
    }
  }

  /**
   * Update access order for LRU tracking
   */
  private updateAccessOrder(key: string): void {
    this.removeFromAccessOrder(key)
    this.accessOrder.push(key)
  }

  /**
   * Remove key from access order tracking
   */
  private removeFromAccessOrder(key: string): void {
    const index = this.accessOrder.indexOf(key)
    if (index !== -1) {
      this.accessOrder.splice(index, 1)
    }
  }

  /**
   * Estimate memory size of an object
   */
  private estimateSize(obj: T): number {
    try {
      // Simple estimation based on JSON serialization
      const jsonStr = JSON.stringify(obj)
      return jsonStr.length * 2 // Approximate for UTF-16 encoding
    } catch {
      return 1024 // Default size estimate if serialization fails
    }
  }

  /**
   * Update cache metrics
   */
  private updateMetrics(): void {
    const now = Date.now()
    let totalSize = 0
    let totalAge = 0
    let oldest = now
    let newest = 0

    for (const entry of this.cache.values()) {
      totalSize += entry.size
      totalAge += now - entry.timestamp
      oldest = Math.min(oldest, entry.timestamp)
      newest = Math.max(newest, entry.timestamp)
    }

    this.metrics.size = this.cache.size
    this.metrics.memoryUsageMB = totalSize / 1024 / 1024
    this.metrics.hitRate = this.metrics.hits + this.metrics.misses > 0 
      ? (this.metrics.hits / (this.metrics.hits + this.metrics.misses)) * 100 
      : 0
    this.metrics.averageAge = this.cache.size > 0 ? totalAge / this.cache.size : 0
    this.metrics.oldestEntry = oldest === now ? 0 : now - oldest
    this.metrics.newestEntry = newest === 0 ? 0 : now - newest
  }
}

/**
 * Cache manager for multiple named caches
 */
export class CacheManager {
  private caches = new Map<string, AdvancedCache<any>>()
  private defaultConfig: CacheConfig = {
    maxSize: 1000,
    ttl: 5 * 60 * 1000, // 5 minutes
    maxMemoryMB: 100,
    enableMetrics: true,
    evictionPolicy: 'lru'
  }

  /**
   * Create or get a named cache
   */
  getCache<T>(name: string, config?: Partial<CacheConfig>): AdvancedCache<T> {
    if (!this.caches.has(name)) {
      const cacheConfig = { ...this.defaultConfig, ...config }
      this.caches.set(name, new AdvancedCache<T>(cacheConfig))
    }
    return this.caches.get(name)!
  }

  /**
   * Delete a named cache
   */
  deleteCache(name: string): boolean {
    const cache = this.caches.get(name)
    if (cache) {
      cache.clear()
      this.caches.delete(name)
      return true
    }
    return false
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
   * Get total memory usage across all caches
   */
  getTotalMemoryUsage(): number {
    return Array.from(this.caches.values())
      .reduce((total, cache) => total + cache.getMetrics().memoryUsageMB, 0)
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

/**
 * Type guards for cache entries
 */
export function isCacheEntry<T>(value: unknown): value is CacheEntry<T> {
  return (
    typeof value === 'object' &&
    value !== null &&
    'value' in value &&
    'timestamp' in value &&
    'hits' in value &&
    'size' in value &&
    'lastAccessed' in value
  )
}

export function isValidCacheKey(key: unknown): key is string {
  return typeof key === 'string' && key.length > 0 && key.length < 250
}