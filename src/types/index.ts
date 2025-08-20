// Core Types for Petanque Tournament Management System

export type TournamentType = 
  | 'single-elimination' 
  | 'double-elimination' 
  | 'swiss' 
  | 'round-robin' 
  | 'barrage' 
  | 'consolation'

export type TournamentStatus = 'setup' | 'active' | 'completed' | 'cancelled'

export type MatchStatus = 'scheduled' | 'active' | 'completed' | 'cancelled'

export type GameFormat = 'singles' | 'doubles' | 'triples'

export type BracketType = 'winner' | 'loser' | 'consolation'

// Core Entities

export interface Tournament {
  id: string
  name: string
  type: TournamentType
  status: TournamentStatus
  format: GameFormat
  maxPoints: number // typically 13
  shortForm: boolean // 6-end games instead of full games
  startDate: string // ISO date string
  endDate?: string // ISO date string
  description?: string
  location?: string
  organizer: string
  maxPlayers: number
  currentPlayers: number
  settings: TournamentSettings
  stats: TournamentStats
  createdAt: string
  updatedAt: string
}

export interface TournamentSettings {
  allowLateRegistration: boolean
  automaticBracketGeneration: boolean
  requireCheckin: boolean
  courtAssignmentMode: 'manual' | 'automatic'
  scoringMode: 'self-report' | 'official-only'
  realTimeUpdates: boolean
  allowSpectators: boolean
}

export interface TournamentStats {
  totalMatches: number
  completedMatches: number
  averageMatchDuration: number // minutes
  totalEnds: number
  highestScore: number
  averageScore: number
}

export interface Player {
  id: string
  firstName: string
  lastName: string
  displayName: string
  email: string
  phone?: string
  club?: string
  ranking?: number
  handicap?: number
  avatar?: string
  stats: PlayerStats
  preferences: PlayerPreferences
  createdAt: string
  updatedAt: string
}

export interface PlayerStats {
  tournamentsPlayed: number
  tournamentsWon: number
  matchesPlayed: number
  matchesWon: number
  winPercentage: number
  averagePointsFor: number
  averagePointsAgainst: number
  pointsDifferential: number
  bestFinish: string
  recentForm: number[] // last 5 match results (1 win, 0 loss)
}

export interface PlayerPreferences {
  preferredFormat: GameFormat
  notificationEmail: boolean
  notificationPush: boolean
  publicProfile: boolean
}

export interface Team {
  id: string
  name: string
  players: Player[]
  tournamentId: string
  seed?: number
  bracketType: BracketType
  stats: TeamStats
  isBye?: boolean
  createdAt: string
  updatedAt: string
}

export interface TeamStats {
  matchesPlayed: number
  matchesWon: number
  setsWon: number
  setsLost: number
  pointsFor: number
  pointsAgainst: number
  pointsDifferential: number
  averagePointsDifferential: number
  currentStreak: number
  longestStreak: number
}

export interface Match {
  id: string
  tournamentId: string
  round: number
  roundName: string // "Round 1", "Quarterfinals", "Final", etc.
  bracketType: BracketType
  team1: Team
  team2: Team
  courtId?: string
  score: Score
  status: MatchStatus
  scheduledTime?: string // ISO date string
  startTime?: string // ISO date string
  endTime?: string // ISO date string
  duration?: number // minutes
  winner?: string // team ID
  ends: End[]
  notes?: string
  referee?: string
  createdAt: string
  updatedAt: string
}

export interface Score {
  team1: number
  team2: number
  isComplete: boolean
}

export interface End {
  id: string
  endNumber: number
  jackPosition: Position
  boules: Boule[]
  winner: string // team ID
  points: number
  duration?: number // seconds
  completed: boolean
  createdAt: string
}

export interface Boule {
  id: string
  teamId: string
  playerId: string
  position: Position
  distance: number // from jack in cm
  order: number // throwing order
}

export interface Position {
  x: number // meters from baseline
  y: number // meters from left sideline
}

export interface Court {
  id: string
  name: string
  location: string
  dimensions: CourtDimensions
  surface: 'gravel' | 'sand' | 'dirt' | 'artificial'
  lighting: boolean
  covered: boolean
  status: 'available' | 'in-use' | 'maintenance' | 'reserved'
  currentMatch?: string // match ID
  nextMatch?: string // match ID
  amenities: string[]
  createdAt: string
  updatedAt: string
}

export interface CourtDimensions {
  length: number // meters
  width: number // meters
  throwingDistance: number // meters
}

export interface Bracket {
  id: string
  tournamentId: string
  type: BracketType
  rounds: BracketRound[]
  format: TournamentType
  isComplete: boolean
}

export interface BracketRound {
  round: number
  name: string
  matches: string[] // match IDs
  isComplete: boolean
}

export interface Standing {
  teamId: string
  team: Team
  position: number
  matchesPlayed: number
  wins: number
  losses: number
  pointsFor: number
  pointsAgainst: number
  pointsDifferential: number
  averagePointsDifferential: number
  lastFive: ('W' | 'L')[] // Recent 5 match results
  status: 'active' | 'eliminated' | 'champion'
}

// UI and State Types

export interface TournamentFormData {
  name: string
  type: TournamentType
  format: GameFormat
  maxPoints: number
  shortForm: boolean
  startDate: string
  description?: string
  location?: string
  organizer: string
  maxPlayers: number
  settings: Partial<TournamentSettings>
}

export interface PlayerFormData {
  firstName: string
  lastName: string
  email: string
  phone?: string
  club?: string
  ranking?: number
}

export interface MatchFormData {
  team1Score: number
  team2Score: number
  endScores?: EndScore[]
}

export interface EndScore {
  endNumber: number
  team1Points: number
  team2Points: number
  jackPosition?: Position
  boules?: Omit<Boule, 'id'>[]
}

// API Response Types

export interface APIResponse<T> {
  success: boolean
  data?: T
  error?: string
  message?: string
  timestamp: string
}

export interface PaginatedResponse<T> {
  data: T[]
  pagination: {
    page: number
    limit: number
    total: number
    totalPages: number
  }
}

// Modern Error Handling Pattern
export type Success<T> = { data: T; error: null }
export type Failure<E> = { data: null; error: E }
export type Result<T, E = Error> = Success<T> | Failure<E>

export async function tryCatch<T, E = Error>(
  asyncFn: () => Promise<T>
): Promise<Result<T, E>> {
  try {
    const data = await asyncFn()
    return { data, error: null }
  } catch (error) {
    return { data: null, error: error as E }
  }
}

// Real-time Event Types

// Specific Event Data Interfaces
export interface ScoreUpdateData {
  matchId: string
  score: Score
  timestamp: string
}

export interface MatchCompleteData {
  matchId: string
  winner: string
  finalScore: Score
  duration: number
  timestamp: string
}

export interface PlayerCheckinData {
  playerId: string
  tournamentId: string
  checkedIn: boolean
  timestamp: string
}

export interface TournamentStatusData {
  tournamentId: string
  status: TournamentStatus
  timestamp: string
}

export type TournamentEventData = 
  | Tournament 
  | Match 
  | Score 
  | ScoreUpdateData 
  | MatchCompleteData 
  | PlayerCheckinData
  | TournamentStatusData

export type MatchEventData = 
  | Match 
  | Score 
  | End 
  | ScoreUpdateData 
  | MatchCompleteData

export interface TournamentUpdateEvent {
  type: 'tournament_updated' | 'match_started' | 'match_completed' | 'score_updated'
  tournamentId: string
  data: TournamentEventData
  timestamp: string
}

export interface MatchUpdateEvent {
  type: 'score_updated' | 'end_completed' | 'match_started' | 'match_completed'
  matchId: string
  data: MatchEventData
  timestamp: string
}

// Search and Filter Types

export interface TournamentFilters {
  status?: TournamentStatus
  type?: TournamentType
  format?: GameFormat
  dateRange?: {
    start: string
    end: string
  }
  organizer?: string
  location?: string
}

export interface PlayerFilters {
  club?: string
  ranking?: {
    min: number
    max: number
  }
  winPercentage?: {
    min: number
    max: number
  }
}

export interface TournamentParticipation {
  tournamentId: string
  tournamentName: string
  type: TournamentType
  format: GameFormat
  finishPosition: number
  teamName?: string
  pointsScored: number
  pointsAgainst: number
  matchesPlayed: number
  matchesWon: number
  participationDate: string
  placement: string // "1st", "2nd", "Quarterfinals", etc.
}

export interface MatchFilters {
  status?: MatchStatus
  round?: number
  bracketType?: BracketType
  courtId?: string
  dateRange?: {
    start: string
    end: string
  }
}

// Statistics and Analytics Types

export interface TournamentAnalytics {
  playerDistribution: PlayerDistributionStats
  matchDuration: DurationStats
  scoringPatterns: ScoringPatternStats
  courtUtilization: CourtUtilizationStats
}

export interface PlayerDistributionStats {
  byClub: { [club: string]: number }
  byRanking: { [range: string]: number }
  byExperience: { [level: string]: number }
}

export interface DurationStats {
  average: number
  median: number
  shortest: number
  longest: number
  distribution: { [range: string]: number }
}

export interface ScoringPatternStats {
  averageGameScore: number
  mostCommonScores: { [score: string]: number }
  blowoutPercentage: number // games won by 8+ points
  closeGamePercentage: number // games decided by 1-2 points
}

export interface CourtUtilizationStats {
  totalHours: number
  utilizationRate: number
  peakHours: string[]
  averageMatchesPerCourt: number
}

// Export Database Error types
export { 
  DatabaseError,
  ValidationError,
  RecordNotFoundError,
  FileOperationError
} from '@/lib/db/base'

// Export scoring types
export type {
  EndScoreResult,
  EndMeasurement,
  RelativePosition,
  ScoreValidationResult,
  ScoreIntegrityCheck,
  RuleViolation,
  TeamStatistics as ScoringTeamStatistics,
  PlayerStatistics as ScoringPlayerStatistics,
  TournamentStatistics as ScoringTournamentStatistics,
  EndAnalysis,
  MatchAnalysis,
  EndInput,
  ScoringConfiguration,
  DistanceCalculationResult,
  ScoringEngineOptions,
  ValidationOptions,
  StatisticsOptions,
  ScoringEvent,
  ScoringEngineState
} from './scoring'

// Export all types for easy importing
export type {
  // Re-export common types for convenience
  Tournament as TournamentData,
  Player as PlayerData,
  Match as MatchData,
  Team as TeamData,
  Court as CourtData,
  Standing as StandingData
}