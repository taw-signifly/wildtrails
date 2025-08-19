import { z } from 'zod'

// Tournament Type Enums
export const TournamentTypeSchema = z.enum([
  'single-elimination',
  'double-elimination', 
  'swiss',
  'round-robin',
  'barrage',
  'consolation'
])

export const TournamentStatusSchema = z.enum([
  'setup',
  'active', 
  'completed',
  'cancelled'
])

export const GameFormatSchema = z.enum([
  'singles',
  'doubles',
  'triples'
])

// Tournament Settings Schema
export const TournamentSettingsSchema = z.object({
  allowLateRegistration: z.boolean(),
  automaticBracketGeneration: z.boolean(),
  requireCheckin: z.boolean(),
  courtAssignmentMode: z.enum(['manual', 'automatic']),
  scoringMode: z.enum(['self-report', 'official-only']),
  realTimeUpdates: z.boolean(),
  allowSpectators: z.boolean()
})

// Tournament Statistics Schema
export const TournamentStatsSchema = z.object({
  totalMatches: z.number().min(0),
  completedMatches: z.number().min(0),
  averageMatchDuration: z.number().min(0), // minutes
  totalEnds: z.number().min(0),
  highestScore: z.number().min(0).max(13),
  averageScore: z.number().min(0).max(13)
})

// Tournament Form Data Schema (for creating/updating tournaments)
export const TournamentFormDataSchema = z.object({
  name: z.string().min(1, 'Tournament name is required').max(100, 'Tournament name must be less than 100 characters'),
  type: TournamentTypeSchema,
  format: GameFormatSchema,
  maxPoints: z.number().min(1).max(21).default(13), // Typically 13 in Petanque
  shortForm: z.boolean().default(false),
  startDate: z.string().datetime('Invalid start date format'),
  description: z.string().max(500, 'Description must be less than 500 characters').optional(),
  location: z.string().max(200, 'Location must be less than 200 characters').optional(),
  organizer: z.string().min(1, 'Organizer name is required').max(100),
  maxPlayers: z.number().min(4, 'Minimum 4 players required').max(200, 'Maximum 200 players allowed'),
  settings: TournamentSettingsSchema.partial().optional()
})

// Full Tournament Entity Schema
export const TournamentSchema = z.object({
  id: z.string().min(1, 'Tournament ID is required'),
  name: z.string().min(1, 'Tournament name is required').max(100),
  type: TournamentTypeSchema,
  status: TournamentStatusSchema,
  format: GameFormatSchema,
  maxPoints: z.number().min(1).max(21),
  shortForm: z.boolean(),
  startDate: z.string().datetime(),
  endDate: z.string().datetime().optional(),
  description: z.string().max(500).optional(),
  location: z.string().max(200).optional(),
  organizer: z.string().min(1).max(100),
  maxPlayers: z.number().min(4).max(200),
  currentPlayers: z.number().min(0),
  settings: TournamentSettingsSchema,
  stats: TournamentStatsSchema,
  createdAt: z.string().datetime(),
  updatedAt: z.string().datetime()
}).refine((data) => {
  // Ensure currentPlayers doesn't exceed maxPlayers
  return data.currentPlayers <= data.maxPlayers
}, {
  message: 'Current players cannot exceed maximum players',
  path: ['currentPlayers']
}).refine((data) => {
  // Ensure endDate is after startDate if provided
  if (data.endDate) {
    return new Date(data.endDate) > new Date(data.startDate)
  }
  return true
}, {
  message: 'End date must be after start date',
  path: ['endDate']
}).refine((data) => {
  // Ensure stats are consistent
  return data.stats.completedMatches <= data.stats.totalMatches
}, {
  message: 'Completed matches cannot exceed total matches',
  path: ['stats', 'completedMatches']
})

// Tournament Update Schema (for partial updates)
export const TournamentUpdateSchema = TournamentSchema.partial().omit({
  id: true,
  createdAt: true
}).extend({
  updatedAt: z.string().datetime()
})

// Tournament Filters Schema
export const TournamentFiltersSchema = z.object({
  status: TournamentStatusSchema.optional(),
  type: TournamentTypeSchema.optional(),
  format: GameFormatSchema.optional(),
  dateRange: z.object({
    start: z.string().datetime(),
    end: z.string().datetime()
  }).refine((data) => {
    return new Date(data.end) > new Date(data.start)
  }, {
    message: 'End date must be after start date'
  }).optional(),
  organizer: z.string().max(100).optional(),
  location: z.string().max(200).optional()
})

// Tournament Analytics Schema
export const PlayerDistributionStatsSchema = z.object({
  byClub: z.record(z.string(), z.number().min(0)),
  byRanking: z.record(z.string(), z.number().min(0)),
  byExperience: z.record(z.string(), z.number().min(0))
})

export const DurationStatsSchema = z.object({
  average: z.number().min(0),
  median: z.number().min(0),
  shortest: z.number().min(0),
  longest: z.number().min(0),
  distribution: z.record(z.string(), z.number().min(0))
})

export const ScoringPatternStatsSchema = z.object({
  averageGameScore: z.number().min(0).max(13),
  mostCommonScores: z.record(z.string(), z.number().min(0)),
  blowoutPercentage: z.number().min(0).max(100),
  closeGamePercentage: z.number().min(0).max(100)
})

export const CourtUtilizationStatsSchema = z.object({
  totalHours: z.number().min(0),
  utilizationRate: z.number().min(0).max(100),
  peakHours: z.array(z.string()),
  averageMatchesPerCourt: z.number().min(0)
})

export const TournamentAnalyticsSchema = z.object({
  playerDistribution: PlayerDistributionStatsSchema,
  matchDuration: DurationStatsSchema,
  scoringPatterns: ScoringPatternStatsSchema,
  courtUtilization: CourtUtilizationStatsSchema
})

// Inferred Types
export type TournamentFormData = z.infer<typeof TournamentFormDataSchema>
export type Tournament = z.infer<typeof TournamentSchema>
export type TournamentUpdate = z.infer<typeof TournamentUpdateSchema>
export type TournamentFilters = z.infer<typeof TournamentFiltersSchema>
export type TournamentAnalytics = z.infer<typeof TournamentAnalyticsSchema>
export type TournamentSettings = z.infer<typeof TournamentSettingsSchema>
export type TournamentStats = z.infer<typeof TournamentStatsSchema>

// Utility Functions
export const validateTournamentFormData = (data: unknown) => {
  return TournamentFormDataSchema.safeParse(data)
}

export const validateTournament = (data: unknown) => {
  return TournamentSchema.safeParse(data)
}

export const validateTournamentUpdate = (data: unknown) => {
  return TournamentUpdateSchema.safeParse(data)
}

export const validateTournamentFilters = (data: unknown) => {
  return TournamentFiltersSchema.safeParse(data)
}