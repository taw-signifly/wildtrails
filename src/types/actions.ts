/**
 * Server Action Types for Tournament Management System
 */

import { Tournament, TournamentFormData, PaginatedResponse, TournamentFilters } from '@/types'
import { PaginationParams } from '@/lib/api'

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