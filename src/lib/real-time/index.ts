/**
 * Real-time utilities for WildTrails tournament management
 * 
 * This module provides comprehensive real-time functionality using Supabase:
 * - Event types and validation
 * - Event processing and queuing
 * - Connection management and health monitoring
 * - Type-safe event handling
 */

// Event types and utilities
export {
  // Base types
  type BaseRealTimeEvent,
  type DatabaseChangeEvent,
  type BroadcastEvent,
  type PresenceEvent,
  type RealTimeEvent,
  
  // Specific event types
  type TournamentEvent,
  type MatchEvent,
  type PlayerEvent,
  type CourtEvent,
  type LiveScoringEvent,
  type SystemEvent,
  
  // Event type enums
  type TournamentEventType,
  type MatchEventType,
  type PlayerEventType,
  type CourtEventType,
  type LiveScoringEventType,
  type SystemEventType,
  
  // Utilities
  EventPriority,
  type EventFilter,
  getEventPriority,
  filterEvents,
  deduplicateEvents,
  sortEventsByPriority,
  validateEvent,
  createEventId,
  createBaseEvent,
  
  // Type guards
  isTournamentEvent,
  isMatchEvent,
  isPlayerEvent,
  isCourtEvent,
  isLiveScoringEvent,
  isSystemEvent,
  isPresenceEvent,
  isDatabaseEvent,
  
  // Schemas
  EventTypeSchema
} from './event-types'

// Event processing
export {
  EventProcessor,
  EventDebouncer,
  EventRateLimiter,
  createDefaultEventProcessor,
  type EventProcessorOptions,
  type EventProcessorStats
} from './event-processor'

// Connection management
export {
  RealTimeConnectionManager,
  type ConnectionOptions,
  type ConnectionState,
  type ChannelConfig
} from './connection-manager'

// Common event creation helpers
import { 
  createBaseEvent, 
  type TournamentEvent, 
  type MatchEvent, 
  type PlayerEvent, 
  type CourtEvent,
  type LiveScoringEvent,
  type SystemEvent
} from './event-types'

/**
 * Helper functions to create specific event types
 */
export const createTournamentEvent = (
  tournamentId: string,
  eventType: string,
  payload: any,
  userId?: string
): TournamentEvent => ({
  ...createBaseEvent('broadcast', tournamentId, userId),
  channel: `tournament_${tournamentId}`,
  eventType: eventType as any,
  payload: {
    tournamentId,
    ...payload
  }
})

export const createMatchEvent = (
  tournamentId: string,
  matchId: string,
  eventType: string,
  payload: any,
  userId?: string
): MatchEvent => ({
  ...createBaseEvent('broadcast', tournamentId, userId),
  channel: `match_${matchId}`,
  eventType: eventType as any,
  payload: {
    matchId,
    tournamentId,
    timestamp: new Date().toISOString(),
    ...payload
  }
})

export const createPlayerEvent = (
  tournamentId: string,
  playerId: string,
  eventType: string,
  payload: any,
  userId?: string
): PlayerEvent => ({
  ...createBaseEvent('broadcast', tournamentId, userId),
  channel: `player_${playerId}`,
  eventType: eventType as any,
  payload: {
    playerId,
    tournamentId,
    ...payload
  }
})

export const createCourtEvent = (
  tournamentId: string,
  courtId: string,
  eventType: string,
  payload: any,
  userId?: string
): CourtEvent => ({
  ...createBaseEvent('broadcast', tournamentId, userId),
  channel: `court_${courtId}`,
  eventType: eventType as any,
  payload: {
    courtId,
    tournamentId,
    ...payload
  }
})

export const createLiveScoringEvent = (
  tournamentId: string,
  matchId: string,
  eventType: string,
  payload: any,
  userId?: string
): LiveScoringEvent => ({
  ...createBaseEvent('broadcast', tournamentId, userId),
  channel: `live_scoring_${matchId}`,
  eventType: eventType as any,
  payload: {
    matchId,
    ...payload
  }
})

export const createSystemEvent = (
  tournamentId: string,
  eventType: string,
  message: string,
  severity: 'info' | 'warning' | 'error' | 'critical' = 'info',
  metadata?: any,
  userId?: string
): SystemEvent => ({
  ...createBaseEvent('broadcast', tournamentId, userId),
  channel: 'system',
  eventType: eventType as any,
  payload: {
    message,
    severity,
    autoHide: severity === 'info',
    duration: severity === 'info' ? 5000 : severity === 'warning' ? 10000 : 0,
    actionRequired: severity === 'error' || severity === 'critical',
    metadata
  }
})

/**
 * Event broadcasting utilities
 */
export class EventBroadcaster {
  constructor(private connectionManager: RealTimeConnectionManager) {}

  async broadcastTournamentEvent(
    tournamentId: string,
    eventType: string,
    payload: any,
    userId?: string
  ): Promise<boolean> {
    const event = createTournamentEvent(tournamentId, eventType, payload, userId)
    const channel = this.connectionManager.getState().channels.get(`tournament_${tournamentId}`)
    
    if (!channel) {
      console.error(`Tournament channel not found: tournament_${tournamentId}`)
      return false
    }

    try {
      channel.send({
        type: 'broadcast',
        event: 'tournament_event',
        payload: event.payload
      })
      return true
    } catch (error) {
      console.error('Failed to broadcast tournament event:', error)
      return false
    }
  }

  async broadcastMatchEvent(
    tournamentId: string,
    matchId: string,
    eventType: string,
    payload: any,
    userId?: string
  ): Promise<boolean> {
    const event = createMatchEvent(tournamentId, matchId, eventType, payload, userId)
    const channel = this.connectionManager.getState().channels.get(`match_${matchId}`)
    
    if (!channel) {
      console.error(`Match channel not found: match_${matchId}`)
      return false
    }

    try {
      channel.send({
        type: 'broadcast',
        event: 'match_event',
        payload: event.payload
      })
      return true
    } catch (error) {
      console.error('Failed to broadcast match event:', error)
      return false
    }
  }

  async broadcastSystemAnnouncement(
    tournamentId: string,
    message: string,
    severity: 'info' | 'warning' | 'error' | 'critical' = 'info',
    metadata?: any
  ): Promise<boolean> {
    const event = createSystemEvent(tournamentId, 'system_announcement', message, severity, metadata)
    const channel = this.connectionManager.getState().channels.get(`tournament_${tournamentId}`)
    
    if (!channel) {
      console.error(`Tournament channel not found for system announcement: tournament_${tournamentId}`)
      return false
    }

    try {
      channel.send({
        type: 'broadcast',
        event: 'system_announcement',
        payload: event.payload
      })
      return true
    } catch (error) {
      console.error('Failed to broadcast system announcement:', error)
      return false
    }
  }
}

/**
 * Default real-time setup for tournaments
 */
export const createTournamentRealTimeSetup = (
  tournamentId: string,
  options?: {
    enablePresence?: boolean
    enableLiveScoring?: boolean
    enableSystemEvents?: boolean
  }
) => {
  const { 
    enablePresence = true,
    enableLiveScoring = true,
    enableSystemEvents = true
  } = options || {}

  const connectionManager = new RealTimeConnectionManager({
    autoReconnect: true,
    maxReconnectAttempts: 5,
    enableEventProcessing: true
  })

  const eventBroadcaster = new EventBroadcaster(connectionManager)

  // Setup tournament channels
  const channels = [
    // Main tournament channel
    {
      name: `tournament_${tournamentId}`,
      config: {},
      subscriptions: {
        postgres_changes: [
          { event: '*' as const, schema: 'public', table: 'tournaments', filter: `id=eq.${tournamentId}` },
          { event: '*' as const, schema: 'public', table: 'matches', filter: `tournament_id=eq.${tournamentId}` },
          { event: '*' as const, schema: 'public', table: 'teams', filter: `tournament_id=eq.${tournamentId}` },
          { event: '*' as const, schema: 'public', table: 'courts', filter: `tournament_id=eq.${tournamentId}` }
        ],
        broadcast: [
          { event: 'tournament_event' },
          { event: 'match_event' },
          ...(enableSystemEvents ? [{ event: 'system_announcement' }] : [])
        ]
      }
    }
  ]

  // Add live scoring channel if enabled
  if (enableLiveScoring) {
    channels.push({
      name: `live_scoring_${tournamentId}`,
      config: {},
      subscriptions: {
        postgres_changes: [
          { event: '*' as const, schema: 'public', table: 'match_games', filter: `match_id.matches.tournament_id=eq.${tournamentId}` }
        ],
        broadcast: [
          { event: 'live_score' },
          { event: 'end_scored' },
          { event: 'score_celebration' }
        ]
      }
    })
  }

  // Add presence channel if enabled
  if (enablePresence) {
    channels.push({
      name: `tournament_presence_${tournamentId}`,
      config: { presence: { key: '' } }, // Will be set when user connects
      subscriptions: {
        presence: [
          { event: 'sync' },
          { event: 'join' },
          { event: 'leave' }
        ]
      }
    })
  }

  return {
    connectionManager,
    eventBroadcaster,
    channels,
    async connect() {
      for (const channelConfig of channels) {
        await connectionManager.createChannel(channelConfig)
      }
    },
    async disconnect() {
      await connectionManager.disconnect()
    }
  }
}