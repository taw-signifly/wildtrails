import { NextRequest, NextResponse } from 'next/server'
import { createErrorResponse, HTTP_STATUS } from './response'

/**
 * CORS configuration for development
 */
const CORS_HEADERS = {
  'Access-Control-Allow-Origin': process.env.NODE_ENV === 'development' ? '*' : process.env.CORS_ORIGIN || '',
  'Access-Control-Allow-Methods': 'GET, POST, PUT, DELETE, OPTIONS',
  'Access-Control-Allow-Headers': 'Content-Type, Authorization, X-Requested-With',
  'Access-Control-Max-Age': '86400', // 24 hours
}

/**
 * Add CORS headers to response
 */
export function addCorsHeaders(response: NextResponse): NextResponse {
  Object.entries(CORS_HEADERS).forEach(([key, value]) => {
    response.headers.set(key, value)
  })
  return response
}

/**
 * Handle CORS preflight requests
 */
export function handleCorsOptions(): NextResponse {
  const response = new NextResponse(null, { status: 200 })
  return addCorsHeaders(response)
}

/**
 * HTTP method validation middleware
 */
export function validateHttpMethod(
  request: NextRequest,
  allowedMethods: string[]
): NextResponse | null {
  if (!allowedMethods.includes(request.method)) {
    const response = createErrorResponse(
      `Method ${request.method} not allowed. Allowed methods: ${allowedMethods.join(', ')}`,
      HTTP_STATUS.BAD_REQUEST
    )
    return addCorsHeaders(response)
  }
  return null
}

/**
 * Content-Type validation for POST/PUT requests
 */
export function validateContentType(request: NextRequest): NextResponse | null {
  const contentType = request.headers.get('content-type')
  
  if (['POST', 'PUT'].includes(request.method)) {
    if (!contentType || !contentType.includes('application/json')) {
      const response = createErrorResponse(
        'Content-Type must be application/json',
        HTTP_STATUS.BAD_REQUEST
      )
      return addCorsHeaders(response)
    }
  }
  
  return null
}

/**
 * Request size validation (prevent large payloads)
 */
export function validateRequestSize(
  request: NextRequest,
  maxSizeBytes: number = 1024 * 1024 // 1MB default
): NextResponse | null {
  const contentLength = request.headers.get('content-length')
  
  if (contentLength && parseInt(contentLength, 10) > maxSizeBytes) {
    const response = createErrorResponse(
      `Request too large. Maximum size: ${Math.round(maxSizeBytes / 1024)}KB`,
      HTTP_STATUS.UNPROCESSABLE_ENTITY
    )
    return addCorsHeaders(response)
  }
  
  return null
}

/**
 * Rate limiting (simple in-memory implementation)
 * Note: In production, use Redis or external rate limiting service
 */
class SimpleRateLimiter {
  private requests: Map<string, { count: number; resetTime: number }> = new Map()
  private readonly windowMs: number
  private readonly maxRequests: number

  constructor(windowMs: number = 60000, maxRequests: number = 100) {
    this.windowMs = windowMs
    this.maxRequests = maxRequests
  }

  isAllowed(identifier: string): boolean {
    const now = Date.now()
    const window = this.requests.get(identifier)

    if (!window || now > window.resetTime) {
      // New window
      this.requests.set(identifier, {
        count: 1,
        resetTime: now + this.windowMs
      })
      return true
    }

    if (window.count >= this.maxRequests) {
      return false
    }

    window.count++
    return true
  }

  getRemainingRequests(identifier: string): number {
    const window = this.requests.get(identifier)
    if (!window || Date.now() > window.resetTime) {
      return this.maxRequests
    }
    return Math.max(0, this.maxRequests - window.count)
  }

  getResetTime(identifier: string): number {
    const window = this.requests.get(identifier)
    if (!window || Date.now() > window.resetTime) {
      return Date.now() + this.windowMs
    }
    return window.resetTime
  }
}

const rateLimiter = new SimpleRateLimiter(60000, 100) // 100 requests per minute

/**
 * Rate limiting middleware
 */
export function applyRateLimit(request: NextRequest): NextResponse | null {
  // Use IP address as identifier (with fallback)
  const identifier = 
    request.headers.get('x-forwarded-for') || 
    request.headers.get('x-real-ip') || 
    'anonymous'

  if (!rateLimiter.isAllowed(identifier)) {
    const resetTime = rateLimiter.getResetTime(identifier)
    const resetDate = new Date(resetTime).toISOString()
    
    const response = createErrorResponse(
      'Rate limit exceeded. Please try again later.',
      HTTP_STATUS.SERVICE_UNAVAILABLE
    )
    
    // Add rate limit headers
    response.headers.set('X-RateLimit-Limit', '100')
    response.headers.set('X-RateLimit-Remaining', '0')
    response.headers.set('X-RateLimit-Reset', resetDate)
    
    return addCorsHeaders(response)
  }

  return null
}

/**
 * Add rate limit headers to successful responses
 */
export function addRateLimitHeaders(response: NextResponse, request: NextRequest): NextResponse {
  const identifier = 
    request.headers.get('x-forwarded-for') || 
    request.headers.get('x-real-ip') || 
    'anonymous'

  const remaining = rateLimiter.getRemainingRequests(identifier)
  const resetTime = rateLimiter.getResetTime(identifier)
  const resetDate = new Date(resetTime).toISOString()

  response.headers.set('X-RateLimit-Limit', '100')
  response.headers.set('X-RateLimit-Remaining', remaining.toString())
  response.headers.set('X-RateLimit-Reset', resetDate)

  return response
}

/**
 * Global error handler wrapper
 */
export function withErrorHandling(
  handler: (request: NextRequest, context: any) => Promise<NextResponse>
) {
  return async (request: NextRequest, context: any): Promise<NextResponse> => {
    try {
      return await handler(request, context)
    } catch (error) {
      console.error('Unhandled API error:', error)
      
      // Don't expose internal errors in production
      const message = process.env.NODE_ENV === 'development' && error instanceof Error
        ? error.message
        : 'An unexpected error occurred'
      
      const response = createErrorResponse(message, HTTP_STATUS.INTERNAL_SERVER_ERROR)
      return addCorsHeaders(response)
    }
  }
}

/**
 * Apply all common middleware checks
 */
export function applyCommonMiddleware(
  request: NextRequest,
  allowedMethods: string[]
): NextResponse | null {
  // Handle CORS preflight
  if (request.method === 'OPTIONS') {
    return handleCorsOptions()
  }
  
  // Validate HTTP method
  const methodError = validateHttpMethod(request, allowedMethods)
  if (methodError) return methodError
  
  // Validate content type for POST/PUT
  const contentTypeError = validateContentType(request)
  if (contentTypeError) return contentTypeError
  
  // Validate request size
  const sizeError = validateRequestSize(request)
  if (sizeError) return sizeError
  
  // Apply rate limiting
  const rateLimitError = applyRateLimit(request)
  if (rateLimitError) return rateLimitError
  
  return null
}

/**
 * Combine middleware and error handling
 */
export function createApiHandler(
  handler: (request: NextRequest, context: any) => Promise<NextResponse>,
  allowedMethods: string[] = ['GET', 'POST', 'PUT', 'DELETE']
) {
  return withErrorHandling(async (request: NextRequest, context: any) => {
    // Apply common middleware
    const middlewareError = applyCommonMiddleware(request, allowedMethods)
    if (middlewareError) return middlewareError
    
    // Execute the actual handler
    const response = await handler(request, context)
    
    // Add common response headers
    const corsResponse = addCorsHeaders(response)
    const finalResponse = addRateLimitHeaders(corsResponse, request)
    
    return finalResponse
  })
}