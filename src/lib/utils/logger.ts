/**
 * Structured logging utility for the application
 */

interface LogContext {
  operation?: string
  userId?: string
  tournamentId?: string
  matchId?: string
  playerId?: string
  duration?: number
  error?: string
  timestamp?: string
  [key: string]: unknown
}

interface Logger {
  info: (message: string, context?: LogContext) => void
  warn: (message: string, context?: LogContext) => void
  error: (message: string, context?: LogContext) => void
  debug: (message: string, context?: LogContext) => void
}

const formatLogEntry = (level: string, message: string, context?: LogContext) => {
  const timestamp = new Date().toISOString()
  const logEntry = {
    level,
    message,
    timestamp,
    ...context
  }
  
  if (process.env.NODE_ENV === 'development') {
    // Pretty print in development
    const logFn = console[level as 'log' | 'info' | 'warn' | 'error'] || console.log
    logFn(`[${timestamp}] ${level.toUpperCase()}: ${message}`, context ? JSON.stringify(context, null, 2) : '')
  } else {
    // Structured JSON in production
    const logFn = console[level as 'log' | 'info' | 'warn' | 'error'] || console.log
    logFn(JSON.stringify(logEntry))
  }
}

export const logger: Logger = {
  info: (message: string, context?: LogContext) => {
    formatLogEntry('info', message, context)
  },
  
  warn: (message: string, context?: LogContext) => {
    formatLogEntry('warn', message, context)
  },
  
  error: (message: string, context?: LogContext) => {
    formatLogEntry('error', message, {
      ...context,
      stack: context?.error ? new Error(context.error).stack : undefined
    })
  },
  
  debug: (message: string, context?: LogContext) => {
    if (process.env.NODE_ENV === 'development') {
      formatLogEntry('debug', message, context)
    }
  }
}

/**
 * Performance timing utility
 */
export class PerformanceTimer {
  private startTime: number
  private operation: string
  
  constructor(operation: string) {
    this.operation = operation
    this.startTime = Date.now()
    logger.debug(`Starting operation: ${operation}`)
  }
  
  end(additionalContext?: LogContext) {
    const duration = Date.now() - this.startTime
    logger.info(`Completed operation: ${this.operation}`, {
      duration,
      operation: this.operation,
      ...additionalContext
    })
    return duration
  }
  
  endWithError(error: Error, additionalContext?: LogContext) {
    const duration = Date.now() - this.startTime
    logger.error(`Failed operation: ${this.operation}`, {
      duration,
      operation: this.operation,
      error: error.message,
      ...additionalContext
    })
    return duration
  }
}