/**
 * API Utilities - Centralized exports for Tournament Management API
 */

// Response utilities
export {
  HTTP_STATUS,
  createSuccessResponse,
  createErrorResponse,
  createPaginatedResponse,
  createValidationError,
  createNotFoundError,
  createConflictError,
  createInternalServerError,
  handleDatabaseResult,
  handleCreateResult,
  handleUpdateResult,
  handleDeleteResult
} from './response'

// Pagination utilities
export {
  PAGINATION_DEFAULTS,
  parsePaginationParams,
  calculatePaginationInfo,
  calculateOffset,
  paginateArray,
  validatePaginationParams,
  createPaginationHeaders
} from './pagination'
export type { PaginationParams, PaginationInfo } from './pagination'

// Validation utilities
export {
  validateRequestBody,
  validateSearchParams,
  validateRouteParam,
  TournamentIdSchema,
  PlayerIdSchema,
  TournamentFiltersSchema,
  PlayerRegistrationSchema,
  withValidation,
  sanitizeString,
  sanitizeTournamentData
} from './validation'
export type { ValidationResult } from './validation'

// Middleware utilities
export {
  addCorsHeaders,
  handleCorsOptions,
  validateHttpMethod,
  validateContentType,
  validateRequestSize,
  applyRateLimit,
  addRateLimitHeaders,
  withErrorHandling,
  applyCommonMiddleware,
  createApiHandler
} from './middleware'

// Action utilities
export {
  resultToActionResult,
  parseFormDataField,
  parseFormDataBoolean,
  parseFormDataNumber,
  parseFormDataDate,
  formatZodErrors,
  isValidTournamentType,
  isValidGameFormat,
  isValidCourtAssignmentMode,
  isValidScoringMode
} from './action-utils'