/**
 * Vercel KV Storage Backend - Sliding Window Rate Limiting
 * José Madrid Salsa E-commerce Platform
 *
 * Uses Redis sorted sets for distributed rate limiting with sliding window algorithm.
 * Each identifier gets a sorted set where timestamps are both members and scores.
 */

import { kv } from '@vercel/kv'
import type {
  RateLimitConfig,
  RateLimitResult,
  RateLimitStorage,
} from '../types'

/**
 * Vercel KV (Redis) storage backend for rate limiting
 *
 * Uses sliding window algorithm:
 * - Stores request timestamps in a sorted set
 * - Removes expired timestamps outside the window
 * - Counts requests within the current window
 * - Works across multiple serverless function instances
 */
export class VercelKVStorage implements RateLimitStorage {
  private readonly keyPrefix: string

  /**
   * Create a new Vercel KV storage backend
   *
   * @param keyPrefix - Prefix for Redis keys (default: 'ratelimit')
   */
  constructor(keyPrefix = 'ratelimit') {
    this.keyPrefix = keyPrefix
  }

  /**
   * Get the Redis key for an identifier
   */
  private getKey(identifier: string): string {
    return `${this.keyPrefix}:${identifier}`
  }

  /**
   * Check and increment rate limit for an identifier
   *
   * Uses sliding window algorithm with Redis sorted sets:
   * 1. Remove expired timestamps outside the window
   * 2. Count current requests in the window
   * 3. Add new timestamp if allowed
   * 4. Return result with remaining quota
   *
   * @param config - Rate limit configuration
   * @returns Promise resolving to rate limit result
   */
  async check(config: RateLimitConfig): Promise<RateLimitResult> {
    const { maxRequests, windowSeconds, identifier } = config
    const now = Date.now()
    const windowMs = windowSeconds * 1000
    const windowStart = now - windowMs
    const key = this.getKey(identifier)

    try {
      // Remove expired timestamps outside the sliding window
      await kv.zremrangebyscore(key, 0, windowStart)

      // Count requests in the current window
      const count = await kv.zcard(key)

      // Check if rate limit is exceeded
      const allowed = count < maxRequests

      if (allowed) {
        // Add current timestamp to the sorted set
        // Use timestamp as both score and member for uniqueness
        await kv.zadd(key, { score: now, member: `${now}:${Math.random()}` })

        // Set expiration to window duration + buffer
        // This ensures automatic cleanup of old keys
        await kv.expire(key, windowSeconds + 60)
      }

      // Get the oldest timestamp to calculate reset time
      const oldestTimestamps = await kv.zrange(key, 0, 0, { withScores: true })
      let resetIn = windowSeconds

      if (oldestTimestamps.length > 0) {
        // Extract score from the result
        // zrange with withScores returns [member, score, member, score, ...]
        const oldestScore =
          typeof oldestTimestamps[1] === 'number'
            ? oldestTimestamps[1]
            : parseInt(oldestTimestamps[1] as string, 10)
        const oldestTime = oldestScore
        const timeUntilOldestExpires = Math.ceil(
          (oldestTime + windowMs - now) / 1000
        )
        resetIn = Math.max(1, timeUntilOldestExpires)
      }

      const current = allowed ? count + 1 : count
      const remaining = Math.max(0, maxRequests - current)

      return {
        allowed,
        remaining,
        resetIn,
        current,
      }
    } catch (error) {
      // Log error and fail open (allow request) to prevent service disruption
      console.error('Rate limit check failed:', error)

      // Return a permissive result on error
      return {
        allowed: true,
        remaining: maxRequests - 1,
        resetIn: windowSeconds,
        current: 1,
      }
    }
  }

  /**
   * Reset rate limit for a specific identifier
   *
   * @param identifier - Unique identifier to reset
   * @returns Promise resolving when reset is complete
   */
  async reset(identifier: string): Promise<void> {
    const key = this.getKey(identifier)

    try {
      await kv.del(key)
    } catch (error) {
      console.error(`Failed to reset rate limit for ${identifier}:`, error)
      throw error
    }
  }

  /**
   * Clean up expired rate limit entries
   *
   * Note: With Vercel KV, this is handled automatically via EXPIRE commands.
   * This method is a no-op but required by the interface.
   *
   * @returns Promise resolving when cleanup is complete
   */
  async cleanup(): Promise<void> {
    // Automatic cleanup via EXPIRE - no action needed
    return Promise.resolve()
  }
}

/**
 * Default Vercel KV storage instance
 */
export const vercelKVStorage = new VercelKVStorage()
