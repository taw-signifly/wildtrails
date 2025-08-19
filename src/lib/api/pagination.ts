/**
 * Pagination utilities for API endpoints
 */

export interface PaginationParams {
  page: number
  limit: number
}

export interface PaginationInfo {
  page: number
  limit: number
  total: number
  totalPages: number
  hasNextPage: boolean
  hasPrevPage: boolean
}

/**
 * Default pagination settings
 */
export const PAGINATION_DEFAULTS = {
  PAGE: 1,
  LIMIT: 20,
  MAX_LIMIT: 100
} as const

/**
 * Parse and validate pagination parameters from URL search params
 */
export function parsePaginationParams(searchParams: URLSearchParams): PaginationParams {
  const pageParam = searchParams.get('page')
  const limitParam = searchParams.get('limit')
  
  // Parse page parameter
  let page: number = PAGINATION_DEFAULTS.PAGE
  if (pageParam) {
    const parsedPage = parseInt(pageParam, 10)
    if (parsedPage > 0) {
      page = parsedPage
    }
  }
  
  // Parse limit parameter
  let limit: number = PAGINATION_DEFAULTS.LIMIT
  if (limitParam) {
    const parsedLimit = parseInt(limitParam, 10)
    if (parsedLimit > 0 && parsedLimit <= PAGINATION_DEFAULTS.MAX_LIMIT) {
      limit = parsedLimit
    }
  }
  
  return { page, limit }
}

/**
 * Calculate pagination info from data
 */
export function calculatePaginationInfo(
  page: number,
  limit: number,
  total: number
): PaginationInfo {
  const totalPages = Math.ceil(total / limit)
  
  return {
    page,
    limit,
    total,
    totalPages,
    hasNextPage: page < totalPages,
    hasPrevPage: page > 1
  }
}

/**
 * Calculate offset for database queries
 */
export function calculateOffset(page: number, limit: number): number {
  return (page - 1) * limit
}

/**
 * Apply pagination to an array of data
 */
export function paginateArray<T>(
  data: T[], 
  page: number, 
  limit: number
): { 
  paginatedData: T[], 
  paginationInfo: PaginationInfo 
} {
  const total = data.length
  const offset = calculateOffset(page, limit)
  const paginatedData = data.slice(offset, offset + limit)
  const paginationInfo = calculatePaginationInfo(page, limit, total)
  
  return {
    paginatedData,
    paginationInfo
  }
}

/**
 * Validate pagination parameters
 */
export function validatePaginationParams(params: {
  page?: unknown,
  limit?: unknown
}): { isValid: boolean, errors: string[] } {
  const errors: string[] = []
  
  // Validate page
  if (params.page !== undefined) {
    const page = Number(params.page)
    if (isNaN(page) || page < 1) {
      errors.push('Page must be a positive integer')
    }
  }
  
  // Validate limit
  if (params.limit !== undefined) {
    const limit = Number(params.limit)
    if (isNaN(limit) || limit < 1) {
      errors.push('Limit must be a positive integer')
    } else if (limit > PAGINATION_DEFAULTS.MAX_LIMIT) {
      errors.push(`Limit cannot exceed ${PAGINATION_DEFAULTS.MAX_LIMIT}`)
    }
  }
  
  return {
    isValid: errors.length === 0,
    errors
  }
}

/**
 * Create pagination metadata for response headers
 */
export function createPaginationHeaders(paginationInfo: PaginationInfo): Record<string, string> {
  return {
    'X-Total-Count': paginationInfo.total.toString(),
    'X-Total-Pages': paginationInfo.totalPages.toString(),
    'X-Current-Page': paginationInfo.page.toString(),
    'X-Per-Page': paginationInfo.limit.toString(),
    'X-Has-Next-Page': paginationInfo.hasNextPage.toString(),
    'X-Has-Prev-Page': paginationInfo.hasPrevPage.toString()
  }
}