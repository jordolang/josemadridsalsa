/**
 * In-Memory Storage Backend - Local Development Fallback
 * José Madrid Salsa E-commerce Platform
 *
 * Uses Map-based in-memory storage for rate limiting.
 * Only suitable for single-instance development environments.
 * Does NOT persist across serverless function invocations.
 */

import type {
  RateLimitConfig,
  RateLimitResult,
  RateLimitStorage,
  RateLimitRecord,
} from '../types'

/**
 * In-memory storage backend for rate limiting
 *
 * Uses simple Map with fixed window algorithm:
 * - Stores count and reset time for each identifier
 * - Resets window when reset time is reached
 * - Works only within a single process/instance
 * - Suitable for local development only
 */
export class InMemoryStorage implements RateLimitStorage {
  private readonly store: Map<string, RateLimitRecord>
  private cleanupInterval: NodeJS.Timeout | null = null

  constructor() {
    this.store = new Map()
    this.startCleanup()
  }

  /**
   * Start periodic cleanup of expired entries
   */
  private startCleanup(): void {
    // Cleanup old entries every 5 minutes
    this.cleanupInterval = setInterval(() => {
      void this.cleanup()
    }, 5 * 60 * 1000)

    // Don't prevent Node.js from exiting
    this.cleanupInterval.unref?.()
  }

  /**
   * Check and increment rate limit for an identifier
   *
   * Uses fixed window algorithm:
   * 1. Get or create rate limit record
   * 2. Reset if window has expired
   * 3. Increment counter if allowed
   * 4. Return result with remaining quota
   *
   * @param config - Rate limit configuration
   * @returns Promise resolving to rate limit result
   */
  async check(config: RateLimitConfig): Promise<RateLimitResult> {
    const { maxRequests, windowSeconds, identifier } = config
    const now = Date.now()
    const windowMs = windowSeconds * 1000

    // Get or create rate limit record
    let record = this.store.get(identifier)

    if (!record || now > record.resetTime) {
      // Create new record or reset expired one
      record = {
        count: 0,
        resetTime: now + windowMs,
      }
      this.store.set(identifier, record)
    }

    // Increment request count
    record.count++

    const allowed = record.count <= maxRequests
    const remaining = Math.max(0, maxRequests - record.count)
    const resetIn = Math.ceil((record.resetTime - now) / 1000)

    return {
      allowed,
      remaining,
      resetIn,
      current: record.count,
    }
  }

  /**
   * Reset rate limit for a specific identifier
   *
   * @param identifier - Unique identifier to reset
   * @returns Promise resolving when reset is complete
   */
  async reset(identifier: string): Promise<void> {
    this.store.delete(identifier)
  }

  /**
   * Clean up expired rate limit entries
   *
   * @returns Promise resolving when cleanup is complete
   */
  async cleanup(): Promise<void> {
    const now = Date.now()

    for (const [key, record] of Array.from(this.store.entries())) {
      if (now > record.resetTime) {
        this.store.delete(key)
      }
    }
  }

  /**
   * Stop cleanup interval (for graceful shutdown)
   */
  destroy(): void {
    if (this.cleanupInterval) {
      clearInterval(this.cleanupInterval)
      this.cleanupInterval = null
    }
  }
}

/**
 * Default in-memory storage instance
 */
export const inMemoryStorage = new InMemoryStorage()
