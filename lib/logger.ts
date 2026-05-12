/**
 * Application Logger
 * Simple logging utility for consistent error and info logging
 */

interface LogContext {
  [key: string]: unknown
}

class Logger {
  /**
   * Log an error with optional context
   */
  error(message: string, context?: LogContext): void {
    if (process.env.NODE_ENV !== 'production') {
      console.error(message, context)
    }
    // In production, this would integrate with a service like Sentry, DataDog, etc.
    // For now, we only log in development to avoid console pollution in production
  }

  /**
   * Log an info message with optional context
   */
  info(message: string, context?: LogContext): void {
    if (process.env.NODE_ENV !== 'production') {
      console.log(message, context)
    }
  }

  /**
   * Log a warning with optional context
   */
  warn(message: string, context?: LogContext): void {
    if (process.env.NODE_ENV !== 'production') {
      console.warn(message, context)
    }
  }
}

export const logger = new Logger()
