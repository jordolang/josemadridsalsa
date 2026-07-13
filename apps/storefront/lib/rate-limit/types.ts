/**
 * Rate Limit Storage Abstraction - Types
 * José Madrid Salsa E-commerce Platform
 */

/**
 * Rate limit configuration
 */
export interface RateLimitConfig {
  /** Maximum number of requests allowed in the window */
  maxRequests: number
  /** Window duration in seconds */
  windowSeconds: number
  /** Unique identifier (IP address, user ID, etc.) */
  identifier: string
}

/**
 * Rate limit check result
 */
export interface RateLimitResult {
  /** Whether the request is allowed */
  allowed: boolean
  /** Number of requests remaining */
  remaining: number
  /** Time until rate limit resets (seconds) */
  resetIn: number
  /** Current request count */
  current: number
}

/**
 * Internal rate limit record structure
 */
export interface RateLimitRecord {
  count: number
  resetTime: number
}

/**
 * Storage backend interface for rate limiting
 *
 * Implementations:
 * - Vercel KV (Redis) for production with sliding window algorithm
 * - In-memory Map for local development fallback
 */
export interface RateLimitStorage {
  /**
   * Check and increment rate limit for an identifier
   *
   * @param config - Rate limit configuration
   * @returns Promise resolving to rate limit result
   */
  check(config: RateLimitConfig): Promise<RateLimitResult>

  /**
   * Reset rate limit for a specific identifier
   *
   * @param identifier - Unique identifier to reset
   * @returns Promise resolving when reset is complete
   */
  reset(identifier: string): Promise<void>

  /**
   * Clean up expired rate limit entries
   *
   * @returns Promise resolving when cleanup is complete
   */
  cleanup(): Promise<void>
}
