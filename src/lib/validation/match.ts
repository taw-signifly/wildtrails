import { z } from 'zod'
import { BracketTypeSchema, TeamSchema } from './player'

// Match Status Enum
export const MatchStatusSchema = z.enum([
  'scheduled',
  'active', 
  'completed',
  'cancelled'
])

// Position Schema (for boule and jack positions)
export const PositionSchema = z.object({
  x: z.number().min(0, 'X coordinate must be positive'), // meters from baseline
  y: z.number().min(0, 'Y coordinate must be positive')  // meters from left sideline
})

// Score Schema with Petanque validation rules
export const ScoreSchema = z.object({
  team1: z.number().int().min(0, 'Score cannot be negative').max(13, 'Maximum score is 13 in Petanque'),
  team2: z.number().int().min(0, 'Score cannot be negative').max(13, 'Maximum score is 13 in Petanque'),
  isComplete: z.boolean()
}).refine((data) => {
  // Petanque rule: Game ends when one team reaches 13 points
  if (data.isComplete) {
    return data.team1 === 13 || data.team2 === 13
  }
  // If not complete, neither team should have 13 points
  return data.team1 < 13 && data.team2 < 13
}, {
  message: 'Game must end when one team reaches 13 points',
  path: ['isComplete']
}).refine((data) => {
  // Both teams cannot have 13 points
  return !(data.team1 === 13 && data.team2 === 13)
}, {
  message: 'Both teams cannot have maximum score',
  path: ['team1', 'team2']
})

// Boule Schema
export const BouleSchema = z.object({
  id: z.string().min(1),
  teamId: z.string().min(1),
  playerId: z.string().min(1),
  position: PositionSchema,
  distance: z.number().min(0), // distance from jack in cm
  order: z.number().int().min(1) // throwing order
})

// End Schema (individual ends in a match)
export const EndSchema = z.object({
  id: z.string().min(1),
  endNumber: z.number().int().min(1),
  jackPosition: PositionSchema,
  boules: z.array(BouleSchema).max(12), // Maximum 6 boules per team
  winner: z.string().min(1), // team ID
  points: z.number().int().min(1).max(6), // Maximum points per end is typically 6
  duration: z.number().int().min(0).optional(), // seconds
  completed: z.boolean(),
  createdAt: z.string().datetime()
}).refine((data) => {
  // Validate boules count (max 6 per team, total 12)
  const teamCounts: { [teamId: string]: number } = {}
  data.boules.forEach(boule => {
    teamCounts[boule.teamId] = (teamCounts[boule.teamId] || 0) + 1
  })
  
  // Each team should have at most 6 boules
  return Object.values(teamCounts).every(count => count <= 6)
}, {
  message: 'Each team can have at most 6 boules per end',
  path: ['boules']
}).refine((data) => {
  // Winner must be one of the teams that played boules
  if (data.boules.length > 0) {
    const teamIds = [...new Set(data.boules.map(b => b.teamId))]
    return teamIds.includes(data.winner)
  }
  return true
}, {
  message: 'Winner must be one of the teams that played in this end',
  path: ['winner']
})

// Match Form Data Schema (for score updates)
export const MatchFormDataSchema = z.object({
  team1Score: z.number().int().min(0).max(13),
  team2Score: z.number().int().min(0).max(13),
  endScores: z.array(z.object({
    endNumber: z.number().int().min(1),
    team1Points: z.number().int().min(0).max(6),
    team2Points: z.number().int().min(0).max(6),
    jackPosition: PositionSchema.optional(),
    boules: z.array(BouleSchema.omit({ id: true })).optional()
  })).optional()
})

// Full Match Entity Schema
export const MatchSchema = z.object({
  id: z.string().min(1),
  tournamentId: z.string().min(1),
  round: z.number().int().min(1),
  roundName: z.string().min(1), // "Round 1", "Quarterfinals", "Final", etc.
  bracketType: BracketTypeSchema,
  team1: TeamSchema,
  team2: TeamSchema,
  courtId: z.string().min(1).optional(),
  score: ScoreSchema,
  status: MatchStatusSchema,
  scheduledTime: z.string().datetime().optional(),
  startTime: z.string().datetime().optional(),
  endTime: z.string().datetime().optional(),
  duration: z.number().int().min(0).optional(), // minutes
  winner: z.string().min(1).optional(), // team ID
  ends: z.array(EndSchema),
  notes: z.string().max(500).optional(),
  referee: z.string().max(100).optional(),
  createdAt: z.string().datetime(),
  updatedAt: z.string().datetime()
}).refine((data) => {
  // If match is completed, there must be a winner
  if (data.status === 'completed') {
    return data.winner !== undefined && data.score.isComplete
  }
  return true
}, {
  message: 'Completed matches must have a winner and complete score',
  path: ['winner']
}).refine((data) => {
  // Winner must be one of the participating teams
  if (data.winner) {
    return data.winner === data.team1.id || data.winner === data.team2.id
  }
  return true
}, {
  message: 'Winner must be one of the participating teams',
  path: ['winner']
}).refine((data) => {
  // Start time must be before end time
  if (data.startTime && data.endTime) {
    return new Date(data.startTime) < new Date(data.endTime)
  }
  return true
}, {
  message: 'Start time must be before end time',
  path: ['endTime']
}).refine((data) => {
  // Scheduled time should be before or equal to start time
  if (data.scheduledTime && data.startTime) {
    return new Date(data.scheduledTime) <= new Date(data.startTime)
  }
  return true
}, {
  message: 'Start time cannot be before scheduled time',
  path: ['startTime']
}).refine((data) => {
  // Validate that score matches the sum of ends
  const team1EndPoints = data.ends.filter(end => end.winner === data.team1.id).reduce((sum, end) => sum + end.points, 0)
  const team2EndPoints = data.ends.filter(end => end.winner === data.team2.id).reduce((sum, end) => sum + end.points, 0)
  
  return data.score.team1 === team1EndPoints && data.score.team2 === team2EndPoints
}, {
  message: 'Match score must equal the sum of end points',
  path: ['score']
})

// Match Update Schema (for partial updates)
export const MatchUpdateSchema = MatchSchema.partial().omit({
  id: true,
  tournamentId: true,
  createdAt: true
}).extend({
  updatedAt: z.string().datetime()
})

// Match Filters Schema
export const MatchFiltersSchema = z.object({
  status: MatchStatusSchema.optional(),
  round: z.number().int().min(1).optional(),
  bracketType: BracketTypeSchema.optional(),
  courtId: z.string().min(1).optional(),
  dateRange: z.object({
    start: z.string().datetime(),
    end: z.string().datetime()
  }).refine((data) => {
    return new Date(data.end) > new Date(data.start)
  }, {
    message: 'End date must be after start date'
  }).optional()
})

// Court Schema (related to matches)
export const CourtDimensionsSchema = z.object({
  length: z.number().min(12).max(15), // Standard petanque court length
  width: z.number().min(3).max(5),    // Standard petanque court width
  throwingDistance: z.number().min(6).max(10) // Standard throwing distance
})

export const CourtSchema = z.object({
  id: z.string().min(1),
  name: z.string().min(1).max(100),
  location: z.string().max(200),
  dimensions: CourtDimensionsSchema,
  surface: z.enum(['gravel', 'sand', 'dirt', 'artificial']),
  lighting: z.boolean(),
  covered: z.boolean(),
  status: z.enum(['available', 'in-use', 'maintenance', 'reserved']),
  currentMatch: z.string().min(1).optional(), // match ID
  nextMatch: z.string().min(1).optional(),    // match ID
  amenities: z.array(z.string().max(50)).max(20),
  createdAt: z.string().datetime(),
  updatedAt: z.string().datetime()
})

// Real-time Event Schemas
export const ScoreUpdateDataSchema = z.object({
  matchId: z.string().min(1),
  score: ScoreSchema,
  timestamp: z.string().datetime()
})

export const MatchCompleteDataSchema = z.object({
  matchId: z.string().min(1),
  winner: z.string().min(1),
  finalScore: ScoreSchema,
  duration: z.number().int().min(0),
  timestamp: z.string().datetime()
})

// Inferred Types
export type MatchFormData = z.infer<typeof MatchFormDataSchema>
export type Match = z.infer<typeof MatchSchema>
export type MatchUpdate = z.infer<typeof MatchUpdateSchema>
export type MatchFilters = z.infer<typeof MatchFiltersSchema>
export type Score = z.infer<typeof ScoreSchema>
export type End = z.infer<typeof EndSchema>
export type Boule = z.infer<typeof BouleSchema>
export type Position = z.infer<typeof PositionSchema>
export type Court = z.infer<typeof CourtSchema>
export type ScoreUpdateData = z.infer<typeof ScoreUpdateDataSchema>
export type MatchCompleteData = z.infer<typeof MatchCompleteDataSchema>

// Utility Functions
export const validateMatchFormData = (data: unknown) => {
  return MatchFormDataSchema.safeParse(data)
}

export const validateMatch = (data: unknown) => {
  return MatchSchema.safeParse(data)
}

export const validateMatchUpdate = (data: unknown) => {
  return MatchUpdateSchema.safeParse(data)
}

export const validateMatchFilters = (data: unknown) => {
  return MatchFiltersSchema.safeParse(data)
}

export const validateScore = (data: unknown) => {
  return ScoreSchema.safeParse(data)
}

export const validateEnd = (data: unknown) => {
  return EndSchema.safeParse(data)
}

export const validateCourt = (data: unknown) => {
  return CourtSchema.safeParse(data)
}

// Helper Functions for Petanque Rules
export const isValidPetanqueScore = (score1: number, score2: number): boolean => {
  // Game ends at 13 points, both teams cannot have 13
  if (score1 === 13 && score2 === 13) return false
  if (score1 > 13 || score2 > 13) return false
  if (score1 < 0 || score2 < 0) return false
  return true
}

export const isGameComplete = (score1: number, score2: number): boolean => {
  return score1 === 13 || score2 === 13
}

export const getMatchWinner = (score: Score): string | null => {
  if (!score.isComplete) return null
  if (score.team1 === 13) return 'team1'
  if (score.team2 === 13) return 'team2'
  return null
}

export const calculateMatchDuration = (startTime: string, endTime: string): number => {
  const start = new Date(startTime).getTime()
  const end = new Date(endTime).getTime()
  return Math.round((end - start) / (1000 * 60)) // Return duration in minutes
}