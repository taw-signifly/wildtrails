import { z } from 'zod'

/**
 * Comprehensive Zod validation schemas for Petanque scoring engine
 * Ensures runtime type safety for all external inputs
 */

// Core geometry schemas
export const PositionSchema = z.object({
  x: z.number().min(0).max(15, 'X coordinate must be within court bounds (0-15m)'),
  y: z.number().min(0).max(4, 'Y coordinate must be within court bounds (0-4m)')
})

export const CourtDimensionsSchema = z.object({
  length: z.number().min(10).max(20, 'Court length must be between 10-20 meters'),
  width: z.number().min(3).max(6, 'Court width must be between 3-6 meters'),
  throwingDistance: z.number().min(6).max(10, 'Throwing distance must be between 6-10 meters')
})

// Boule validation
export const BouleSchema = z.object({
  id: z.string().min(1, 'Boule ID is required'),
  teamId: z.string().min(1, 'Team ID is required'),
  playerId: z.string().min(1, 'Player ID is required'),
  position: PositionSchema,
  distance: z.number().min(0).optional(),
  order: z.number().int().min(1).max(6, 'Boule order must be between 1-6')
})

// End input validation
export const EndInputSchema = z.object({
  endNumber: z.number().int().min(1, 'End number must be positive'),
  jackPosition: PositionSchema,
  boules: z.array(BouleSchema).min(1, 'At least one boule is required'),
  duration: z.number().min(0).optional(),
  notes: z.string().optional()
}).refine(
  (data) => {
    // Validate unique boule IDs
    const bouleIds = data.boules.map(b => b.id)
    return new Set(bouleIds).size === bouleIds.length
  },
  { message: 'All boule IDs must be unique' }
).refine(
  (data) => {
    // Validate at least two teams participating
    const teamIds = new Set(data.boules.map(b => b.teamId))
    return teamIds.size >= 2
  },
  { message: 'At least two teams must have boules in the end' }
)

// Score validation
export const ScoreSchema = z.object({
  team1: z.number().int().min(0).max(13, 'Team score must be between 0-13'),
  team2: z.number().int().min(0).max(13, 'Team score must be between 0-13'),
  isComplete: z.boolean()
}).refine(
  (data) => {
    // At least one team must reach 13 points for completion
    if (data.isComplete) {
      return data.team1 === 13 || data.team2 === 13
    }
    return true
  },
  { message: 'Complete games must have a winner with 13 points' }
).refine(
  (data) => {
    // Both teams cannot reach 13 points
    return !(data.team1 === 13 && data.team2 === 13)
  },
  { message: 'Both teams cannot have 13 points' }
)

// End result validation
export const EndScoreResultSchema = z.object({
  winner: z.string().min(1, 'Winner team ID is required'),
  points: z.number().int().min(1).max(6, 'Points must be between 1-6'),
  winningBoules: z.array(BouleSchema),
  measurements: z.array(z.object({
    bouleId: z.string().min(1),
    distanceFromJack: z.number().min(0),
    teamId: z.string().min(1),
    isClosest: z.boolean(),
    isScoring: z.boolean(),
    measurementType: z.enum(['calculated', 'measured', 'estimated']),
    precision: z.number().positive()
  })),
  isCloseCall: z.boolean(),
  confidence: z.number().min(0).max(1),
  endSummary: z.string().min(1)
})

// Scoring configuration validation
export const ScoringConfigurationSchema = z.object({
  gameFormat: z.enum(['singles', 'doubles', 'triples']),
  maxPoints: z.number().int().min(6).max(21).default(13),
  maxPointsPerEnd: z.number().int().min(1).max(6).default(6),
  measurementPrecision: z.number().positive().max(1).default(0.1),
  courtDimensions: CourtDimensionsSchema,
  shortForm: z.boolean().default(false),
  tiebreakRules: z.enum(['sudden_death', 'extra_ends', 'measurement']).default('extra_ends'),
  jackValidZone: z.object({
    minDistance: z.number().min(6).max(8).default(6),
    maxDistance: z.number().min(8).max(12).default(10)
  })
})

// Engine options validation
export const ScoringEngineOptionsSchema = z.object({
  precision: z.number().positive().max(1).default(0.1),
  measurementThreshold: z.number().positive().max(10).default(2),
  confidenceThreshold: z.number().min(0).max(1).default(0.8),
  debugMode: z.boolean().default(false)
})

// Validation options
export const ValidationOptionsSchema = z.object({
  strict: z.boolean().default(true),
  allowManualOverrides: z.boolean().default(false),
  validateProgression: z.boolean().default(true),
  checkIntegrity: z.boolean().default(true)
})

// Statistics options
export const StatisticsOptionsSchema = z.object({
  includeIncompleteMatches: z.boolean().default(false),
  weightRecentMatches: z.boolean().default(true),
  minimumMatchesRequired: z.number().int().min(1).default(1),
  calculationPrecision: z.number().int().min(0).max(5).default(2)
})

// Match validation for comprehensive scoring
export const MatchForScoringSchema = z.object({
  id: z.string().min(1),
  tournamentId: z.string().min(1),
  team1Id: z.string().min(1),
  team2Id: z.string().min(1),
  score: ScoreSchema,
  ends: z.array(z.object({
    endNumber: z.number().int().min(1),
    winner: z.string().min(1),
    points: z.number().int().min(1).max(6),
    boules: z.array(BouleSchema),
    jackPosition: PositionSchema,
    duration: z.number().min(0).optional(),
    notes: z.string().optional()
  })),
  status: z.enum(['pending', 'active', 'completed', 'cancelled']),
  startTime: z.string().datetime().optional(),
  endTime: z.string().datetime().optional(),
  duration: z.number().min(0).optional(),
  winner: z.string().optional(),
  createdAt: z.string().datetime(),
  updatedAt: z.string().datetime()
})

// Cache entry validation for type safety
export const CacheEntrySchema = z.object({
  value: z.unknown(),
  timestamp: z.number().int().positive(),
  hits: z.number().int().min(0).default(0),
  size: z.number().int().min(0).default(1)
})

// Team statistics validation
export const TeamStatisticsSchema = z.object({
  matchesPlayed: z.number().int().min(0),
  matchesWon: z.number().int().min(0),
  matchesLost: z.number().int().min(0),
  winPercentage: z.number().min(0).max(100),
  totalPointsFor: z.number().int().min(0),
  totalPointsAgainst: z.number().int().min(0),
  averagePointsFor: z.number().min(0),
  averagePointsAgainst: z.number().min(0),
  pointsDifferential: z.number().int(),
  averagePointsDifferential: z.number(),
  dominantWins: z.number().int().min(0),
  comfortableWins: z.number().int().min(0),
  closeWins: z.number().int().min(0),
  closeLosses: z.number().int().min(0),
  comfortableLosses: z.number().int().min(0),
  dominantLosses: z.number().int().min(0),
  currentStreak: z.number().int(),
  longestWinStreak: z.number().int().min(0),
  longestLossStreak: z.number().int().min(0),
  recentForm: z.array(z.number().int().min(0).max(1)).max(10),
  formIndex: z.number().min(0).max(100),
  largestWin: z.number().int().min(0),
  largestLoss: z.number().int().min(0),
  averageMatchDuration: z.number().min(0),
  fastestWin: z.number().min(0),
  longestMatch: z.number().min(0)
})

// Error schemas for structured error handling
export const ScoringErrorSchema = z.object({
  code: z.string().min(1),
  message: z.string().min(1),
  context: z.record(z.string(), z.unknown()).optional(),
  severity: z.enum(['low', 'medium', 'high', 'critical']).default('medium'),
  timestamp: z.string().datetime().optional().default(new Date().toISOString())
})

// Export types derived from schemas
export type ValidatedEndInput = z.infer<typeof EndInputSchema>
export type ValidatedScoringConfiguration = z.infer<typeof ScoringConfigurationSchema>
export type ValidatedScoringEngineOptions = z.infer<typeof ScoringEngineOptionsSchema>
export type ValidatedTeamStatistics = z.infer<typeof TeamStatisticsSchema>
export type ValidatedCacheEntry<T> = z.infer<typeof CacheEntrySchema> & { value: T }
export type ValidatedScoringError = z.infer<typeof ScoringErrorSchema>

/**
 * Validation helper functions
 */
export function validateEndInput(data: unknown): ValidatedEndInput {
  return EndInputSchema.parse(data)
}

export function validateScoringConfiguration(data: unknown): ValidatedScoringConfiguration {
  return ScoringConfigurationSchema.parse(data)
}

export function validateScoringEngineOptions(data: unknown): ValidatedScoringEngineOptions {
  return ScoringEngineOptionsSchema.parse(data)
}

export function validateTeamStatistics(data: unknown): ValidatedTeamStatistics {
  return TeamStatisticsSchema.parse(data)
}

/**
 * Safe parsing functions that return ActionResult pattern
 */
export function safeParseEndInput(data: unknown): {
  success: true
  data: ValidatedEndInput
} | {
  success: false
  error: string
  fieldErrors?: Record<string, string[]>
} {
  const result = EndInputSchema.safeParse(data)
  if (result.success) {
    return { success: true, data: result.data }
  }
  
  const fieldErrors: Record<string, string[]> = {}
  result.error.issues.forEach(issue => {
    const path = issue.path.join('.')
    if (!fieldErrors[path]) fieldErrors[path] = []
    fieldErrors[path].push(issue.message)
  })
  
  return {
    success: false,
    error: 'Validation failed',
    fieldErrors
  }
}

export function safeParseScoringConfiguration(data: unknown): {
  success: true
  data: ValidatedScoringConfiguration
} | {
  success: false
  error: string
  fieldErrors?: Record<string, string[]>
} {
  const result = ScoringConfigurationSchema.safeParse(data)
  if (result.success) {
    return { success: true, data: result.data }
  }
  
  const fieldErrors: Record<string, string[]> = {}
  result.error.issues.forEach(issue => {
    const path = issue.path.join('.')
    if (!fieldErrors[path]) fieldErrors[path] = []
    fieldErrors[path].push(issue.message)
  })
  
  return {
    success: false,
    error: 'Configuration validation failed',
    fieldErrors
  }
}