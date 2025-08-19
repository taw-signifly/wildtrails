/**
 * Server Action Types for Tournament Management System
 */

import { Tournament, TournamentFormData, PaginatedResponse, TournamentFilters, Player, PlayerFormData, PlayerFilters, PlayerStats, Team, GameFormat, TeamStats } from '@/types'
import { PaginationParams } from '@/lib/api'
import { TeamFormData } from '@/lib/validation/player'

/**
 * Action result type for form handling
 * Used with React 19 form actions and useActionState
 */
export type ActionResult<T> = {
  success: true
  data: T
  message?: string
} | {
  success: false
  error: string
  fieldErrors?: Record<string, string[]>
}

/**
 * Server action with form data (for HTML forms)
 */
export type ServerAction<T> = (formData: FormData) => Promise<ActionResult<T>>

/**
 * Server action with typed data (for programmatic use)
 */
export type TypedAction<TInput, TOutput> = (input: TInput) => Promise<ActionResult<TOutput>>

/**
 * Tournament-specific action types
 */

// Tournament creation actions
export type CreateTournamentAction = ServerAction<Tournament>
export type CreateTournamentDataAction = TypedAction<TournamentFormData, Tournament>

// Tournament update actions
export type UpdateTournamentAction = (id: string, formData: FormData) => Promise<ActionResult<Tournament>>
export type UpdateTournamentDataAction = TypedAction<{ id: string; data: Partial<TournamentFormData> }, Tournament>

// Tournament deletion action
export type DeleteTournamentAction = TypedAction<string, { id: string; archived: boolean }>

// Tournament retrieval actions (these return Result<T,E> since they're not form actions)
export type GetTournamentsAction = (filters?: TournamentFilters & PaginationParams) => Promise<ActionResult<PaginatedResponse<Tournament>>>
export type GetTournamentByIdAction = (id: string) => Promise<ActionResult<Tournament>>
export type SearchTournamentsAction = (query: string, filters?: TournamentFilters) => Promise<ActionResult<Tournament[]>>

// Tournament management actions
export type StartTournamentAction = TypedAction<string, Tournament>
export type RegisterPlayerAction = TypedAction<{ tournamentId: string; playerId: string }, Tournament>
export type RemovePlayerAction = TypedAction<{ tournamentId: string; playerId: string }, Tournament>
export type CancelTournamentAction = TypedAction<string, Tournament>

/**
 * Player-specific action types
 */

// Player creation actions
export type CreatePlayerAction = ServerAction<Player>
export type CreatePlayerDataAction = TypedAction<PlayerFormData, Player>

// Player update actions
export type UpdatePlayerAction = (id: string, formData: FormData) => Promise<ActionResult<Player>>
export type UpdatePlayerDataAction = TypedAction<{ id: string; data: Partial<PlayerFormData> }, Player>

// Player deletion action
export type DeletePlayerAction = TypedAction<string, { id: string; archived: boolean }>

// Player retrieval actions
export type GetPlayersAction = (filters?: PlayerFilters & PaginationParams) => Promise<ActionResult<PaginatedResponse<Player>>>
export type GetPlayerByIdAction = (id: string) => Promise<ActionResult<Player>>
export type SearchPlayersAction = (query: string, filters?: PlayerFilters) => Promise<ActionResult<Player[]>>

// Player statistics actions
export type UpdatePlayerStatsAction = TypedAction<{ playerId: string; stats: Partial<PlayerStats> }, Player>
export type GetPlayerTournamentHistoryAction = (playerId: string, limit?: number) => Promise<ActionResult<unknown[]>>
export type GetPlayerPerformanceStatsAction = (playerId: string) => Promise<ActionResult<PlayerStats>>

/**
 * Team-specific action types
 */

// Team creation actions
export type CreateTeamAction = ServerAction<Team>
export type CreateTeamDataAction = TypedAction<TeamFormData, Team>

// Team update actions
export type UpdateTeamAction = (id: string, formData: FormData) => Promise<ActionResult<Team>>
export type UpdateTeamDataAction = TypedAction<{ id: string; data: Partial<TeamFormData> }, Team>

// Team deletion action
export type DeleteTeamAction = TypedAction<string, { id: string; archived: boolean }>

// Team retrieval actions
export interface TeamFilters {
  tournamentId?: string
  bracketType?: Team['bracketType']
}
export type GetTeamsAction = (filters?: TeamFilters & PaginationParams) => Promise<ActionResult<PaginatedResponse<Team>>>
export type GetTeamByIdAction = (id: string) => Promise<ActionResult<Team>>
export type GetTeamsByTournamentAction = (tournamentId: string) => Promise<ActionResult<Team[]>>

// Team member management actions
export type AddPlayerToTeamAction = TypedAction<{ teamId: string; playerId: string }, Team>
export type RemovePlayerFromTeamAction = TypedAction<{ teamId: string; playerId: string }, Team>
export type ValidateTeamFormationAction = TypedAction<{ players: string[]; format: GameFormat }, boolean>

// Team statistics actions
export type UpdateTeamStatsAction = TypedAction<{ teamId: string; stats: Partial<TeamStats> }, Team>

/**
 * Form data validation helpers
 */
export interface FormDataValidation<T> {
  success: boolean
  data?: T
  fieldErrors?: Record<string, string[]>
  error?: string
}

/**
 * Action state for useActionState hook
 */
export type ActionState<T> = {
  data?: T
  error?: string
  fieldErrors?: Record<string, string[]>
  message?: string
} | null

/**
 * Tournament form field names (for form validation)
 */
export const TOURNAMENT_FORM_FIELDS = {
  NAME: 'name',
  TYPE: 'type',
  FORMAT: 'format',
  MAX_POINTS: 'maxPoints',
  SHORT_FORM: 'shortForm',
  START_DATE: 'startDate',
  DESCRIPTION: 'description',
  LOCATION: 'location',
  ORGANIZER: 'organizer',
  MAX_PLAYERS: 'maxPlayers',
  ALLOW_LATE_REGISTRATION: 'settings.allowLateRegistration',
  AUTOMATIC_BRACKET_GENERATION: 'settings.automaticBracketGeneration',
  REQUIRE_CHECKIN: 'settings.requireCheckin',
  COURT_ASSIGNMENT_MODE: 'settings.courtAssignmentMode',
  SCORING_MODE: 'settings.scoringMode',
  REAL_TIME_UPDATES: 'settings.realTimeUpdates',
  ALLOW_SPECTATORS: 'settings.allowSpectators'
} as const

/**
 * Action error types
 */
export type ActionError = 
  | 'VALIDATION_ERROR'
  | 'NOT_FOUND'
  | 'CONFLICT'
  | 'UNAUTHORIZED'
  | 'INTERNAL_ERROR'

/**
 * Enhanced ActionResult with error types
 */
export type TypedActionResult<T> = {
  success: true
  data: T
  message?: string
} | {
  success: false
  error: string
  errorType: ActionError
  fieldErrors?: Record<string, string[]>
}