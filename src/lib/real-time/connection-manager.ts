/**
 * Connection manager for Supabase real-time features
 * Handles connection lifecycle, reconnection logic, and health monitoring
 */

import { createClientComponentClient } from '@/lib/db/supabase'
import type { RealtimeChannel, RealtimeChannelSubscribeStatus } from '@supabase/supabase-js'
import { EventProcessor, createDefaultEventProcessor } from './event-processor'
import { RealTimeEvent, createBaseEvent } from './event-types'

export interface ConnectionOptions {
  autoReconnect?: boolean
  maxReconnectAttempts?: number
  reconnectDelay?: number
  heartbeatInterval?: number
  connectionTimeout?: number
  enableEventProcessing?: boolean
}

export interface ConnectionState {
  isConnected: boolean
  isReconnecting: boolean
  connectionError: string | null
  lastConnectedAt: string | null
  lastDisconnectedAt: string | null
  reconnectAttempts: number
  channels: Map<string, RealtimeChannel>
  health: {
    latency: number
    packetsLost: number
    lastHeartbeat: string | null
  }
}

export interface ChannelConfig {
  name: string
  config?: any
  subscriptions?: {
    postgres_changes?: Array<{
      event: '*' | 'INSERT' | 'UPDATE' | 'DELETE'
      schema: string
      table?: string
      filter?: string
    }>
    broadcast?: Array<{
      event: string
    }>
    presence?: Array<{
      event: 'sync' | 'join' | 'leave'
    }>
  }
}

export class RealTimeConnectionManager {
  private supabase = createClientComponentClient()
  private state: ConnectionState = {
    isConnected: false,
    isReconnecting: false,
    connectionError: null,
    lastConnectedAt: null,
    lastDisconnectedAt: null,
    reconnectAttempts: 0,
    channels: new Map(),
    health: {
      latency: 0,
      packetsLost: 0,
      lastHeartbeat: null
    }
  }

  private heartbeatTimer: NodeJS.Timeout | null = null
  private reconnectTimer: NodeJS.Timeout | null = null
  private eventProcessor: EventProcessor | null = null

  private eventHandlers = {
    onStateChange: new Set<(state: ConnectionState) => void>(),
    onError: new Set<(error: string) => void>(),
    onReconnect: new Set<() => void>(),
    onDisconnect: new Set<() => void>()
  }

  constructor(private options: ConnectionOptions = {}) {
    this.options = {
      autoReconnect: true,
      maxReconnectAttempts: 5,
      reconnectDelay: 3000,
      heartbeatInterval: 30000,
      connectionTimeout: 10000,
      enableEventProcessing: true,
      ...options
    }

    if (this.options.enableEventProcessing) {
      this.eventProcessor = createDefaultEventProcessor()
    }

    this.setupNetworkListeners()
  }

  /**
   * Get current connection state
   */
  getState(): ConnectionState {
    return { ...this.state }
  }

  /**
   * Create and configure a new channel
   */
  async createChannel(config: ChannelConfig): Promise<RealtimeChannel | null> {
    try {
      if (this.state.channels.has(config.name)) {
        console.warn(`Channel ${config.name} already exists`)
        return this.state.channels.get(config.name) || null
      }

      const channel = this.supabase.channel(config.name, config.config)
      
      // Configure postgres_changes subscriptions
      if (config.subscriptions?.postgres_changes) {
        for (const subscription of config.subscriptions.postgres_changes) {
          channel.on('postgres_changes', subscription, (payload) => {
            this.handleDatabaseEvent(config.name, payload)
          })
        }
      }

      // Configure broadcast subscriptions
      if (config.subscriptions?.broadcast) {
        for (const subscription of config.subscriptions.broadcast) {
          channel.on('broadcast', subscription, (payload) => {
            this.handleBroadcastEvent(config.name, subscription.event, payload)
          })
        }
      }

      // Configure presence subscriptions
      if (config.subscriptions?.presence) {
        for (const subscription of config.subscriptions.presence) {
          channel.on('presence', subscription, (payload) => {
            this.handlePresenceEvent(config.name, subscription.event, payload)
          })
        }
      }

      // Subscribe to channel
      const subscribePromise = new Promise<RealtimeChannel>((resolve, reject) => {
        const timeout = setTimeout(() => {
          reject(new Error('Channel subscription timeout'))
        }, this.options.connectionTimeout || 10000)

        channel.subscribe((status: RealtimeChannelSubscribeStatus, error?: Error) => {
          clearTimeout(timeout)

          if (error) {
            reject(error)
          } else if (status === 'SUBSCRIBED') {
            this.state.channels.set(config.name, channel)
            this.updateConnectionState(true)
            resolve(channel)
          } else if (status === 'CHANNEL_ERROR' || status === 'TIMED_OUT') {
            reject(new Error(`Channel subscription failed: ${status}`))
          }
        })
      })

      return await subscribePromise

    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : 'Failed to create channel'
      this.handleError(errorMessage)
      return null
    }
  }

  /**
   * Remove a channel
   */
  async removeChannel(channelName: string): Promise<boolean> {
    const channel = this.state.channels.get(channelName)
    if (!channel) {
      return false
    }

    try {
      this.supabase.removeChannel(channel)
      this.state.channels.delete(channelName)
      
      if (this.state.channels.size === 0) {
        this.updateConnectionState(false)
      }
      
      return true
    } catch (error) {
      console.error(`Failed to remove channel ${channelName}:`, error)
      return false
    }
  }

  /**
   * Remove all channels and disconnect
   */
  async disconnect(): Promise<void> {
    this.stopHeartbeat()
    this.stopReconnectTimer()

    for (const [name, channel] of this.state.channels) {
      try {
        this.supabase.removeChannel(channel)
      } catch (error) {
        console.error(`Error removing channel ${name}:`, error)
      }
    }

    this.state.channels.clear()
    this.updateConnectionState(false)
    this.state.lastDisconnectedAt = new Date().toISOString()

    this.eventHandlers.onDisconnect.forEach(handler => {
      try {
        handler()
      } catch (error) {
        console.error('Error in disconnect handler:', error)
      }
    })
  }

  /**
   * Force reconnection attempt
   */
  async reconnect(): Promise<void> {
    if (this.state.isReconnecting) {
      return
    }

    this.state.isReconnecting = true
    this.state.reconnectAttempts++

    try {
      // Store channel configs for recreation
      const channelConfigs: Array<{ name: string, config: any }> = []
      for (const [name, channel] of this.state.channels) {
        channelConfigs.push({ name, config: (channel as any).bindings })
      }

      // Disconnect all channels
      await this.disconnect()

      // Wait for reconnect delay
      await new Promise(resolve => setTimeout(resolve, this.options.reconnectDelay || 3000))

      // Recreate channels (this would need the original configs)
      // Note: In a real implementation, you'd need to store the original channel configs
      
      this.state.connectionError = null
      this.state.isReconnecting = false

      this.eventHandlers.onReconnect.forEach(handler => {
        try {
          handler()
        } catch (error) {
          console.error('Error in reconnect handler:', error)
        }
      })

    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : 'Reconnection failed'
      this.handleError(errorMessage)
      this.state.isReconnecting = false

      // Schedule next reconnect attempt if enabled
      if (this.options.autoReconnect && 
          this.state.reconnectAttempts < (this.options.maxReconnectAttempts || 5)) {
        this.scheduleReconnect()
      }
    }
  }

  /**
   * Register event handlers
   */
  onStateChange(handler: (state: ConnectionState) => void): () => void {
    this.eventHandlers.onStateChange.add(handler)
    return () => this.eventHandlers.onStateChange.delete(handler)
  }

  onError(handler: (error: string) => void): () => void {
    this.eventHandlers.onError.add(handler)
    return () => this.eventHandlers.onError.delete(handler)
  }

  onReconnect(handler: () => void): () => void {
    this.eventHandlers.onReconnect.add(handler)
    return () => this.eventHandlers.onReconnect.delete(handler)
  }

  onDisconnect(handler: () => void): () => void {
    this.eventHandlers.onDisconnect.add(handler)
    return () => this.eventHandlers.onDisconnect.delete(handler)
  }

  /**
   * Get connection health metrics
   */
  getHealthMetrics(): ConnectionState['health'] {
    return { ...this.state.health }
  }

  /**
   * Start connection health monitoring
   */
  private startHeartbeat(): void {
    if (this.heartbeatTimer) {
      return
    }

    this.heartbeatTimer = setInterval(() => {
      this.performHeartbeat()
    }, this.options.heartbeatInterval || 30000)
  }

  /**
   * Stop connection health monitoring
   */
  private stopHeartbeat(): void {
    if (this.heartbeatTimer) {
      clearInterval(this.heartbeatTimer)
      this.heartbeatTimer = null
    }
  }

  /**
   * Perform heartbeat check
   */
  private async performHeartbeat(): Promise<void> {
    const startTime = Date.now()

    try {
      // Send a simple query to test connection
      const { error } = await this.supabase
        .from('tournaments')
        .select('count')
        .limit(1)

      if (error) {
        throw error
      }

      // Update health metrics
      this.state.health.latency = Date.now() - startTime
      this.state.health.lastHeartbeat = new Date().toISOString()

    } catch (error) {
      this.state.health.packetsLost++
      this.handleError('Heartbeat failed')
      
      if (this.options.autoReconnect) {
        this.scheduleReconnect()
      }
    }
  }

  /**
   * Schedule reconnection attempt
   */
  private scheduleReconnect(): void {
    if (this.reconnectTimer) {
      return
    }

    const delay = this.options.reconnectDelay || 3000
    this.reconnectTimer = setTimeout(() => {
      this.reconnectTimer = null
      this.reconnect()
    }, delay)
  }

  /**
   * Stop reconnection timer
   */
  private stopReconnectTimer(): void {
    if (this.reconnectTimer) {
      clearTimeout(this.reconnectTimer)
      this.reconnectTimer = null
    }
  }

  /**
   * Update connection state and notify handlers
   */
  private updateConnectionState(isConnected: boolean): void {
    const wasConnected = this.state.isConnected
    this.state.isConnected = isConnected

    if (isConnected && !wasConnected) {
      this.state.lastConnectedAt = new Date().toISOString()
      this.state.reconnectAttempts = 0
      this.startHeartbeat()
    } else if (!isConnected && wasConnected) {
      this.state.lastDisconnectedAt = new Date().toISOString()
      this.stopHeartbeat()
    }

    this.notifyStateChange()
  }

  /**
   * Handle errors
   */
  private handleError(error: string): void {
    this.state.connectionError = error
    
    this.eventHandlers.onError.forEach(handler => {
      try {
        handler(error)
      } catch (error) {
        console.error('Error in error handler:', error)
      }
    })

    this.notifyStateChange()
  }

  /**
   * Notify state change handlers
   */
  private notifyStateChange(): void {
    this.eventHandlers.onStateChange.forEach(handler => {
      try {
        handler(this.state)
      } catch (error) {
        console.error('Error in state change handler:', error)
      }
    })
  }

  /**
   * Handle database change events
   */
  private handleDatabaseEvent(channelName: string, payload: any): void {
    if (!this.eventProcessor) return

    const event: RealTimeEvent = {
      ...createBaseEvent('database', payload.new?.tournament_id || payload.old?.tournament_id || ''),
      table: payload.table,
      eventType: payload.eventType,
      recordId: payload.new?.id || payload.old?.id || '',
      oldData: payload.old,
      newData: payload.new
    } as any

    this.eventProcessor.addEvent(event)
  }

  /**
   * Handle broadcast events
   */
  private handleBroadcastEvent(channelName: string, eventType: string, payload: any): void {
    if (!this.eventProcessor) return

    const event: RealTimeEvent = {
      ...createBaseEvent('broadcast', payload.payload?.tournamentId || ''),
      channel: channelName,
      eventType,
      payload: payload.payload
    } as any

    this.eventProcessor.addEvent(event)
  }

  /**
   * Handle presence events
   */
  private handlePresenceEvent(channelName: string, eventType: string, payload: any): void {
    if (!this.eventProcessor) return

    const event: RealTimeEvent = {
      ...createBaseEvent('presence', payload.tournamentId || ''),
      eventType: eventType as any,
      userInfo: payload.userInfo || payload.newPresences?.[0] || payload.leftPresences?.[0]
    } as any

    this.eventProcessor.addEvent(event)
  }

  /**
   * Setup network event listeners
   */
  private setupNetworkListeners(): void {
    if (typeof window === 'undefined') return

    window.addEventListener('online', () => {
      if (this.options.autoReconnect && !this.state.isConnected) {
        this.reconnect()
      }
    })

    window.addEventListener('offline', () => {
      this.handleError('Network connection lost')
    })
  }

  /**
   * Cleanup resources
   */
  destroy(): void {
    this.disconnect()
    this.eventProcessor?.destroy()
    
    // Clear all event handlers
    this.eventHandlers.onStateChange.clear()
    this.eventHandlers.onError.clear()
    this.eventHandlers.onReconnect.clear()
    this.eventHandlers.onDisconnect.clear()
  }
}