/**
 * Rate Limiter - Distributed Storage with Automatic Backend Selection
 * José Madrid Salsa E-commerce Platform
 *
 * Auto-selects between Vercel KV (production) and in-memory (development).
 */

import type { RateLimitConfig, RateLimitResult, RateLimitStorage } from './rate-limit/types'
import { VercelKVStorage } from './rate-limit/storage/vercel-kv'
import { InMemoryStorage } from './rate-limit/storage/fallback'

// Re-export types for backward compatibility
export type { RateLimitConfig, RateLimitResult }

/**
 * Detect if Vercel KV is available
 */
function isVercelKVAvailable(): boolean {
  return !!(
    process.env.KV_REST_API_URL &&
    process.env.KV_REST_API_TOKEN
  )
}

/**
 * Get the appropriate storage backend
 *
 * - Production (Vercel with KV): Use Vercel KV storage
 * - Development (local): Use in-memory storage
 */
function getStorage(): RateLimitStorage {
  if (isVercelKVAvailable()) {
    return new VercelKVStorage()
  }

  return new InMemoryStorage()
}

// Singleton storage instance
let storageInstance: RateLimitStorage | null = null

/**
 * Get or create the storage instance
 */
function getStorageInstance(): RateLimitStorage {
  if (!storageInstance) {
    storageInstance = getStorage()
  }

  return storageInstance
}

/**
 * Check if a request is allowed under rate limit
 *
 * Now returns a Promise due to distributed storage being async.
 *
 * @param config - Rate limit configuration
 * @returns Promise resolving to rate limit result
 */
export async function checkRateLimit(
  config: RateLimitConfig
): Promise<RateLimitResult> {
  const storage = getStorageInstance()
  return storage.check(config)
}

/**
 * Reset rate limit for a specific identifier
 *
 * @param identifier - Unique identifier to reset
 * @returns Promise resolving when reset is complete
 */
export async function resetRateLimit(identifier: string): Promise<void> {
  const storage = getStorageInstance()
  return storage.reset(identifier)
}

/**
 * Clean up expired rate limit entries
 *
 * @returns Promise resolving when cleanup is complete
 */
export async function cleanupRateLimits(): Promise<void> {
  const storage = getStorageInstance()
  return storage.cleanup()
}

/**
 * Get information about the current storage backend
 *
 * Useful for debugging and monitoring
 */
export function getStorageInfo(): {
  type: 'vercel-kv' | 'in-memory'
  production: boolean
} {
  const isKVAvailable = isVercelKVAvailable()

  return {
    type: isKVAvailable ? 'vercel-kv' : 'in-memory',
    production: isKVAvailable,
  }
}

/**
 * Rate limit presets for different API endpoints
 */
export const RATE_LIMITS = {
  // AI Chat: 20 requests per minute per IP
  AI_CHAT: {
    maxRequests: 20,
    windowSeconds: 60,
  },

  // AI Chat (authenticated users): 50 requests per minute
  AI_CHAT_USER: {
    maxRequests: 50,
    windowSeconds: 60,
  },

  // General API: 100 requests per minute
  API_GENERAL: {
    maxRequests: 100,
    windowSeconds: 60,
  },

  // Authentication: 5 login attempts per 15 minutes
  AUTH_LOGIN: {
    maxRequests: 5,
    windowSeconds: 15 * 60,
  },

  // Password reset: 3 requests per hour
  PASSWORD_RESET: {
    maxRequests: 3,
    windowSeconds: 60 * 60,
  },
}

/**
 * Get client identifier from request (IP address)
 */
export function getClientIdentifier(request: Request): string {
  // Try to get real IP from headers (for proxies/load balancers)
  const forwardedFor = request.headers.get('x-forwarded-for')
  if (forwardedFor) {
    // Take the first IP in the list
    return forwardedFor.split(',')[0].trim()
  }

  const realIp = request.headers.get('x-real-ip')
  if (realIp) {
    return realIp
  }

  // Fallback to a generic identifier
  return 'unknown-ip'
}

/**
 * Create rate limit headers for API responses
 */
export function createRateLimitHeaders(result: RateLimitResult): HeadersInit {
  return {
    'X-RateLimit-Limit': result.current.toString(),
    'X-RateLimit-Remaining': result.remaining.toString(),
    'X-RateLimit-Reset': result.resetIn.toString(),
  }
}
