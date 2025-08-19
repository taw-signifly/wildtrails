import { NextResponse } from 'next/server'
import { APIResponse, PaginatedResponse } from '@/types'

/**
 * HTTP Status Codes for Tournament API
 */
export const HTTP_STATUS = {
  OK: 200,
  CREATED: 201,
  BAD_REQUEST: 400,
  UNAUTHORIZED: 401,
  FORBIDDEN: 403,
  NOT_FOUND: 404,
  CONFLICT: 409,
  UNPROCESSABLE_ENTITY: 422,
  INTERNAL_SERVER_ERROR: 500,
  SERVICE_UNAVAILABLE: 503
} as const

/**
 * Create a successful API response
 */
export function createSuccessResponse<T>(
  data: T,
  message?: string,
  status: number = HTTP_STATUS.OK
): NextResponse<APIResponse<T>> {
  const response: APIResponse<T> = {
    success: true,
    data,
    message,
    timestamp: new Date().toISOString()
  }
  
  return NextResponse.json(response, { status })
}

/**
 * Create an error API response
 */
export function createErrorResponse(
  error: string,
  status: number = HTTP_STATUS.INTERNAL_SERVER_ERROR,
  message?: string
): NextResponse<APIResponse<never>> {
  const response: APIResponse<never> = {
    success: false,
    error,
    message,
    timestamp: new Date().toISOString()
  }
  
  return NextResponse.json(response, { status })
}

/**
 * Create a paginated response
 */
export function createPaginatedResponse<T>(
  data: T[],
  pagination: {
    page: number
    limit: number
    total: number
  },
  status: number = HTTP_STATUS.OK
): NextResponse<APIResponse<PaginatedResponse<T>>> {
  const totalPages = Math.ceil(pagination.total / pagination.limit)
  
  const paginatedData: PaginatedResponse<T> = {
    data,
    pagination: {
      ...pagination,
      totalPages
    }
  }
  
  return createSuccessResponse(paginatedData, undefined, status)
}

/**
 * Create a validation error response
 */
export function createValidationError(
  errors: string[] | string,
  message = 'Validation failed'
): NextResponse<APIResponse<never>> {
  const errorMessage = Array.isArray(errors) ? errors.join(', ') : errors
  return createErrorResponse(errorMessage, HTTP_STATUS.BAD_REQUEST, message)
}

/**
 * Create a not found error response
 */
export function createNotFoundError(
  resource: string,
  id?: string
): NextResponse<APIResponse<never>> {
  const message = id 
    ? `${resource} with ID '${id}' not found`
    : `${resource} not found`
    
  return createErrorResponse(message, HTTP_STATUS.NOT_FOUND)
}

/**
 * Create a conflict error response (business rule violation)
 */
export function createConflictError(
  message: string
): NextResponse<APIResponse<never>> {
  return createErrorResponse(message, HTTP_STATUS.CONFLICT)
}

/**
 * Create an internal server error response
 */
export function createInternalServerError(
  error?: unknown,
  message = 'An unexpected error occurred'
): NextResponse<APIResponse<never>> {
  // Log the actual error for debugging (in production, use proper logging)
  if (error) {
    console.error('Internal server error:', error)
  }
  
  return createErrorResponse(message, HTTP_STATUS.INTERNAL_SERVER_ERROR)
}

/**
 * Handle database result and convert to API response
 */
export function handleDatabaseResult<T>(
  result: { data: T | null; error: any },
  resourceName: string,
  resourceId?: string
): NextResponse<APIResponse<T>> | NextResponse<APIResponse<never>> {
  if (result.error) {
    // Check if it's a not found error
    if (result.error.message?.includes('not found')) {
      return createNotFoundError(resourceName, resourceId)
    }
    
    // Check if it's a validation error  
    if (result.error.message?.includes('validation') || 
        result.error.message?.includes('required') ||
        result.error.message?.includes('invalid')) {
      return createValidationError(result.error.message)
    }
    
    // Check if it's a business logic error
    if (result.error.message?.includes('cannot') || 
        result.error.message?.includes('not allowed') ||
        result.error.message?.includes('full') ||
        result.error.message?.includes('minimum')) {
      return createConflictError(result.error.message)
    }
    
    // Default to internal server error
    return createInternalServerError(result.error, result.error.message)
  }
  
  if (result.data === null) {
    return createNotFoundError(resourceName, resourceId)
  }
  
  return createSuccessResponse(result.data)
}

/**
 * Handle database result for creation operations
 */
export function handleCreateResult<T>(
  result: { data: T | null; error: any },
  resourceName: string
): NextResponse<APIResponse<T>> | NextResponse<APIResponse<never>> {
  if (result.error) {
    // Check for duplicate/conflict errors
    if (result.error.message?.includes('already exists') ||
        result.error.message?.includes('duplicate')) {
      return createConflictError(result.error.message)
    }
    
    // Check for validation errors
    if (result.error.message?.includes('validation') || 
        result.error.message?.includes('required') ||
        result.error.message?.includes('invalid')) {
      return createValidationError(result.error.message)
    }
    
    return createInternalServerError(result.error, result.error.message)
  }
  
  if (result.data === null) {
    return createInternalServerError(null, `Failed to create ${resourceName}`)
  }
  
  return createSuccessResponse(result.data, `${resourceName} created successfully`, HTTP_STATUS.CREATED)
}

/**
 * Handle database result for update operations
 */
export function handleUpdateResult<T>(
  result: { data: T | null; error: any },
  resourceName: string,
  resourceId: string
): NextResponse<APIResponse<T>> | NextResponse<APIResponse<never>> {
  if (result.error) {
    // Check if it's a not found error
    if (result.error.message?.includes('not found')) {
      return createNotFoundError(resourceName, resourceId)
    }
    
    // Check for conflict errors (business rules)
    if (result.error.message?.includes('cannot') || 
        result.error.message?.includes('not allowed')) {
      return createConflictError(result.error.message)
    }
    
    // Check for validation errors
    if (result.error.message?.includes('validation') || 
        result.error.message?.includes('required') ||
        result.error.message?.includes('invalid')) {
      return createValidationError(result.error.message)
    }
    
    return createInternalServerError(result.error, result.error.message)
  }
  
  if (result.data === null) {
    return createNotFoundError(resourceName, resourceId)
  }
  
  return createSuccessResponse(result.data, `${resourceName} updated successfully`)
}

/**
 * Handle database result for delete operations
 */
export function handleDeleteResult<T>(
  result: { data: T | null; error: any },
  resourceName: string,
  resourceId: string
): NextResponse<APIResponse<{ id: string; archived: boolean }>> | NextResponse<APIResponse<never>> {
  if (result.error) {
    if (result.error.message?.includes('not found')) {
      return createNotFoundError(resourceName, resourceId)
    }
    
    if (result.error.message?.includes('cannot') || 
        result.error.message?.includes('not allowed')) {
      return createConflictError(result.error.message)
    }
    
    return createInternalServerError(result.error, result.error.message)
  }
  
  if (result.data === null) {
    return createNotFoundError(resourceName, resourceId)
  }
  
  return createSuccessResponse(
    { id: resourceId, archived: true }, 
    `${resourceName} archived successfully`
  )
}