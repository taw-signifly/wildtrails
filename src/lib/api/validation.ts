import { NextRequest } from 'next/server'
import { z } from 'zod'

/**
 * Validation result type
 */
export type ValidationResult<T> = {
  success: true
  data: T
} | {
  success: false
  errors: string[]
}

/**
 * Validate request body against a Zod schema
 */
export async function validateRequestBody<T>(
  request: NextRequest,
  schema: z.ZodSchema<T>
): Promise<ValidationResult<T>> {
  try {
    const body = await request.json()
    const result = schema.safeParse(body)
    
    if (result.success) {
      return {
        success: true,
        data: result.data
      }
    } else {
      const errors = result.error.issues.map(err => 
        `${err.path.join('.')}: ${err.message}`
      )
      return {
        success: false,
        errors
      }
    }
  } catch (error) {
    return {
      success: false,
      errors: ['Invalid JSON in request body']
    }
  }
}

/**
 * Validate URL search parameters against a Zod schema
 */
export function validateSearchParams<T>(
  searchParams: URLSearchParams,
  schema: z.ZodSchema<T>
): ValidationResult<T> {
  try {
    // Convert URLSearchParams to an object
    const params: Record<string, any> = {}
    
    for (const [key, value] of searchParams.entries()) {
      // Handle array parameters (e.g., ?tags=tag1&tags=tag2)
      if (params[key]) {
        if (Array.isArray(params[key])) {
          params[key].push(value)
        } else {
          params[key] = [params[key], value]
        }
      } else {
        params[key] = value
      }
    }
    
    const result = schema.safeParse(params)
    
    if (result.success) {
      return {
        success: true,
        data: result.data
      }
    } else {
      const errors = result.error.issues.map(err => 
        `${err.path.join('.')}: ${err.message}`
      )
      return {
        success: false,
        errors
      }
    }
  } catch (error) {
    return {
      success: false,
      errors: ['Failed to validate search parameters']
    }
  }
}

/**
 * Validate route parameters (e.g., tournament ID)
 */
export function validateRouteParam(
  param: string | undefined,
  paramName: string,
  schema: z.ZodSchema = z.string().min(1)
): ValidationResult<string> {
  if (!param) {
    return {
      success: false,
      errors: [`${paramName} is required`]
    }
  }
  
  const result = schema.safeParse(param)
  
  if (result.success) {
    return {
      success: true,
      data: result.data as string
    }
  } else {
    const errors = result.error.issues.map(err => 
      `${paramName}: ${err.message}`
    )
    return {
      success: false,
      errors
    }
  }
}

/**
 * Common validation schemas for API requests
 */

// Tournament ID validation
export const TournamentIdSchema = z.string().min(1, 'Tournament ID is required')

// Player ID validation
export const PlayerIdSchema = z.string().min(1, 'Player ID is required')

// Tournament filters for GET requests
export const TournamentFiltersSchema = z.object({
  status: z.enum(['setup', 'active', 'completed', 'cancelled']).optional(),
  type: z.enum(['single-elimination', 'double-elimination', 'swiss', 'round-robin', 'barrage', 'consolation']).optional(),
  format: z.enum(['singles', 'doubles', 'triples']).optional(),
  organizer: z.string().max(100).optional(),
  location: z.string().max(200).optional(),
  startDate: z.string().datetime().optional(),
  endDate: z.string().datetime().optional(),
  page: z.coerce.number().int().min(1).default(1),
  limit: z.coerce.number().int().min(1).max(100).default(20)
}).refine((data) => {
  // Ensure endDate is after startDate if both provided
  if (data.startDate && data.endDate) {
    return new Date(data.endDate) > new Date(data.startDate)
  }
  return true
}, {
  message: 'End date must be after start date',
  path: ['endDate']
})

// Player registration schema
export const PlayerRegistrationSchema = z.object({
  playerId: PlayerIdSchema
})

/**
 * Utility to create a validation middleware wrapper
 */
export function withValidation<TBody = never, TParams = never>(
  handler: (
    request: NextRequest,
    context: { params: TParams },
    validatedData: TBody
  ) => Promise<Response>,
  bodySchema?: z.ZodSchema<TBody>,
  paramsSchema?: z.ZodSchema<TParams>
) {
  return async (
    request: NextRequest,
    context: { params: any }
  ): Promise<Response> => {
    // Validate body if schema provided
    let validatedBody: TBody | undefined
    if (bodySchema) {
      const bodyValidation = await validateRequestBody(request, bodySchema)
      if (!bodyValidation.success) {
        return Response.json(
          {
            success: false,
            error: bodyValidation.errors.join(', '),
            timestamp: new Date().toISOString()
          },
          { status: 400 }
        )
      }
      validatedBody = bodyValidation.data
    }
    
    // Validate params if schema provided
    let validatedParams: TParams = context.params
    if (paramsSchema) {
      const paramsValidation = paramsSchema.safeParse(context.params)
      if (!paramsValidation.success) {
        const errors = paramsValidation.error.issues.map(err => 
          `${err.path.join('.')}: ${err.message}`
        )
        return Response.json(
          {
            success: false,
            error: errors.join(', '),
            timestamp: new Date().toISOString()
          },
          { status: 400 }
        )
      }
      validatedParams = paramsValidation.data
    }
    
    // Call the actual handler with validated data
    return handler(request, { params: validatedParams }, validatedBody as TBody)
  }
}

/**
 * Sanitize string input (basic XSS prevention)
 */
export function sanitizeString(input: string): string {
  return input
    .replace(/[<>]/g, '') // Remove basic HTML tags
    .trim()
}

/**
 * Validate and sanitize tournament form data
 */
export function sanitizeTournamentData<T extends Record<string, any>>(data: T): T {
  const sanitized = { ...data } as any
  
  // Sanitize string fields
  if (typeof sanitized.name === 'string') {
    sanitized.name = sanitizeString(sanitized.name)
  }
  if (typeof sanitized.description === 'string') {
    sanitized.description = sanitizeString(sanitized.description)
  }
  if (typeof sanitized.location === 'string') {
    sanitized.location = sanitizeString(sanitized.location)
  }
  if (typeof sanitized.organizer === 'string') {
    sanitized.organizer = sanitizeString(sanitized.organizer)
  }
  
  return sanitized
}