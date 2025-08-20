/**
 * Event processor utilities for handling real-time events
 * Provides event queue management, batching, and processing logic
 */

import {
  RealTimeEvent,
  EventPriority,
  getEventPriority,
  filterEvents,
  deduplicateEvents,
  sortEventsByPriority,
  validateEvent,
  EventFilter
} from './event-types'

export interface EventProcessorOptions {
  maxQueueSize?: number
  batchSize?: number
  processingInterval?: number
  enableDeduplication?: boolean
  enableBatching?: boolean
  retryAttempts?: number
  retryDelay?: number
}

export interface EventProcessorStats {
  totalProcessed: number
  totalFailed: number
  queueSize: number
  averageProcessingTime: number
  lastProcessedAt: string | null
}

export class EventProcessor {
  private queue: RealTimeEvent[] = []
  private processing = false
  private stats: EventProcessorStats = {
    totalProcessed: 0,
    totalFailed: 0,
    queueSize: 0,
    averageProcessingTime: 0,
    lastProcessedAt: null
  }

  private processingTimes: number[] = []
  private processingInterval: NodeJS.Timeout | null = null

  constructor(
    private options: EventProcessorOptions = {},
    private eventHandlers: Map<string, (event: RealTimeEvent) => Promise<void>> = new Map()
  ) {
    const {
      maxQueueSize = 1000,
      processingInterval = 100,
      enableBatching = true
    } = options

    this.options = {
      maxQueueSize,
      batchSize: 10,
      processingInterval,
      enableDeduplication: true,
      enableBatching,
      retryAttempts: 3,
      retryDelay: 1000,
      ...options
    }

    this.startProcessing()
  }

  /**
   * Add event to processing queue
   */
  addEvent(event: RealTimeEvent): boolean {
    if (!validateEvent(event)) {
      console.warn('Invalid event rejected:', event)
      return false
    }

    if (this.queue.length >= (this.options.maxQueueSize || 1000)) {
      console.warn('Event queue full, dropping oldest events')
      this.queue = this.queue.slice(-((this.options.maxQueueSize || 1000) - 1))
    }

    this.queue.push(event)
    this.stats.queueSize = this.queue.length
    return true
  }

  /**
   * Add multiple events to queue
   */
  addEvents(events: RealTimeEvent[]): number {
    let added = 0
    for (const event of events) {
      if (this.addEvent(event)) {
        added++
      }
    }
    return added
  }

  /**
   * Register event handler
   */
  registerHandler(eventType: string, handler: (event: RealTimeEvent) => Promise<void>): void {
    this.eventHandlers.set(eventType, handler)
  }

  /**
   * Register multiple handlers
   */
  registerHandlers(handlers: Record<string, (event: RealTimeEvent) => Promise<void>>): void {
    for (const [eventType, handler] of Object.entries(handlers)) {
      this.registerHandler(eventType, handler)
    }
  }

  /**
   * Unregister event handler
   */
  unregisterHandler(eventType: string): void {
    this.eventHandlers.delete(eventType)
  }

  /**
   * Start event processing
   */
  private startProcessing(): void {
    if (this.processingInterval) {
      return
    }

    this.processingInterval = setInterval(() => {
      if (!this.processing && this.queue.length > 0) {
        this.processEvents()
      }
    }, this.options.processingInterval || 100)
  }

  /**
   * Stop event processing
   */
  stopProcessing(): void {
    if (this.processingInterval) {
      clearInterval(this.processingInterval)
      this.processingInterval = null
    }
  }

  /**
   * Process events in queue
   */
  private async processEvents(): Promise<void> {
    if (this.processing || this.queue.length === 0) {
      return
    }

    this.processing = true
    const startTime = Date.now()

    try {
      let eventsToProcess = [...this.queue]
      this.queue = []

      // Apply deduplication if enabled
      if (this.options.enableDeduplication) {
        eventsToProcess = deduplicateEvents(eventsToProcess)
      }

      // Sort by priority
      eventsToProcess = sortEventsByPriority(eventsToProcess)

      // Process in batches if batching is enabled
      if (this.options.enableBatching) {
        const batchSize = this.options.batchSize || 10
        for (let i = 0; i < eventsToProcess.length; i += batchSize) {
          const batch = eventsToProcess.slice(i, i + batchSize)
          await this.processBatch(batch)
        }
      } else {
        // Process events one by one
        for (const event of eventsToProcess) {
          await this.processEvent(event)
        }
      }

      // Update stats
      const processingTime = Date.now() - startTime
      this.updateStats(eventsToProcess.length, processingTime, true)

    } catch (error) {
      console.error('Error processing events:', error)
      this.stats.totalFailed += this.queue.length
    } finally {
      this.processing = false
      this.stats.queueSize = this.queue.length
    }
  }

  /**
   * Process a batch of events concurrently
   */
  private async processBatch(events: RealTimeEvent[]): Promise<void> {
    const promises = events.map(event => this.processEvent(event))
    await Promise.allSettled(promises)
  }

  /**
   * Process a single event
   */
  private async processEvent(event: RealTimeEvent): Promise<void> {
    const handler = this.eventHandlers.get(event.eventType)
    
    if (!handler) {
      // No handler registered for this event type
      return
    }

    let lastError: Error | null = null
    const maxAttempts = (this.options.retryAttempts || 3) + 1

    for (let attempt = 1; attempt <= maxAttempts; attempt++) {
      try {
        await handler(event)
        return // Success
      } catch (error) {
        lastError = error instanceof Error ? error : new Error(String(error))
        
        if (attempt < maxAttempts) {
          // Wait before retry
          await new Promise(resolve => setTimeout(resolve, this.options.retryDelay || 1000))
        }
      }
    }

    // All attempts failed
    console.error(`Failed to process event ${event.eventType} after ${maxAttempts} attempts:`, lastError)
    this.stats.totalFailed++
  }

  /**
   * Update processing statistics
   */
  private updateStats(processedCount: number, processingTime: number, success: boolean): void {
    if (success) {
      this.stats.totalProcessed += processedCount
    }

    // Track processing times for average calculation
    this.processingTimes.push(processingTime)
    if (this.processingTimes.length > 100) {
      this.processingTimes = this.processingTimes.slice(-100)
    }

    this.stats.averageProcessingTime = this.processingTimes.reduce((a, b) => a + b, 0) / this.processingTimes.length
    this.stats.lastProcessedAt = new Date().toISOString()
  }

  /**
   * Get current statistics
   */
  getStats(): EventProcessorStats {
    return { ...this.stats }
  }

  /**
   * Clear the event queue
   */
  clearQueue(): void {
    this.queue = []
    this.stats.queueSize = 0
  }

  /**
   * Filter events in queue
   */
  filterQueue(filter: EventFilter): RealTimeEvent[] {
    return filterEvents(this.queue, filter)
  }

  /**
   * Get events by priority
   */
  getEventsByPriority(priority: EventPriority): RealTimeEvent[] {
    return this.queue.filter(event => getEventPriority(event.eventType) === priority)
  }

  /**
   * Get high priority events count
   */
  getHighPriorityEventCount(): number {
    return this.queue.filter(event => {
      const priority = getEventPriority(event.eventType)
      return priority === EventPriority.CRITICAL || priority === EventPriority.HIGH
    }).length
  }

  /**
   * Process immediate event (bypass queue)
   */
  async processImmediate(event: RealTimeEvent): Promise<boolean> {
    if (!validateEvent(event)) {
      return false
    }

    try {
      await this.processEvent(event)
      this.updateStats(1, 0, true)
      return true
    } catch (error) {
      console.error('Failed to process immediate event:', error)
      this.stats.totalFailed++
      return false
    }
  }

  /**
   * Destroy processor and cleanup resources
   */
  destroy(): void {
    this.stopProcessing()
    this.clearQueue()
    this.eventHandlers.clear()
  }
}

/**
 * Event debouncer for reducing duplicate events
 */
export class EventDebouncer {
  private timers = new Map<string, NodeJS.Timeout>()
  private pendingEvents = new Map<string, RealTimeEvent>()

  constructor(
    private defaultDelay: number = 300,
    private processor: EventProcessor
  ) {}

  /**
   * Debounce event processing
   */
  debounce(
    event: RealTimeEvent, 
    key: string = `${event.eventType}-${event.tournamentId}`, 
    delay: number = this.defaultDelay
  ): void {
    // Clear existing timer
    const existingTimer = this.timers.get(key)
    if (existingTimer) {
      clearTimeout(existingTimer)
    }

    // Store the latest event
    this.pendingEvents.set(key, event)

    // Set new timer
    const timer = setTimeout(() => {
      const pendingEvent = this.pendingEvents.get(key)
      if (pendingEvent) {
        this.processor.addEvent(pendingEvent)
        this.pendingEvents.delete(key)
        this.timers.delete(key)
      }
    }, delay)

    this.timers.set(key, timer)
  }

  /**
   * Flush all pending events immediately
   */
  flush(): void {
    for (const [key, timer] of this.timers.entries()) {
      clearTimeout(timer)
      const pendingEvent = this.pendingEvents.get(key)
      if (pendingEvent) {
        this.processor.addEvent(pendingEvent)
      }
    }
    
    this.timers.clear()
    this.pendingEvents.clear()
  }

  /**
   * Cleanup resources
   */
  destroy(): void {
    this.flush()
  }
}

/**
 * Event rate limiter
 */
export class EventRateLimiter {
  private eventCounts = new Map<string, { count: number, resetTime: number }>()

  constructor(
    private maxEventsPerWindow: number = 100,
    private windowSizeMs: number = 60000 // 1 minute
  ) {}

  /**
   * Check if event should be rate limited
   */
  shouldLimit(
    eventType: string, 
    key: string = eventType
  ): boolean {
    const now = Date.now()
    const bucket = this.eventCounts.get(key)

    if (!bucket || now > bucket.resetTime) {
      // Reset bucket
      this.eventCounts.set(key, {
        count: 1,
        resetTime: now + this.windowSizeMs
      })
      return false
    }

    if (bucket.count >= this.maxEventsPerWindow) {
      return true // Rate limited
    }

    bucket.count++
    return false
  }

  /**
   * Clear rate limiting data
   */
  clear(): void {
    this.eventCounts.clear()
  }

  /**
   * Get current rate limiting stats
   */
  getStats(): Record<string, { count: number, remaining: number, resetTime: number }> {
    const stats: Record<string, { count: number, remaining: number, resetTime: number }> = {}
    
    for (const [key, bucket] of this.eventCounts.entries()) {
      stats[key] = {
        count: bucket.count,
        remaining: Math.max(0, this.maxEventsPerWindow - bucket.count),
        resetTime: bucket.resetTime
      }
    }
    
    return stats
  }
}

/**
 * Default event processor factory
 */
export const createDefaultEventProcessor = (options?: EventProcessorOptions): EventProcessor => {
  const processor = new EventProcessor(options)
  
  // Register default handlers for common events
  processor.registerHandlers({
    // Tournament events
    tournament_started: async (event) => {
      console.log('Tournament started:', event)
    },
    tournament_completed: async (event) => {
      console.log('Tournament completed:', event)
    },
    
    // Match events
    match_started: async (event) => {
      console.log('Match started:', event)
    },
    match_completed: async (event) => {
      console.log('Match completed:', event)
    },
    score_updated: async (event) => {
      console.log('Score updated:', event)
    },
    
    // System events
    system_announcement: async (event) => {
      console.log('System announcement:', event)
    },
    connectivity_issue: async (event) => {
      console.warn('Connectivity issue:', event)
    }
  })
  
  return processor
}