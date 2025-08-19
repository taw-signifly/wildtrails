/**
 * Validation Schemas for WildTrails Petanque Tournament Management System
 * 
 * This module provides comprehensive Zod validation schemas for all data models
 * used throughout the application, ensuring type safety and data integrity.
 */

// Re-export all schemas and types from individual modules
export * from './tournament'
export * from './player' 
export * from './match'
export * from './common'

// Import schemas for organized re-export
import {
  TournamentSchema,
  TournamentFormDataSchema,
  TournamentUpdateSchema,
  TournamentFiltersSchema,
  TournamentAnalyticsSchema,
  validateTournamentFormData,
  validateTournament,
  validateTournamentUpdate,
  validateTournamentFilters
} from './tournament'

import {
  PlayerSchema,
  PlayerFormDataSchema,
  PlayerUpdateSchema,
  PlayerFiltersSchema,
  TeamSchema,
  validatePlayerFormData,
  validatePlayer,
  validatePlayerUpdate,
  validatePlayerFilters,
  validateTeam
} from './player'

import {
  MatchSchema,
  MatchFormDataSchema,
  MatchUpdateSchema,
  MatchFiltersSchema,
  ScoreSchema,
  EndSchema,
  CourtSchema,
  validateMatchFormData,
  validateMatch,
  validateMatchUpdate,
  validateMatchFilters,
  validateScore,
  validateEnd,
  validateCourt
} from './match'

import {
  BracketSchema,
  StandingSchema,
  TournamentUpdateEventSchema,
  MatchUpdateEventSchema,
  APIResponseSchema,
  PaginatedResponseSchema,
  validateBracket,
  validateStanding,
  validateTournamentUpdateEvent,
  validateMatchUpdateEvent,
  createAPIResponseValidator,
  createPaginatedResponseValidator
} from './common'

// Organized exports by category
export const schemas = {
  // Tournament schemas
  tournament: {
    entity: TournamentSchema,
    formData: TournamentFormDataSchema,
    update: TournamentUpdateSchema,
    filters: TournamentFiltersSchema,
    analytics: TournamentAnalyticsSchema
  },
  
  // Player schemas
  player: {
    entity: PlayerSchema,
    formData: PlayerFormDataSchema,
    update: PlayerUpdateSchema,
    filters: PlayerFiltersSchema
  },
  
  // Team schemas
  team: {
    entity: TeamSchema
  },
  
  // Match schemas
  match: {
    entity: MatchSchema,
    formData: MatchFormDataSchema,
    update: MatchUpdateSchema,
    filters: MatchFiltersSchema,
    score: ScoreSchema,
    end: EndSchema
  },
  
  // Court schemas
  court: {
    entity: CourtSchema
  },
  
  // Bracket schemas
  bracket: {
    entity: BracketSchema
  },
  
  // Standing schemas
  standing: {
    entity: StandingSchema
  },
  
  // Event schemas
  events: {
    tournamentUpdate: TournamentUpdateEventSchema,
    matchUpdate: MatchUpdateEventSchema
  },
  
  // API schemas
  api: {
    response: APIResponseSchema,
    paginatedResponse: PaginatedResponseSchema
  }
} as const

// Validation functions organized by category
export const validators = {
  // Tournament validators
  tournament: {
    formData: validateTournamentFormData,
    entity: validateTournament,
    update: validateTournamentUpdate,
    filters: validateTournamentFilters
  },
  
  // Player validators
  player: {
    formData: validatePlayerFormData,
    entity: validatePlayer,
    update: validatePlayerUpdate,
    filters: validatePlayerFilters
  },
  
  // Team validators
  team: {
    entity: validateTeam
  },
  
  // Match validators
  match: {
    formData: validateMatchFormData,
    entity: validateMatch,
    update: validateMatchUpdate,
    filters: validateMatchFilters,
    score: validateScore,
    end: validateEnd
  },
  
  // Court validators
  court: {
    entity: validateCourt
  },
  
  // Bracket validators
  bracket: {
    entity: validateBracket
  },
  
  // Standing validators
  standing: {
    entity: validateStanding
  },
  
  // Event validators
  events: {
    tournamentUpdate: validateTournamentUpdateEvent,
    matchUpdate: validateMatchUpdateEvent
  },
  
  // API validators
  api: {
    response: createAPIResponseValidator,
    paginatedResponse: createPaginatedResponseValidator
  }
} as const

// Common validation utilities
import { z } from 'zod'

/**
 * Generic validation result type
 */
export type ValidationResult<T> = {
  success: boolean
  data?: T
  error?: {
    message: string
    issues: z.ZodIssue[]
  }
}

/**
 * Utility function to create a standardized validation result
 */
export const createValidationResult = <T>(
  result: z.ZodSafeParseResult<T>
): ValidationResult<T> => {
  if (result.success) {
    return {
      success: true,
      data: result.data
    }
  }

  return {
    success: false,
    error: {
      message: 'Validation failed',
      issues: result.error.issues
    }
  }
}

/**
 * Utility function to validate and throw on error
 */
export const validateOrThrow = <T>(
  schema: z.ZodSchema<T>,
  data: unknown,
  errorMessage = 'Validation failed'
): T => {
  const result = schema.safeParse(data)
  if (!result.success) {
    throw new Error(`${errorMessage}: ${result.error.message}`)
  }
  return result.data
}

/**
 * Utility function to create a validation middleware
 */
export const createValidationMiddleware = <T>(schema: z.ZodSchema<T>) => {
  return (data: unknown): T => {
    return validateOrThrow(schema, data, 'Request validation failed')
  }
}

/**
 * Batch validation utility for arrays
 */
export const validateBatch = <T>(
  schema: z.ZodSchema<T>,
  dataArray: unknown[]
): ValidationResult<T[]> => {
  const results: T[] = []
  const errors: z.ZodIssue[] = []

  for (let i = 0; i < dataArray.length; i++) {
    const result = schema.safeParse(dataArray[i])
    if (result.success) {
      results.push(result.data)
    } else {
      // Add index information to errors
      const indexedErrors = result.error.issues.map(issue => ({
        ...issue,
        path: [`[${i}]`, ...issue.path]
      }))
      errors.push(...indexedErrors)
    }
  }

  if (errors.length > 0) {
    return {
      success: false,
      error: {
        message: `Batch validation failed for ${errors.length} items`,
        issues: errors
      }
    }
  }

  return {
    success: true,
    data: results
  }
}

/**
 * Deep partial validation - useful for updates
 */
export const createPartialSchema = <T extends z.ZodRawShape>(
  schema: z.ZodObject<T>
): z.ZodObject<{ [K in keyof T]: z.ZodOptional<T[K]> }> => {
  return schema.partial()
}

/**
 * Schema composition utility
 */
export const composeSchemas = <T extends z.ZodRawShape, U extends z.ZodRawShape>(
  baseSchema: z.ZodObject<T>,
  extensionSchema: z.ZodObject<U>
) => {
  return baseSchema.merge(extensionSchema)
}

// Type exports for commonly used validation results
export type TournamentValidationResult = ValidationResult<z.infer<typeof TournamentSchema>>
export type PlayerValidationResult = ValidationResult<z.infer<typeof PlayerSchema>>
export type MatchValidationResult = ValidationResult<z.infer<typeof MatchSchema>>
export type TeamValidationResult = ValidationResult<z.infer<typeof TeamSchema>>

// Default export for convenience
const validationUtils = {
  schemas,
  validators,
  createValidationResult,
  validateOrThrow,
  createValidationMiddleware,
  validateBatch,
  createPartialSchema,
  composeSchemas
}

export default validationUtils