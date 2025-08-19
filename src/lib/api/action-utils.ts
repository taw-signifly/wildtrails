import { z } from 'zod'
import { Result } from '@/types'
import { DatabaseError } from '@/lib/db/base'
import { ActionResult } from '@/types/actions'

/**
 * Convert Result<T, DatabaseError> to ActionResult<T>
 * This bridges the gap between database layer and action layer error handling
 */
export function resultToActionResult<T>(
  result: Result<T, DatabaseError>,
  successMessage?: string
): ActionResult<T> {
  if (result.error) {
    return {
      success: false,
      error: result.error.message
    }
  }
  return {
    success: true,
    data: result.data,
    message: successMessage
  }
}

/**
 * Type-safe FormData field parser
 */
export function parseFormDataField<T>(
  formData: FormData, 
  key: string, 
  parser: (value: string) => T,
  required = false
): T | undefined {
  const value = formData.get(key)
  if (!value || value.toString().trim() === '') {
    if (required) {
      throw new Error(`${key} is required`)
    }
    return undefined
  }
  
  try {
    return parser(value.toString())
  } catch (error) {
    throw new Error(`Invalid ${key}: ${error instanceof Error ? error.message : String(error)}`)
  }
}

/**
 * Type-safe boolean parser for FormData checkboxes
 */
export function parseFormDataBoolean(
  formData: FormData,
  key: string,
  defaultValue = false
): boolean {
  const value = formData.get(key)
  if (value === null) return defaultValue
  return value === 'on' || value === 'true' || value === '1'
}

/**
 * Type-safe number parser for FormData
 */
export function parseFormDataNumber(
  value: string,
  min?: number,
  max?: number
): number {
  const num = parseInt(value, 10)
  if (isNaN(num)) {
    throw new Error('Must be a valid number')
  }
  if (min !== undefined && num < min) {
    throw new Error(`Must be at least ${min}`)
  }
  if (max !== undefined && num > max) {
    throw new Error(`Must be at most ${max}`)
  }
  return num
}

/**
 * Type-safe date parser for FormData
 */
export function parseFormDataDate(value: string): string {
  const date = new Date(value)
  if (isNaN(date.getTime())) {
    throw new Error('Must be a valid date')
  }
  return date.toISOString()
}

/**
 * Format Zod validation errors for form field errors
 */
export function formatZodErrors(error: z.ZodError): Record<string, string[]> {
  const fieldErrors: Record<string, string[]> = {}
  
  error.issues.forEach((err) => {
    const path = err.path.join('.')
    if (!fieldErrors[path]) {
      fieldErrors[path] = []
    }
    fieldErrors[path].push(err.message)
  })
  
  return fieldErrors
}

/**
 * Type guards for tournament enums
 */
export function isValidTournamentType(type: string): type is import('@/types').TournamentType {
  return ['single-elimination', 'double-elimination', 'swiss', 'round-robin', 'barrage', 'consolation'].includes(type)
}

export function isValidGameFormat(format: string): format is import('@/types').GameFormat {
  return ['singles', 'doubles', 'triples'].includes(format)
}

export function isValidCourtAssignmentMode(mode: string): mode is 'manual' | 'automatic' {
  return ['manual', 'automatic'].includes(mode)
}

export function isValidScoringMode(mode: string): mode is 'self-report' | 'official-only' {
  return ['self-report', 'official-only'].includes(mode)
}