/**
 * Real-time event types and utilities for Supabase real-time features
 * Defines all event structures, validators, and type-safe event handling
 */

// Base event interface
export interface BaseRealTimeEvent {
  eventId: string
  timestamp: string
  source: 'database' | 'broadcast' | 'presence'
  tournamentId: string
  userId?: string
}

// Database change events (postgres_changes)
export interface DatabaseChangeEvent extends BaseRealTimeEvent {
  source: 'database'
  table: 'tournaments' | 'matches' | 'players' | 'teams' | 'courts' | 'match_games' | 'team_members'
  eventType: 'INSERT' | 'UPDATE' | 'DELETE'
  recordId: string
  oldData?: Record<string, any>
  newData?: Record<string, any>
}

// Broadcast events for real-time communication
export interface BroadcastEvent extends BaseRealTimeEvent {
  source: 'broadcast'
  channel: string
  eventType: string
  payload: Record<string, any>
}

// Presence events for user tracking
export interface PresenceEvent extends BaseRealTimeEvent {
  source: 'presence'
  eventType: 'join' | 'leave' | 'sync' | 'update'
  userInfo: {
    userId: string
    name: string
    role: 'player' | 'official' | 'spectator' | 'organizer'
    joinedAt: string
    lastSeen: string
  }
}

// Tournament-specific event types
export type TournamentEventType =
  | 'tournament_created'
  | 'tournament_started' 
  | 'tournament_completed'
  | 'tournament_cancelled'
  | 'tournament_settings_updated'
  | 'tournament_status_changed'
  | 'bracket_generated'
  | 'bracket_updated'
  | 'round_started'
  | 'round_completed'

export interface TournamentEvent extends BroadcastEvent {
  eventType: TournamentEventType
  payload: {
    tournamentId: string
    oldStatus?: string
    newStatus?: string
    changes?: Record<string, any>
    metadata?: Record<string, any>
  }
}

// Match-specific event types
export type MatchEventType =
  | 'match_created'
  | 'match_started'
  | 'match_paused'
  | 'match_resumed'
  | 'match_completed'
  | 'match_cancelled'
  | 'score_updated'
  | 'end_scored'
  | 'court_assigned'
  | 'court_released'
  | 'winner_determined'

export interface MatchEvent extends BroadcastEvent {
  eventType: MatchEventType
  payload: {
    matchId: string
    tournamentId: string
    round?: number
    matchNumber?: number
    courtId?: string
    score?: Record<string, any>
    endData?: Record<string, any>
    winnerId?: string
    timestamp: string
  }
}

// Player-specific event types
export type PlayerEventType =
  | 'player_registered'
  | 'player_checked_in'
  | 'player_eliminated'
  | 'player_team_joined'
  | 'player_team_left'
  | 'player_status_changed'

export interface PlayerEvent extends BroadcastEvent {
  eventType: PlayerEventType
  payload: {
    playerId: string
    tournamentId: string
    teamId?: string
    oldStatus?: string
    newStatus?: string
    metadata?: Record<string, any>
  }
}

// Court-specific event types
export type CourtEventType =
  | 'court_created'
  | 'court_assigned'
  | 'court_released'
  | 'court_maintenance'
  | 'court_status_changed'

export interface CourtEvent extends BroadcastEvent {
  eventType: CourtEventType
  payload: {
    courtId: string
    tournamentId: string
    matchId?: string
    oldStatus?: string
    newStatus?: string
    maintenanceReason?: string
  }
}

// Live scoring event types
export type LiveScoringEventType =
  | 'live_score'
  | 'end_scored'
  | 'game_completed'
  | 'match_point'
  | 'score_celebration'

export interface LiveScoringEvent extends BroadcastEvent {
  eventType: LiveScoringEventType
  payload: {
    matchId: string
    gameNumber?: number
    endNumber?: number
    score: Record<string, any>
    isMatchPoint?: boolean
    winnerId?: string
    celebrationData?: {
      type: 'end_won' | 'game_won' | 'match_won'
      teamId: string
      points?: number
    }
  }
}

// System-wide event types
export type SystemEventType =
  | 'system_announcement'
  | 'maintenance_mode'
  | 'emergency_stop'
  | 'connectivity_issue'
  | 'data_sync_completed'

export interface SystemEvent extends BroadcastEvent {
  eventType: SystemEventType
  payload: {
    message: string
    severity: 'info' | 'warning' | 'error' | 'critical'
    autoHide?: boolean
    duration?: number
    actionRequired?: boolean
    metadata?: Record<string, any>
  }
}

// Union type of all event types
export type RealTimeEvent = 
  | DatabaseChangeEvent
  | TournamentEvent
  | MatchEvent
  | PlayerEvent
  | CourtEvent
  | LiveScoringEvent
  | SystemEvent
  | PresenceEvent

// Event validation schemas
export const EventTypeSchema = {
  tournament: [
    'tournament_created', 'tournament_started', 'tournament_completed',
    'tournament_cancelled', 'tournament_settings_updated', 'tournament_status_changed',
    'bracket_generated', 'bracket_updated', 'round_started', 'round_completed'
  ],
  match: [
    'match_created', 'match_started', 'match_paused', 'match_resumed',
    'match_completed', 'match_cancelled', 'score_updated', 'end_scored',
    'court_assigned', 'court_released', 'winner_determined'
  ],
  player: [
    'player_registered', 'player_checked_in', 'player_eliminated',
    'player_team_joined', 'player_team_left', 'player_status_changed'
  ],
  court: [
    'court_created', 'court_assigned', 'court_released',
    'court_maintenance', 'court_status_changed'
  ],
  scoring: [
    'live_score', 'end_scored', 'game_completed',
    'match_point', 'score_celebration'
  ],
  system: [
    'system_announcement', 'maintenance_mode', 'emergency_stop',
    'connectivity_issue', 'data_sync_completed'
  ]
} as const

// Event priority levels for processing order
export enum EventPriority {
  CRITICAL = 0,    // System events, emergency stops
  HIGH = 1,        // Match completion, tournament status changes
  MEDIUM = 2,      // Score updates, player changes
  LOW = 3,         // Presence updates, minor status changes
  BACKGROUND = 4   // Analytics, logging events
}

// Event priority mapping
export const getEventPriority = (eventType: string): EventPriority => {
  // Critical events
  if (['emergency_stop', 'maintenance_mode', 'connectivity_issue'].includes(eventType)) {
    return EventPriority.CRITICAL
  }
  
  // High priority events
  if ([
    'tournament_completed', 'tournament_cancelled', 'match_completed',
    'match_cancelled', 'winner_determined', 'bracket_updated'
  ].includes(eventType)) {
    return EventPriority.HIGH
  }
  
  // Medium priority events
  if ([
    'match_started', 'score_updated', 'end_scored', 'court_assigned',
    'player_eliminated', 'tournament_started'
  ].includes(eventType)) {
    return EventPriority.MEDIUM
  }
  
  // Low priority events
  if ([
    'player_checked_in', 'court_status_changed', 'match_paused',
    'match_resumed', 'tournament_settings_updated'
  ].includes(eventType)) {
    return EventPriority.LOW
  }
  
  // Default to background priority
  return EventPriority.BACKGROUND
}

// Event filtering utilities
export interface EventFilter {
  tournamentId?: string
  userId?: string
  eventTypes?: string[]
  source?: 'database' | 'broadcast' | 'presence'
  minPriority?: EventPriority
  maxAge?: number // in milliseconds
}

export const filterEvents = (events: RealTimeEvent[], filter: EventFilter): RealTimeEvent[] => {
  return events.filter(event => {
    // Tournament filter
    if (filter.tournamentId && event.tournamentId !== filter.tournamentId) {
      return false
    }
    
    // User filter
    if (filter.userId && event.userId !== filter.userId) {
      return false
    }
    
    // Event type filter
    if (filter.eventTypes && !filter.eventTypes.includes(event.eventType)) {
      return false
    }
    
    // Source filter
    if (filter.source && event.source !== filter.source) {
      return false
    }
    
    // Priority filter
    if (filter.minPriority !== undefined) {
      const eventPriority = getEventPriority(event.eventType)
      if (eventPriority > filter.minPriority) {
        return false
      }
    }
    
    // Age filter
    if (filter.maxAge !== undefined) {
      const eventAge = Date.now() - new Date(event.timestamp).getTime()
      if (eventAge > filter.maxAge) {
        return false
      }
    }
    
    return true
  })
}

// Event deduplication utilities
export const deduplicateEvents = (events: RealTimeEvent[]): RealTimeEvent[] => {
  const seen = new Set<string>()
  return events.filter(event => {
    const key = `${event.eventId}-${event.timestamp}`
    if (seen.has(key)) {
      return false
    }
    seen.add(key)
    return true
  })
}

// Event ordering utilities
export const sortEventsByPriority = (events: RealTimeEvent[]): RealTimeEvent[] => {
  return [...events].sort((a, b) => {
    const aPriority = getEventPriority(a.eventType)
    const bPriority = getEventPriority(b.eventType)
    
    // Primary sort by priority
    if (aPriority !== bPriority) {
      return aPriority - bPriority
    }
    
    // Secondary sort by timestamp (newest first for same priority)
    return new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime()
  })
}

// Event validation utilities
export const validateEvent = (event: any): event is RealTimeEvent => {
  // Check required base properties
  if (!event.eventId || !event.timestamp || !event.source || !event.tournamentId) {
    return false
  }
  
  // Check event type based on source
  if (event.source === 'database') {
    return event.table && event.eventType && ['INSERT', 'UPDATE', 'DELETE'].includes(event.eventType)
  }
  
  if (event.source === 'broadcast') {
    return event.channel && event.eventType && event.payload
  }
  
  if (event.source === 'presence') {
    return event.eventType && ['join', 'leave', 'sync', 'update'].includes(event.eventType) && event.userInfo
  }
  
  return false
}

// Event creation utilities
export const createEventId = (): string => {
  return `${Date.now()}-${Math.random().toString(36).substr(2, 9)}`
}

export const createBaseEvent = (
  source: 'database' | 'broadcast' | 'presence',
  tournamentId: string,
  userId?: string
): BaseRealTimeEvent => ({
  eventId: createEventId(),
  timestamp: new Date().toISOString(),
  source,
  tournamentId,
  userId
})

// Type guards for event types
export const isTournamentEvent = (event: RealTimeEvent): event is TournamentEvent => {
  return event.source === 'broadcast' && EventTypeSchema.tournament.includes(event.eventType as any)
}

export const isMatchEvent = (event: RealTimeEvent): event is MatchEvent => {
  return event.source === 'broadcast' && EventTypeSchema.match.includes(event.eventType as any)
}

export const isPlayerEvent = (event: RealTimeEvent): event is PlayerEvent => {
  return event.source === 'broadcast' && EventTypeSchema.player.includes(event.eventType as any)
}

export const isCourtEvent = (event: RealTimeEvent): event is CourtEvent => {
  return event.source === 'broadcast' && EventTypeSchema.court.includes(event.eventType as any)
}

export const isLiveScoringEvent = (event: RealTimeEvent): event is LiveScoringEvent => {
  return event.source === 'broadcast' && EventTypeSchema.scoring.includes(event.eventType as any)
}

export const isSystemEvent = (event: RealTimeEvent): event is SystemEvent => {
  return event.source === 'broadcast' && EventTypeSchema.system.includes(event.eventType as any)
}

export const isPresenceEvent = (event: RealTimeEvent): event is PresenceEvent => {
  return event.source === 'presence'
}

export const isDatabaseEvent = (event: RealTimeEvent): event is DatabaseChangeEvent => {
  return event.source === 'database'
}