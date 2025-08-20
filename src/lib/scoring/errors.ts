/**
 * Structured error handling for Petanque scoring engine
 * Provides comprehensive error types with context and recovery information
 */

export interface ScoringErrorContext {
  matchId?: string
  endNumber?: number
  bouleCount?: number
  operation: string
  timestamp?: string
  userId?: string
  [key: string]: unknown
}

/**
 * Base scoring error class with structured context
 */
export class ScoringError extends Error {
  public readonly code: string
  public readonly severity: 'low' | 'medium' | 'high' | 'critical'
  public readonly context: ScoringErrorContext
  public readonly recoverable: boolean
  public readonly timestamp: string

  constructor(
    message: string,
    code: string,
    context: ScoringErrorContext,
    severity: 'low' | 'medium' | 'high' | 'critical' = 'medium',
    recoverable = true
  ) {
    super(message)
    this.name = 'ScoringError'
    this.code = code
    this.severity = severity
    this.context = { ...context, timestamp: new Date().toISOString() }
    this.recoverable = recoverable
    this.timestamp = new Date().toISOString()
  }

  toJSON() {
    return {
      name: this.name,
      message: this.message,
      code: this.code,
      severity: this.severity,
      context: this.context,
      recoverable: this.recoverable,
      timestamp: this.timestamp,
      stack: this.stack
    }
  }
}

/**
 * Validation-specific errors
 */
export class ValidationError extends ScoringError {
  public readonly fieldErrors?: Record<string, string[]>

  constructor(
    message: string,
    context: ScoringErrorContext,
    fieldErrors?: Record<string, string[]>
  ) {
    super(message, 'VALIDATION_ERROR', context, 'high', true)
    this.name = 'ValidationError'
    this.fieldErrors = fieldErrors
  }
}

/**
 * Calculation-specific errors
 */
export class CalculationError extends ScoringError {
  constructor(message: string, context: ScoringErrorContext) {
    super(message, 'CALCULATION_ERROR', context, 'high', true)
    this.name = 'CalculationError'
  }
}

/**
 * Geometry calculation errors
 */
export class GeometryError extends ScoringError {
  constructor(message: string, context: ScoringErrorContext) {
    super(message, 'GEOMETRY_ERROR', context, 'medium', true)
    this.name = 'GeometryError'
  }
}

/**
 * Rule violation errors
 */
export class RuleViolationError extends ScoringError {
  public readonly ruleId: string
  public readonly suggestion?: string

  constructor(
    message: string,
    ruleId: string,
    context: ScoringErrorContext,
    suggestion?: string
  ) {
    super(message, 'RULE_VIOLATION', context, 'high', false)
    this.name = 'RuleViolationError'
    this.ruleId = ruleId
    this.suggestion = suggestion
  }
}

/**
 * Cache-related errors
 */
export class CacheError extends ScoringError {
  constructor(message: string, context: ScoringErrorContext) {
    super(message, 'CACHE_ERROR', context, 'low', true)
    this.name = 'CacheError'
  }
}

/**
 * Configuration errors
 */
export class ConfigurationError extends ScoringError {
  constructor(message: string, context: ScoringErrorContext) {
    super(message, 'CONFIGURATION_ERROR', context, 'critical', false)
    this.name = 'ConfigurationError'
  }
}

/**
 * Performance/timeout errors
 */
export class PerformanceError extends ScoringError {
  public readonly executionTime: number
  public readonly threshold: number

  constructor(
    message: string,
    executionTime: number,
    threshold: number,
    context: ScoringErrorContext
  ) {
    super(message, 'PERFORMANCE_ERROR', context, 'medium', true)
    this.name = 'PerformanceError'
    this.executionTime = executionTime
    this.threshold = threshold
  }
}

/**
 * Engine state errors
 */
export class EngineStateError extends ScoringError {
  constructor(message: string, context: ScoringErrorContext) {
    super(message, 'ENGINE_STATE_ERROR', context, 'high', true)
    this.name = 'EngineStateError'
  }
}

/**
 * Error factory functions
 */
export function createValidationError(
  message: string,
  operation: string,
  fieldErrors?: Record<string, string[]>,
  additionalContext?: Partial<ScoringErrorContext>
): ValidationError {
  return new ValidationError(
    message,
    { operation, ...additionalContext },
    fieldErrors
  )
}

export function createCalculationError(
  message: string,
  operation: string,
  additionalContext?: Partial<ScoringErrorContext>
): CalculationError {
  return new CalculationError(
    message,
    { operation, ...additionalContext }
  )
}

export function createGeometryError(
  message: string,
  operation: string,
  additionalContext?: Partial<ScoringErrorContext>
): GeometryError {
  return new GeometryError(
    message,
    { operation, ...additionalContext }
  )
}

export function createRuleViolationError(
  message: string,
  ruleId: string,
  operation: string,
  suggestion?: string,
  additionalContext?: Partial<ScoringErrorContext>
): RuleViolationError {
  return new RuleViolationError(
    message,
    ruleId,
    { operation, ...additionalContext },
    suggestion
  )
}

export function createCacheError(
  message: string,
  operation: string,
  additionalContext?: Partial<ScoringErrorContext>
): CacheError {
  return new CacheError(
    message,
    { operation, ...additionalContext }
  )
}

export function createConfigurationError(
  message: string,
  operation: string,
  additionalContext?: Partial<ScoringErrorContext>
): ConfigurationError {
  return new ConfigurationError(
    message,
    { operation, ...additionalContext }
  )
}

export function createPerformanceError(
  message: string,
  executionTime: number,
  threshold: number,
  operation: string,
  additionalContext?: Partial<ScoringErrorContext>
): PerformanceError {
  return new PerformanceError(
    message,
    executionTime,
    threshold,
    { operation, ...additionalContext }
  )
}

/**
 * Error recovery utilities
 */
export function isRecoverableError(error: unknown): boolean {
  if (error instanceof ScoringError) {
    return error.recoverable
  }
  return true // Assume unknown errors are recoverable
}

export function getErrorSeverity(error: unknown): 'low' | 'medium' | 'high' | 'critical' {
  if (error instanceof ScoringError) {
    return error.severity
  }
  return 'medium' // Default severity for unknown errors
}

export function getErrorContext(error: unknown): ScoringErrorContext | null {
  if (error instanceof ScoringError) {
    return error.context
  }
  return null
}

/**
 * Error logging and monitoring utilities
 */
export function logScoringError(error: ScoringError): void {
  const logLevel = {
    low: 'info',
    medium: 'warn',
    high: 'error',
    critical: 'error'
  }[error.severity]

  const logData = {
    message: error.message,
    code: error.code,
    severity: error.severity,
    context: error.context,
    recoverable: error.recoverable,
    timestamp: error.timestamp
  }
  
  if (logLevel === 'info') {
    console.info('[ScoringEngine]', logData)
  } else if (logLevel === 'warn') {
    console.warn('[ScoringEngine]', logData)
  } else {
    console.error('[ScoringEngine]', logData)
  }
}

/**
 * Error aggregation for batch operations
 */
export class ErrorAggregator {
  private errors: ScoringError[] = []
  
  add(error: ScoringError): void {
    this.errors.push(error)
  }
  
  hasErrors(): boolean {
    return this.errors.length > 0
  }
  
  hasCriticalErrors(): boolean {
    return this.errors.some(e => e.severity === 'critical')
  }
  
  getErrors(): readonly ScoringError[] {
    return this.errors
  }
  
  getErrorsBySeverity(severity: 'low' | 'medium' | 'high' | 'critical'): ScoringError[] {
    return this.errors.filter(e => e.severity === severity)
  }
  
  clear(): void {
    this.errors = []
  }
  
  toSummary(): {
    total: number
    bySeverity: Record<string, number>
    recoverable: number
    nonRecoverable: number
  } {
    const bySeverity = this.errors.reduce((acc, error) => {
      acc[error.severity] = (acc[error.severity] || 0) + 1
      return acc
    }, {} as Record<string, number>)
    
    return {
      total: this.errors.length,
      bySeverity,
      recoverable: this.errors.filter(e => e.recoverable).length,
      nonRecoverable: this.errors.filter(e => !e.recoverable).length
    }
  }
}