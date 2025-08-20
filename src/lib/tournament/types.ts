import { Tournament, Team, Match } from '@/types'
import type { BracketNode } from '@/lib/actions/bracket-management'

export interface SeedingOptions {
  method: 'ranked' | 'random' | 'club-balanced' | 'geographic' | 'skill-balanced'
  avoidSameClub?: boolean
  regionalBalance?: boolean
  skillDistribution?: 'even' | 'snake' | 'random'
  randomSeed?: number // For reproducible random seeding
}

export interface BracketGenerationOptions {
  seeding: SeedingOptions
  allowByes?: boolean
  byePlacement?: 'top' | 'bottom' | 'balanced'
  validateTeamCount?: boolean
}

export interface BracketResult {
  matches: Omit<Match, 'id' | 'createdAt' | 'updatedAt'>[]
  bracketStructure: BracketNode[]
  metadata: BracketMetadata
  seededTeams: Team[]
  byeTeams?: Team[]
}

export interface BracketMetadata {
  format: string
  totalRounds: number
  totalMatches: number
  estimatedDuration: number // minutes
  minPlayers: number
  maxPlayers: number
  supportsByes: boolean
  supportsConsolation: boolean
}

export interface ProgressionResult {
  affectedMatches: Match[]
  newMatches: Omit<Match, 'id' | 'createdAt' | 'updatedAt'>[]
  updatedBracketStructure: BracketNode[]
  isComplete: boolean
  finalRankings?: TeamRanking[]
}

export interface TeamRanking {
  rank: number
  team: Team
  wins: number
  losses: number
  points: number
  pointsDifferential: number
  tieBreaker: number
}

export interface Standings {
  rankings: TeamRanking[]
  tieBreakers: TieBreaker[]
  metadata: StandingsMetadata
}

export interface TieBreaker {
  method: 'head-to-head' | 'points-differential' | 'points-against' | 'strength-of-schedule' | 'buchholz' | 'sonneborn-berger'
  description: string
}

export interface StandingsMetadata {
  lastUpdated: string
  totalMatches: number
  completedMatches: number
  pendingMatches: number
}

export interface PairingOptions {
  avoidRematches?: boolean
  balanceColors?: boolean // For games where color matters
  strengthBased?: boolean
  randomization?: number // 0-1 scale for randomness
}

export interface PairingResult {
  pairings: TeamPairing[]
  unpaired: Team[]
  byeTeam?: Team
}

export interface TeamPairing {
  team1: Team
  team2: Team
  expectedResult?: number // For strength-based pairings
  round: number
}

export interface FormatConstraints {
  minTeams: number
  maxTeams?: number
  preferredTeamCounts: number[] // Power of 2 for elimination, any for round robin
  supportsOddTeamCount: boolean
  supportsByes: boolean
  maxRounds?: number
}

export interface ValidatorResult {
  isValid: boolean
  errors: string[]
  warnings: string[]
  suggestions: string[]
}