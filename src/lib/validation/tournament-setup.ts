import { z } from 'zod'
import { TournamentTypeSchema, GameFormatSchema, TournamentSettingsSchema } from './tournament'

// Step 1: Basic Information
export const BasicInformationSchema = z.object({
  name: z.string().min(1, 'Tournament name is required').max(100, 'Tournament name must be less than 100 characters'),
  description: z.string().max(500, 'Description must be less than 500 characters').optional(),
  type: TournamentTypeSchema,
  format: GameFormatSchema,
  startDate: z.string().datetime('Invalid start date format'),
  location: z.string().max(200, 'Location must be less than 200 characters').optional(),
  organizer: z.string().min(1, 'Organizer name is required').max(100),
})

// Step 2: Tournament Settings
export const TournamentSettingsFormSchema = z.object({
  maxPoints: z.number().min(1).max(21).default(13),
  shortForm: z.boolean().default(false),
  maxPlayers: z.number().min(4, 'Minimum 4 players required').max(200, 'Maximum 200 players allowed'),
  settings: TournamentSettingsSchema.partial().optional()
})

// Step 3: Player Registration (basic structure)
export const PlayerEntrySchema = z.object({
  firstName: z.string().min(1, 'First name is required').max(50),
  lastName: z.string().min(1, 'Last name is required').max(50),
  email: z.string().email('Invalid email address'),
  phone: z.string().optional(),
  club: z.string().optional(),
  ranking: z.number().min(1).max(1000).optional(),
})

export const PlayerRegistrationSchema = z.object({
  players: z.array(PlayerEntrySchema).min(4, 'Minimum 4 players required'),
  teams: z.array(z.object({
    id: z.string(),
    name: z.string(),
    players: z.array(z.string()), // player IDs
  })).optional(),
})

// Step 4: Bracket Configuration
export const BracketConfigurationSchema = z.object({
  seedingType: z.enum(['random', 'ranked', 'manual']).default('random'),
  allowByes: z.boolean().default(true),
  courtAssignments: z.array(z.object({
    courtId: z.string(),
    courtName: z.string(),
    available: z.boolean(),
  })).optional(),
})

// Complete Setup Schema
export const TournamentSetupSchema = BasicInformationSchema
  .merge(TournamentSettingsFormSchema)
  .merge(PlayerRegistrationSchema)
  .merge(BracketConfigurationSchema)
  .refine((data) => {
    // Ensure format requirements are met
    const playersPerTeam = data.format === 'singles' ? 1 : data.format === 'doubles' ? 2 : 3
    const minPlayers = playersPerTeam * 4 // At least 4 teams
    return data.players.length >= minPlayers
  }, {
    message: 'Not enough players for selected format',
    path: ['players']
  })
  .refine((data) => {
    // Validate teams if provided
    if (data.teams && data.teams.length > 0) {
      const playersPerTeam = data.format === 'singles' ? 1 : data.format === 'doubles' ? 2 : 3
      return data.teams.every(team => team.players.length === playersPerTeam)
    }
    return true
  }, {
    message: 'Teams must have correct number of players for format',
    path: ['teams']
  })

// Wizard Step State
export const WizardStepSchema = z.enum(['basic', 'settings', 'players', 'bracket', 'review'])

// Inferred Types
export type BasicInformation = z.infer<typeof BasicInformationSchema>
export type TournamentSettingsForm = z.infer<typeof TournamentSettingsFormSchema>
export type PlayerEntry = z.infer<typeof PlayerEntrySchema>
export type PlayerRegistration = z.infer<typeof PlayerRegistrationSchema>
export type BracketConfiguration = z.infer<typeof BracketConfigurationSchema>
export type TournamentSetupData = z.infer<typeof TournamentSetupSchema>
export type WizardStep = z.infer<typeof WizardStepSchema>

// Utility Functions
export const validateBasicInformation = (data: unknown) => {
  return BasicInformationSchema.safeParse(data)
}

export const validateTournamentSettings = (data: unknown) => {
  return TournamentSettingsFormSchema.safeParse(data)
}

export const validatePlayerRegistration = (data: unknown) => {
  return PlayerRegistrationSchema.safeParse(data)
}

export const validateBracketConfiguration = (data: unknown) => {
  return BracketConfigurationSchema.safeParse(data)
}

export const validateCompleteSetup = (data: unknown) => {
  return TournamentSetupSchema.safeParse(data)
}