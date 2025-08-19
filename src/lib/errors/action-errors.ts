/**
 * Standardized error types and codes for server actions
 */

export enum PlayerActionError {
  EMAIL_EXISTS = 'EMAIL_EXISTS',
  PLAYER_NOT_FOUND = 'PLAYER_NOT_FOUND',
  VALIDATION_ERROR = 'VALIDATION_ERROR',
  DATABASE_ERROR = 'DATABASE_ERROR',
  UNAUTHORIZED = 'UNAUTHORIZED'
}

export enum TeamActionError {
  TEAM_NAME_EXISTS = 'TEAM_NAME_EXISTS',
  TEAM_NOT_FOUND = 'TEAM_NOT_FOUND',
  PLAYER_ALREADY_IN_TEAM = 'PLAYER_ALREADY_IN_TEAM',
  INVALID_TEAM_FORMAT = 'INVALID_TEAM_FORMAT',
  VALIDATION_ERROR = 'VALIDATION_ERROR',
  DATABASE_ERROR = 'DATABASE_ERROR',
  UNAUTHORIZED = 'UNAUTHORIZED'
}

export enum TournamentActionError {
  TOURNAMENT_NOT_FOUND = 'TOURNAMENT_NOT_FOUND',
  TOURNAMENT_NAME_EXISTS = 'TOURNAMENT_NAME_EXISTS',
  TOURNAMENT_FULL = 'TOURNAMENT_FULL',
  TOURNAMENT_ALREADY_STARTED = 'TOURNAMENT_ALREADY_STARTED',
  VALIDATION_ERROR = 'VALIDATION_ERROR',
  DATABASE_ERROR = 'DATABASE_ERROR',
  UNAUTHORIZED = 'UNAUTHORIZED'
}

export interface ActionError {
  code: PlayerActionError | TeamActionError | TournamentActionError
  message: string
  details?: Record<string, unknown>
  fieldErrors?: Record<string, string[]>
}

/**
 * Create standardized error responses
 */
export function createActionError(
  code: PlayerActionError | TeamActionError | TournamentActionError,
  message: string,
  details?: Record<string, unknown>,
  fieldErrors?: Record<string, string[]>
): ActionError {
  return {
    code,
    message,
    details,
    fieldErrors
  }
}

/**
 * Standard error messages for common scenarios
 */
export const ERROR_MESSAGES = {
  // Player errors
  EMAIL_EXISTS: 'A player with this email already exists',
  PLAYER_NOT_FOUND: 'Player not found',
  PLAYER_VALIDATION_FAILED: 'Player data validation failed',
  
  // Team errors
  TEAM_NAME_EXISTS: 'A team with this name already exists in this tournament',
  TEAM_NOT_FOUND: 'Team not found',
  PLAYER_ALREADY_IN_TEAM: 'One or more players are already in a team for this tournament',
  INVALID_TEAM_FORMAT: 'Invalid team format for the selected game type',
  TEAM_VALIDATION_FAILED: 'Team data validation failed',
  
  // Tournament errors
  TOURNAMENT_NOT_FOUND: 'Tournament not found',
  TOURNAMENT_NAME_EXISTS: 'A tournament with this name already exists',
  TOURNAMENT_FULL: 'Tournament is full',
  TOURNAMENT_ALREADY_STARTED: 'Tournament has already started',
  TOURNAMENT_VALIDATION_FAILED: 'Tournament data validation failed',
  
  // General errors
  DATABASE_ERROR: 'A database error occurred',
  VALIDATION_ERROR: 'Input validation failed',
  UNAUTHORIZED: 'You are not authorized to perform this action',
  UNEXPECTED_ERROR: 'An unexpected error occurred'
} as const

/**
 * Helper to create player action errors
 */
export function createPlayerError(
  code: PlayerActionError,
  customMessage?: string,
  fieldErrors?: Record<string, string[]>
): ActionError {
  const message = customMessage || getDefaultMessage(code)
  return createActionError(code, message, undefined, fieldErrors)
}

/**
 * Helper to create team action errors
 */
export function createTeamError(
  code: TeamActionError,
  customMessage?: string,
  fieldErrors?: Record<string, string[]>
): ActionError {
  const message = customMessage || getDefaultMessage(code)
  return createActionError(code, message, undefined, fieldErrors)
}

/**
 * Helper to create tournament action errors
 */
export function createTournamentError(
  code: TournamentActionError,
  customMessage?: string,
  fieldErrors?: Record<string, string[]>
): ActionError {
  const message = customMessage || getDefaultMessage(code)
  return createActionError(code, message, undefined, fieldErrors)
}

function getDefaultMessage(code: string): string {
  switch (code) {
    case PlayerActionError.EMAIL_EXISTS:
      return ERROR_MESSAGES.EMAIL_EXISTS
    case PlayerActionError.PLAYER_NOT_FOUND:
      return ERROR_MESSAGES.PLAYER_NOT_FOUND
    case PlayerActionError.VALIDATION_ERROR:
      return ERROR_MESSAGES.PLAYER_VALIDATION_FAILED
    case TeamActionError.TEAM_NAME_EXISTS:
      return ERROR_MESSAGES.TEAM_NAME_EXISTS
    case TeamActionError.TEAM_NOT_FOUND:
      return ERROR_MESSAGES.TEAM_NOT_FOUND
    case TeamActionError.PLAYER_ALREADY_IN_TEAM:
      return ERROR_MESSAGES.PLAYER_ALREADY_IN_TEAM
    case TeamActionError.INVALID_TEAM_FORMAT:
      return ERROR_MESSAGES.INVALID_TEAM_FORMAT
    case TeamActionError.VALIDATION_ERROR:
      return ERROR_MESSAGES.TEAM_VALIDATION_FAILED
    case TournamentActionError.TOURNAMENT_NOT_FOUND:
      return ERROR_MESSAGES.TOURNAMENT_NOT_FOUND
    case TournamentActionError.TOURNAMENT_NAME_EXISTS:
      return ERROR_MESSAGES.TOURNAMENT_NAME_EXISTS
    case TournamentActionError.TOURNAMENT_FULL:
      return ERROR_MESSAGES.TOURNAMENT_FULL
    case TournamentActionError.TOURNAMENT_ALREADY_STARTED:
      return ERROR_MESSAGES.TOURNAMENT_ALREADY_STARTED
    case TournamentActionError.VALIDATION_ERROR:
      return ERROR_MESSAGES.TOURNAMENT_VALIDATION_FAILED
    default:
      return ERROR_MESSAGES.UNEXPECTED_ERROR
  }
}