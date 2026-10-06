/**
 * Distributed Rate Limiter - Automatic Storage Selection
 * José Madrid Salsa E-commerce Platform
 *
 * Auto-selects between Vercel KV (production) and in-memory (development).
 * Provides the same interface as lib/rate-limiter.ts but with distributed storage.
 */

import type { RateLimitConfig, RateLimitResult, RateLimitStorage } from '@/lib/rate-limit/types'
import { VercelKVStorage } from '@/lib/rate-limit/storage/vercel-kv'
import { InMemoryStorage } from '@/lib/rate-limit/storage/fallback'

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
 * This function has the same signature as lib/rate-limiter.ts checkRateLimit()
 * but returns a Promise due to distributed storage being async.
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
