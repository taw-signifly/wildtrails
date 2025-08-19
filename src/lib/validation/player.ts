import { z } from 'zod'
import { GameFormatSchema } from './tournament'

// Player Statistics Schema
export const PlayerStatsSchema = z.object({
  tournamentsPlayed: z.number().min(0),
  tournamentsWon: z.number().min(0),
  matchesPlayed: z.number().min(0),
  matchesWon: z.number().min(0),
  winPercentage: z.number().min(0).max(100),
  averagePointsFor: z.number().min(0),
  averagePointsAgainst: z.number().min(0),
  pointsDifferential: z.number(),
  bestFinish: z.string().max(50),
  recentForm: z.array(z.number().min(0).max(1)).max(5) // Last 5 match results (1 win, 0 loss)
}).refine((data) => {
  // Ensure tournaments won doesn't exceed tournaments played
  return data.tournamentsWon <= data.tournamentsPlayed
}, {
  message: 'Tournaments won cannot exceed tournaments played',
  path: ['tournamentsWon']
}).refine((data) => {
  // Ensure matches won doesn't exceed matches played
  return data.matchesWon <= data.matchesPlayed
}, {
  message: 'Matches won cannot exceed matches played',
  path: ['matchesWon']
}).refine((data) => {
  // Validate win percentage calculation
  if (data.matchesPlayed > 0) {
    const expectedWinPercentage = (data.matchesWon / data.matchesPlayed) * 100
    // Allow for small floating point discrepancies
    return Math.abs(data.winPercentage - expectedWinPercentage) < 0.1
  }
  return data.winPercentage === 0
}, {
  message: 'Win percentage must match calculated value from matches played/won',
  path: ['winPercentage']
})

// Player Preferences Schema
export const PlayerPreferencesSchema = z.object({
  preferredFormat: GameFormatSchema,
  notificationEmail: z.boolean().default(true),
  notificationPush: z.boolean().default(true),
  publicProfile: z.boolean().default(true)
})

// Player Form Data Schema (for creating/updating players)
export const PlayerFormDataSchema = z.object({
  firstName: z.string().min(1, 'First name is required').max(50, 'First name must be less than 50 characters')
    .regex(/^[a-zA-ZÀ-ÿ\s'-]+$/, 'First name can only contain letters, spaces, hyphens, and apostrophes'),
  lastName: z.string().min(1, 'Last name is required').max(50, 'Last name must be less than 50 characters')
    .regex(/^[a-zA-ZÀ-ÿ\s'-]+$/, 'Last name can only contain letters, spaces, hyphens, and apostrophes'),
  email: z.string().email('Invalid email address').max(255),
  phone: z.string()
    .regex(/^[\+]?[1-9][\d]{0,15}$/, 'Invalid phone number format')
    .optional()
    .or(z.literal('')),
  club: z.string().max(100, 'Club name must be less than 100 characters').optional().or(z.literal('')),
  ranking: z.number().int().min(1).max(10000, 'Ranking must be between 1 and 10000').optional()
})

// Full Player Entity Schema
export const PlayerSchema = z.object({
  id: z.string().min(1, 'Player ID is required'),
  firstName: z.string().min(1).max(50)
    .regex(/^[a-zA-ZÀ-ÿ\s'-]+$/, 'First name can only contain letters, spaces, hyphens, and apostrophes'),
  lastName: z.string().min(1).max(50)
    .regex(/^[a-zA-ZÀ-ÿ\s'-]+$/, 'Last name can only contain letters, spaces, hyphens, and apostrophes'),
  displayName: z.string().min(1).max(100),
  email: z.string().email().max(255),
  phone: z.string()
    .regex(/^[\+]?[1-9][\d]{0,15}$/, 'Invalid phone number format')
    .optional(),
  club: z.string().max(100).optional(),
  ranking: z.number().int().min(1).max(10000).optional(),
  handicap: z.number().min(-10).max(10).optional(), // Typical handicap range
  avatar: z.string().url('Invalid avatar URL').optional(),
  stats: PlayerStatsSchema,
  preferences: PlayerPreferencesSchema,
  createdAt: z.string().datetime(),
  updatedAt: z.string().datetime()
}).refine((data) => {
  // Ensure displayName is derived from firstName and lastName if not explicitly set
  const expectedDisplayName = `${data.firstName} ${data.lastName}`
  return data.displayName === expectedDisplayName || data.displayName.length > 0
}, {
  message: 'Display name must be valid',
  path: ['displayName']
})

// Player Update Schema (for partial updates)
export const PlayerUpdateSchema = PlayerSchema.partial().omit({
  id: true,
  createdAt: true
}).extend({
  updatedAt: z.string().datetime()
})

// Player Filters Schema
export const PlayerFiltersSchema = z.object({
  club: z.string().max(100).optional(),
  ranking: z.object({
    min: z.number().int().min(1),
    max: z.number().int().max(10000)
  }).refine((data) => {
    return data.min <= data.max
  }, {
    message: 'Minimum ranking must be less than or equal to maximum ranking'
  }).optional(),
  winPercentage: z.object({
    min: z.number().min(0).max(100),
    max: z.number().min(0).max(100)
  }).refine((data) => {
    return data.min <= data.max
  }, {
    message: 'Minimum win percentage must be less than or equal to maximum win percentage'
  }).optional()
})

// Team-related schemas (since teams are collections of players)
export const BracketTypeSchema = z.enum(['winner', 'loser', 'consolation'])

// Team Form Data Schema (for creating/updating teams)
export const TeamFormDataSchema = z.object({
  name: z.string().min(1, 'Team name is required').max(100, 'Team name must be less than 100 characters'),
  players: z.array(z.string().min(1, 'Player ID is required')).min(1, 'Team must have at least one player').max(3, 'Team cannot have more than 3 players'),
  tournamentId: z.string().min(1, 'Tournament ID is required')
})

export const TeamStatsSchema = z.object({
  matchesPlayed: z.number().min(0),
  matchesWon: z.number().min(0),
  setsWon: z.number().min(0),
  setsLost: z.number().min(0),
  pointsFor: z.number().min(0),
  pointsAgainst: z.number().min(0),
  pointsDifferential: z.number(),
  averagePointsDifferential: z.number(),
  currentStreak: z.number(),
  longestStreak: z.number().min(0)
}).refine((data) => {
  // Ensure matches won doesn't exceed matches played
  return data.matchesWon <= data.matchesPlayed
}, {
  message: 'Matches won cannot exceed matches played',
  path: ['matchesWon']
}).refine((data) => {
  // Ensure points differential is calculated correctly
  return data.pointsDifferential === data.pointsFor - data.pointsAgainst
}, {
  message: 'Points differential must equal points for minus points against',
  path: ['pointsDifferential']
})

export const TeamSchema = z.object({
  id: z.string().min(1),
  name: z.string().min(1, 'Team name is required').max(100),
  players: z.array(PlayerSchema).min(1, 'Team must have at least one player').max(3, 'Team cannot have more than 3 players'),
  tournamentId: z.string().min(1),
  seed: z.number().int().min(1).optional(),
  bracketType: BracketTypeSchema,
  stats: TeamStatsSchema,
  createdAt: z.string().datetime(),
  updatedAt: z.string().datetime()
}).refine((data) => {
  // Validate team composition based on game format
  const playerCount = data.players.length
  // This validation could be enhanced with tournament format checking
  return playerCount >= 1 && playerCount <= 3
}, {
  message: 'Invalid team composition for game format',
  path: ['players']
})

// Inferred Types
export type PlayerFormData = z.infer<typeof PlayerFormDataSchema>
export type Player = z.infer<typeof PlayerSchema>
export type PlayerUpdate = z.infer<typeof PlayerUpdateSchema>
export type PlayerFilters = z.infer<typeof PlayerFiltersSchema>
export type PlayerStats = z.infer<typeof PlayerStatsSchema>
export type PlayerPreferences = z.infer<typeof PlayerPreferencesSchema>
export type Team = z.infer<typeof TeamSchema>
export type TeamStats = z.infer<typeof TeamStatsSchema>
export type TeamFormData = z.infer<typeof TeamFormDataSchema>

// Utility Functions
export const validatePlayerFormData = (data: unknown) => {
  return PlayerFormDataSchema.safeParse(data)
}

export const validatePlayer = (data: unknown) => {
  return PlayerSchema.safeParse(data)
}

export const validatePlayerUpdate = (data: unknown) => {
  return PlayerUpdateSchema.safeParse(data)
}

export const validatePlayerFilters = (data: unknown) => {
  return PlayerFiltersSchema.safeParse(data)
}

export const validateTeam = (data: unknown) => {
  return TeamSchema.safeParse(data)
}

export const validateTeamFormData = (data: unknown) => {
  return TeamFormDataSchema.safeParse(data)
}

// Helper function to create display name
export const createDisplayName = (firstName: string, lastName: string): string => {
  return `${firstName.trim()} ${lastName.trim()}`
}

// Helper function to calculate win percentage
export const calculateWinPercentage = (matchesWon: number, matchesPlayed: number): number => {
  if (matchesPlayed === 0) return 0
  return Math.round((matchesWon / matchesPlayed) * 100 * 100) / 100 // Round to 2 decimal places
}