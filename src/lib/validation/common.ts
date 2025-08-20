import { z } from 'zod'
import { TournamentSchema, TournamentTypeSchema } from './tournament'
import { TeamSchema } from './player'
import { MatchSchema, ScoreSchema } from './match'

// Bracket Round Schema
export const BracketRoundSchema = z.object({
  round: z.number().int().min(1),
  name: z.string().min(1).max(100),
  matches: z.array(z.string().min(1)), // match IDs
  isComplete: z.boolean()
})

// Bracket Schema
export const BracketSchema = z.object({
  id: z.string().min(1),
  tournamentId: z.string().min(1),
  type: z.enum(['winner', 'loser', 'consolation']),
  rounds: z.array(BracketRoundSchema),
  format: TournamentTypeSchema,
  isComplete: z.boolean()
}).refine((data) => {
  // Validate that rounds are sequential
  const roundNumbers = data.rounds.map(r => r.round).sort()
  for (let i = 0; i < roundNumbers.length; i++) {
    if (roundNumbers[i] !== i + 1) {
      return false
    }
  }
  return true
}, {
  message: 'Rounds must be sequential starting from 1',
  path: ['rounds']
})

// Standing Schema
export const StandingSchema = z.object({
  teamId: z.string().min(1),
  team: TeamSchema,
  position: z.number().int().min(1),
  matchesPlayed: z.number().int().min(0),
  wins: z.number().int().min(0),
  losses: z.number().int().min(0),
  pointsFor: z.number().int().min(0),
  pointsAgainst: z.number().int().min(0),
  pointsDifferential: z.number(),
  averagePointsDifferential: z.number(),
  lastFive: z.array(z.enum(['W', 'L'])).max(5),
  status: z.enum(['active', 'eliminated', 'champion'])
}).refine((data) => {
  // Wins + losses should equal matches played
  return data.wins + data.losses === data.matchesPlayed
}, {
  message: 'Wins plus losses must equal matches played',
  path: ['wins', 'losses']
}).refine((data) => {
  // Points differential calculation
  return data.pointsDifferential === data.pointsFor - data.pointsAgainst
}, {
  message: 'Points differential must equal points for minus points against',
  path: ['pointsDifferential']
}).refine((data) => {
  // Average points differential calculation
  if (data.matchesPlayed > 0) {
    const expectedAverage = data.pointsDifferential / data.matchesPlayed
    return Math.abs(data.averagePointsDifferential - expectedAverage) < 0.01
  }
  return data.averagePointsDifferential === 0
}, {
  message: 'Average points differential must be calculated correctly',
  path: ['averagePointsDifferential']
})

// API Response Schema
export const APIResponseSchema = <T extends z.ZodType>(dataSchema: T) => z.object({
  success: z.boolean(),
  data: dataSchema.optional(),
  error: z.string().optional(),
  message: z.string().optional(),
  timestamp: z.string().datetime()
}).refine((data) => {
  // If success is true, data should be present; if false, error should be present
  if (data.success) {
    return data.data !== undefined
  } else {
    return data.error !== undefined
  }
}, {
  message: 'Success responses must have data, error responses must have error message'
})

// Paginated Response Schema
export const PaginationSchema = z.object({
  page: z.number().int().min(1),
  limit: z.number().int().min(1).max(100),
  total: z.number().int().min(0),
  totalPages: z.number().int().min(0)
}).refine((data) => {
  // Total pages calculation
  const expectedTotalPages = Math.ceil(data.total / data.limit)
  return data.totalPages === expectedTotalPages
}, {
  message: 'Total pages must be calculated correctly from total and limit',
  path: ['totalPages']
})

export const PaginatedResponseSchema = <T extends z.ZodType>(dataSchema: T) => z.object({
  data: z.array(dataSchema),
  pagination: PaginationSchema
})

// Result Type Schema (Success/Failure pattern)
export const SuccessSchema = <T extends z.ZodType>(dataSchema: T) => z.object({
  data: dataSchema,
  error: z.null()
})

export const FailureSchema = <E extends z.ZodType>(errorSchema: E) => z.object({
  data: z.null(),
  error: errorSchema
})

export const ResultSchema = <T extends z.ZodType, E extends z.ZodType>(
  dataSchema: T, 
  errorSchema: E
) => z.union([
  SuccessSchema(dataSchema),
  FailureSchema(errorSchema)
])

// Real-time Event Schemas
export const PlayerCheckinDataSchema = z.object({
  playerId: z.string().min(1),
  tournamentId: z.string().min(1),
  checkedIn: z.boolean(),
  timestamp: z.string().datetime()
})

export const TournamentStatusDataSchema = z.object({
  tournamentId: z.string().min(1),
  status: z.enum(['setup', 'active', 'completed', 'cancelled']),
  timestamp: z.string().datetime()
})

// Union type for tournament event data
export const TournamentEventDataSchema = z.union([
  TournamentSchema,
  MatchSchema,
  ScoreSchema,
  z.record(z.string(), z.unknown()), // For flexibility with additional data
  PlayerCheckinDataSchema,
  TournamentStatusDataSchema
])

// Union type for match event data  
export const MatchEventDataSchema = z.union([
  MatchSchema,
  ScoreSchema,
  z.object({
    id: z.string(),
    endNumber: z.number(),
    completed: z.boolean(),
    winner: z.string(),
    points: z.number()
  }), // End schema subset
  z.record(z.string(), z.unknown()) // For flexibility
])

export const TournamentUpdateEventSchema = z.object({
  type: z.enum(['tournament_updated', 'match_started', 'match_completed', 'score_updated']),
  tournamentId: z.string().min(1),
  data: TournamentEventDataSchema,
  timestamp: z.string().datetime()
})

export const MatchUpdateEventSchema = z.object({
  type: z.enum(['score_updated', 'end_completed', 'match_started', 'match_completed']),
  matchId: z.string().min(1),
  data: MatchEventDataSchema,
  timestamp: z.string().datetime()
})

// Generic validation schemas for common patterns
export const IdSchema = z.string().min(1, 'ID is required')
export const TimestampSchema = z.string().datetime('Invalid timestamp format')
export const EmailSchema = z.string().email('Invalid email address')
export const PhoneSchema = z.string().regex(/^[\+]?[1-9][\d]{0,15}$/, 'Invalid phone number format')
export const URLSchema = z.string().url('Invalid URL format')
export const ColorSchema = z.string().regex(/^#[0-9A-Fa-f]{6}$/, 'Invalid hex color format')

// Court Schema
export const CourtDimensionsSchema = z.object({
  length: z.number().min(10).max(30), // meters
  width: z.number().min(3).max(8), // meters  
  throwingDistance: z.number().min(6).max(10) // meters
})

export const CourtSchema = z.object({
  id: z.string().min(1),
  name: z.string().min(1).max(100),
  location: z.string().min(1).max(200),
  dimensions: CourtDimensionsSchema,
  surface: z.enum(['gravel', 'sand', 'dirt', 'artificial']),
  lighting: z.boolean(),
  covered: z.boolean(),
  status: z.enum(['available', 'occupied', 'maintenance', 'reserved']),
  currentMatch: z.string().optional(),
  nextMatch: z.string().optional(),
  amenities: z.array(z.string()),
  created_at: z.string().datetime(),
  updated_at: z.string().datetime()
})

// Common validation patterns
export const NameSchema = z.string()
  .min(1, 'Name is required')
  .max(100, 'Name must be less than 100 characters')
  .regex(/^[a-zA-ZÀ-ÿ\s'-]+$/, 'Name can only contain letters, spaces, hyphens, and apostrophes')

export const DescriptionSchema = z.string()
  .max(500, 'Description must be less than 500 characters')
  .optional()

// File upload validation
export const FileUploadSchema = z.object({
  filename: z.string().min(1),
  mimetype: z.string().min(1),
  size: z.number().min(1).max(10 * 1024 * 1024), // Max 10MB
  url: URLSchema.optional()
})

// Search and sorting schemas
export const SortOrderSchema = z.enum(['asc', 'desc'])

export const SearchQuerySchema = z.object({
  query: z.string().max(200).optional(),
  sortBy: z.string().max(50).optional(),
  sortOrder: SortOrderSchema.optional(),
  page: z.number().int().min(1).default(1),
  limit: z.number().int().min(1).max(100).default(20)
})

// Inferred Types
export type Bracket = z.infer<typeof BracketSchema>
export type BracketRound = z.infer<typeof BracketRoundSchema>
export type Standing = z.infer<typeof StandingSchema>
export type Pagination = z.infer<typeof PaginationSchema>
export type CourtDimensions = z.infer<typeof CourtDimensionsSchema>
export type Court = z.infer<typeof CourtSchema>
export type PlayerCheckinData = z.infer<typeof PlayerCheckinDataSchema>
export type TournamentStatusData = z.infer<typeof TournamentStatusDataSchema>
export type TournamentUpdateEvent = z.infer<typeof TournamentUpdateEventSchema>
export type MatchUpdateEvent = z.infer<typeof MatchUpdateEventSchema>
export type SearchQuery = z.infer<typeof SearchQuerySchema>
export type FileUpload = z.infer<typeof FileUploadSchema>

// Utility Functions
export const validateBracket = (data: unknown) => {
  return BracketSchema.safeParse(data)
}

export const validateStanding = (data: unknown) => {
  return StandingSchema.safeParse(data)
}

export const validateTournamentUpdateEvent = (data: unknown) => {
  return TournamentUpdateEventSchema.safeParse(data)
}

export const validateMatchUpdateEvent = (data: unknown) => {
  return MatchUpdateEventSchema.safeParse(data)
}

export const validateSearchQuery = (data: unknown) => {
  return SearchQuerySchema.safeParse(data)
}

// Generic API Response validators
export const createAPIResponseValidator = <T extends z.ZodType>(dataSchema: T) => {
  return (data: unknown) => APIResponseSchema(dataSchema).safeParse(data)
}

export const createPaginatedResponseValidator = <T extends z.ZodType>(dataSchema: T) => {
  return (data: unknown) => PaginatedResponseSchema(dataSchema).safeParse(data)
}