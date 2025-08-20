// Real-time Event Types for WildTrails Tournament Management System

import { Tournament, Match, Player, Court, Score, Team } from '@/types'

// Base event interface
export interface BaseRealTimeEvent {
  timestamp: string
  eventId: string
  tournamentId: string
  userId?: string
  sessionId?: string
}

// Database change events (postgres_changes)
export interface DatabaseChangeEvent extends BaseRealTimeEvent {
  type: 'database_change'
  table: 'tournaments' | 'matches' | 'players' | 'courts' | 'teams'
  eventType: 'INSERT' | 'UPDATE' | 'DELETE'
  recordId: string
  oldRecord?: any
  newRecord?: any
}

// Tournament events
export interface TournamentEvent extends BaseRealTimeEvent {
  type: 'tournament'
  data: Tournament
}

export interface TournamentCreatedEvent extends TournamentEvent {
  subType: 'created'
}

export interface TournamentUpdatedEvent extends TournamentEvent {
  subType: 'updated'
  changes: Partial<Tournament>
}

export interface TournamentStatusChangedEvent extends TournamentEvent {
  subType: 'status_changed'
  previousStatus: Tournament['status']
  newStatus: Tournament['status']
}

export interface TournamentStartedEvent extends TournamentEvent {
  subType: 'started'
  startTime: string
}

export interface TournamentCompletedEvent extends TournamentEvent {
  subType: 'completed'
  endTime: string
  winner?: {
    teamId: string
    teamName: string
    players: string[]
  }
  statistics: {
    totalMatches: number
    duration: string
    averageMatchTime: number
  }
}

// Match events
export interface MatchEvent extends BaseRealTimeEvent {
  type: 'match'
  matchId: string
  data: Match
}

export interface MatchCreatedEvent extends MatchEvent {
  subType: 'created'
}

export interface MatchStartedEvent extends MatchEvent {
  subType: 'started'
  startTime: string
  courtId?: string
}

export interface MatchCompletedEvent extends MatchEvent {
  subType: 'completed'
  endTime: string
  finalScore: Score
  winner: string
  duration: number
  statistics?: {
    totalEnds?: number
    averageEndDuration?: number
    largestLead?: number
  }
}

export interface MatchCancelledEvent extends MatchEvent {
  subType: 'cancelled'
  reason?: string
}

export interface CourtAssignedEvent extends MatchEvent {
  subType: 'court_assigned'
  courtId: string
  courtName: string
}

// Live scoring events (broadcast)
export interface LiveScoringEvent extends BaseRealTimeEvent {
  type: 'live_scoring'
  matchId: string
}

export interface LiveScoreUpdateEvent extends LiveScoringEvent {
  subType: 'score_update'
  score: Score
  previousScore?: Score
  scoringTeamId: string
  pointsScored: number
}

export interface EndCompletedEvent extends LiveScoringEvent {
  subType: 'end_completed'
  endNumber: number
  endWinner: string
  endScore: {
    team1Points: number
    team2Points: number
  }
  currentTotalScore: Score
}

export interface GamePointReachedEvent extends LiveScoringEvent {
  subType: 'game_point'
  teamId: string
  teamName: string
  scoreNeeded: number
}

export interface ComebackEvent extends LiveScoringEvent {
  subType: 'comeback'
  teamId: string
  teamName: string
  previousDeficit: number
  currentLead: number
}

// Player events
export interface PlayerEvent extends BaseRealTimeEvent {
  type: 'player'
  playerId: string
  data: Player
}

export interface PlayerCheckedInEvent extends PlayerEvent {
  subType: 'checked_in'
  checkInTime: string
}

export interface PlayerCheckedOutEvent extends PlayerEvent {
  subType: 'checked_out'
  checkOutTime: string
}

export interface PlayerEliminatedEvent extends PlayerEvent {
  subType: 'eliminated'
  eliminationTime: string
  eliminationType: 'loss' | 'forfeit' | 'disqualification' | 'withdrawal'
  reason?: string
  finalPosition?: number
}

export interface PlayerReinstatedEvent extends PlayerEvent {
  subType: 'reinstated'
  reinstatementTime: string
  reason?: string
}

export interface PlayerStatsUpdatedEvent extends PlayerEvent {
  subType: 'stats_updated'
  previousStats: Player['stats']
  newStats: Player['stats']
  matchId?: string
}

// Court events
export interface CourtEvent extends BaseRealTimeEvent {
  type: 'court'
  courtId: string
  data: Court
}

export interface CourtStatusChangedEvent extends CourtEvent {
  subType: 'status_changed'
  previousStatus: Court['status']
  newStatus: Court['status']
  reason?: string
}

export interface CourtMaintenanceEvent extends CourtEvent {
  subType: 'maintenance'
  maintenanceType: 'scheduled' | 'emergency' | 'completed'
  estimatedDuration?: number
  description?: string
}

// Team events
export interface TeamEvent extends BaseRealTimeEvent {
  type: 'team'
  teamId: string
  data: Team
}

export interface TeamFormedEvent extends TeamEvent {
  subType: 'formed'
  playerIds: string[]
  formation: 'automatic' | 'manual'
}

export interface TeamDisbandedEvent extends TeamEvent {
  subType: 'disbanded'
  reason: 'elimination' | 'withdrawal' | 'manual'
}

// System events
export interface SystemEvent extends BaseRealTimeEvent {
  type: 'system'
}

export interface AnnouncementEvent extends SystemEvent {
  subType: 'announcement'
  title: string
  message: string
  priority: 'low' | 'medium' | 'high' | 'urgent'
  targetAudience: 'all' | 'players' | 'officials' | 'spectators' | 'organizers'
  expiresAt?: string
}

export interface TechnicalIssueEvent extends SystemEvent {
  subType: 'technical_issue'
  issue: string
  severity: 'low' | 'medium' | 'high' | 'critical'
  affectedServices: string[]
  estimatedResolution?: string
}

export interface ScheduleUpdateEvent extends SystemEvent {
  subType: 'schedule_update'
  changes: {
    type: 'delay' | 'advancement' | 'cancellation' | 'reschedule'
    matchIds: string[]
    oldTime?: string
    newTime?: string
    reason: string
  }[]
}

// Presence events
export interface PresenceEvent extends BaseRealTimeEvent {
  type: 'presence'
  userId: string
  displayName: string
  role: 'player' | 'official' | 'spectator' | 'organizer'
}

export interface UserJoinedEvent extends PresenceEvent {
  subType: 'joined'
  joinTime: string
}

export interface UserLeftEvent extends PresenceEvent {
  subType: 'left'
  leaveTime: string
  duration: number
}

export interface UserRoleChangedEvent extends PresenceEvent {
  subType: 'role_changed'
  previousRole: PresenceEvent['role']
  newRole: PresenceEvent['role']
}

export interface HeartbeatEvent extends PresenceEvent {
  subType: 'heartbeat'
  lastSeen: string
  isActive: boolean
}

// Bracket events
export interface BracketEvent extends BaseRealTimeEvent {
  type: 'bracket'
}

export interface BracketAdvancementEvent extends BracketEvent {
  subType: 'advancement'
  matchId: string
  winnerTeamId: string
  winnerTeamName: string
  nextMatchId?: string
  roundName: string
  nextRoundName?: string
}

export interface BracketCompletedEvent extends BracketEvent {
  subType: 'completed'
  bracketType: 'winner' | 'loser' | 'consolation'
  championTeamId: string
  championTeamName: string
  runnerUpTeamId?: string
  runnerUpTeamName?: string
}

// Union types for all events
export type RealTimeEvent = 
  | DatabaseChangeEvent
  | TournamentCreatedEvent
  | TournamentUpdatedEvent  
  | TournamentStatusChangedEvent
  | TournamentStartedEvent
  | TournamentCompletedEvent
  | MatchCreatedEvent
  | MatchStartedEvent
  | MatchCompletedEvent
  | MatchCancelledEvent
  | CourtAssignedEvent
  | LiveScoreUpdateEvent
  | EndCompletedEvent
  | GamePointReachedEvent
  | ComebackEvent
  | PlayerCheckedInEvent
  | PlayerCheckedOutEvent
  | PlayerEliminatedEvent
  | PlayerReinstatedEvent
  | PlayerStatsUpdatedEvent
  | CourtStatusChangedEvent
  | CourtMaintenanceEvent
  | TeamFormedEvent
  | TeamDisbandedEvent
  | AnnouncementEvent
  | TechnicalIssueEvent
  | ScheduleUpdateEvent
  | UserJoinedEvent
  | UserLeftEvent
  | UserRoleChangedEvent
  | HeartbeatEvent
  | BracketAdvancementEvent
  | BracketCompletedEvent

// Event filtering types
export type EventType = RealTimeEvent['type']
export type EventSubType = RealTimeEvent['subType']

export interface EventFilter {
  types?: EventType[]
  subTypes?: EventSubType[]
  tournamentId?: string
  userId?: string
  matchId?: string
  playerId?: string
  courtId?: string
  teamId?: string
  since?: string
  priority?: ('low' | 'medium' | 'high' | 'urgent')[]
}

// Event handler types
export type EventHandler<T extends RealTimeEvent = RealTimeEvent> = (event: T) => void | Promise<void>

export interface EventSubscription {
  id: string
  filter: EventFilter
  handler: EventHandler
  createdAt: string
  lastTriggered?: string
}

// Event emission helpers
export interface EventEmitter {
  emit<T extends RealTimeEvent>(event: T): Promise<void>
  subscribe(filter: EventFilter, handler: EventHandler): EventSubscription
  unsubscribe(subscriptionId: string): boolean
  getActiveSubscriptions(): EventSubscription[]
}

// Analytics and metrics
export interface EventMetrics {
  totalEvents: number
  eventsByType: Record<EventType, number>
  eventsBySubType: Record<EventSubType, number>
  eventsPerMinute: number
  averageEventSize: number
  connectionCount: number
  lastEventTime: string
}

// Error types
export interface RealTimeError {
  code: string
  message: string
  event?: RealTimeEvent
  timestamp: string
  recoverable: boolean
}

export type RealTimeErrorCode = 
  | 'CONNECTION_LOST'
  | 'SUBSCRIPTION_FAILED'  
  | 'EVENT_VALIDATION_FAILED'
  | 'RATE_LIMIT_EXCEEDED'
  | 'AUTHENTICATION_FAILED'
  | 'PERMISSION_DENIED'
  | 'INVALID_EVENT_FORMAT'
  | 'DATABASE_ERROR'
  | 'NETWORK_ERROR'
  | 'UNKNOWN_ERROR'