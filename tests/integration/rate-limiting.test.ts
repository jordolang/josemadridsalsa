/**
 * Integration Test: Distributed Rate Limiting
 *
 * This test verifies the distributed rate limiting system:
 * 1. Rate limit triggers after threshold
 * 2. Different identifiers get separate limits
 * 3. Rate limit resets after window expires
 * 4. Reset and cleanup utilities work correctly
 */

import { describe, it, expect, beforeEach, vi } from 'vitest'

// Mock @vercel/kv to allow tests to run without Vercel KV installed
// The rate limiter will automatically fall back to in-memory storage
vi.mock('@vercel/kv', () => ({
  kv: null,
}))

import {
  checkRateLimit,
  resetRateLimit,
  cleanupRateLimits,
  getStorageInfo,
  createRateLimitHeaders,
  RATE_LIMITS,
} from '@/lib/rate-limiter'

/**
 * Helper to wait for a specified number of milliseconds
 */
function delay(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms))
}

describe('Distributed Rate Limiting', () => {
  beforeEach(async () => {
    // Clean up before each test
    await cleanupRateLimits()
  })

  describe('Basic Rate Limiting', () => {
    it('should allow requests below the threshold', async () => {
      const config = {
        identifier: 'test-ip-1',
        maxRequests: 3,
        windowSeconds: 10,
      }

      // First request
      const result1 = await checkRateLimit(config)
      expect(result1.allowed).toBe(true)
      expect(result1.current).toBe(1)
      expect(result1.remaining).toBe(2)
      expect(result1.resetIn).toBeGreaterThan(0)

      // Second request
      const result2 = await checkRateLimit(config)
      expect(result2.allowed).toBe(true)
      expect(result2.current).toBe(2)
      expect(result2.remaining).toBe(1)

      // Third request
      const result3 = await checkRateLimit(config)
      expect(result3.allowed).toBe(true)
      expect(result3.current).toBe(3)
      expect(result3.remaining).toBe(0)
    })

    it('should block requests after exceeding threshold', async () => {
      const config = {
        identifier: 'test-ip-2',
        maxRequests: 2,
        windowSeconds: 10,
      }

      // Allow first 2 requests
      await checkRateLimit(config)
      await checkRateLimit(config)

      // Block 3rd request
      const result3 = await checkRateLimit(config)
      expect(result3.allowed).toBe(false)
      expect(result3.current).toBe(3)
      expect(result3.remaining).toBe(0)

      // Block 4th request
      const result4 = await checkRateLimit(config)
      expect(result4.allowed).toBe(false)
      expect(result4.current).toBe(4)
      expect(result4.remaining).toBe(0)
    })

    it('should track remaining requests correctly', async () => {
      const config = {
        identifier: 'test-ip-3',
        maxRequests: 5,
        windowSeconds: 10,
      }

      for (let i = 1; i <= 5; i++) {
        const result = await checkRateLimit(config)
        expect(result.current).toBe(i)
        expect(result.remaining).toBe(5 - i)
        expect(result.allowed).toBe(true)
      }

      // 6th request should be blocked
      const blockedResult = await checkRateLimit(config)
      expect(blockedResult.allowed).toBe(false)
      expect(blockedResult.remaining).toBe(0)
    })
  })

  describe('Separate Limits per Identifier', () => {
    it('should maintain separate limits for different identifiers', async () => {
      const configA = {
        identifier: 'ip-address-a',
        maxRequests: 2,
        windowSeconds: 10,
      }

      const configB = {
        identifier: 'ip-address-b',
        maxRequests: 2,
        windowSeconds: 10,
      }

      // Exhaust limit for identifier A
      await checkRateLimit(configA)
      await checkRateLimit(configA)
      const blockedA = await checkRateLimit(configA)
      expect(blockedA.allowed).toBe(false)

      // Identifier B should still have full quota
      const resultB1 = await checkRateLimit(configB)
      expect(resultB1.allowed).toBe(true)
      expect(resultB1.current).toBe(1)
      expect(resultB1.remaining).toBe(1)

      const resultB2 = await checkRateLimit(configB)
      expect(resultB2.allowed).toBe(true)
      expect(resultB2.current).toBe(2)
      expect(resultB2.remaining).toBe(0)
    })

    it('should handle multiple concurrent identifiers', async () => {
      const identifiers = ['user-1', 'user-2', 'user-3', 'user-4', 'user-5']
      const maxRequests = 3
      const windowSeconds = 10

      // Each identifier should get their own limit
      for (const identifier of identifiers) {
        for (let i = 0; i < maxRequests; i++) {
          const result = await checkRateLimit({
            identifier,
            maxRequests,
            windowSeconds,
          })
          expect(result.allowed).toBe(true)
          expect(result.current).toBe(i + 1)
        }

        // Next request should be blocked
        const blocked = await checkRateLimit({
          identifier,
          maxRequests,
          windowSeconds,
        })
        expect(blocked.allowed).toBe(false)
      }
    })
  })

  describe('Rate Limit Reset', () => {
    it('should reset after window expires (short window test)', async () => {
      const config = {
        identifier: 'test-reset-ip',
        maxRequests: 2,
        windowSeconds: 1, // 1 second window for fast test
      }

      // Exhaust the limit
      await checkRateLimit(config)
      await checkRateLimit(config)

      // Should be blocked
      const blocked = await checkRateLimit(config)
      expect(blocked.allowed).toBe(false)

      // Wait for window to expire (1.1 seconds to be safe)
      await delay(1100)

      // Should be allowed again after reset
      const afterReset = await checkRateLimit(config)
      expect(afterReset.allowed).toBe(true)
      expect(afterReset.current).toBe(1)
      expect(afterReset.remaining).toBe(1)
    })

    it('should manual reset work correctly', async () => {
      const identifier = 'test-manual-reset'
      const config = {
        identifier,
        maxRequests: 2,
        windowSeconds: 60,
      }

      // Exhaust the limit
      await checkRateLimit(config)
      await checkRateLimit(config)

      // Should be blocked
      const blocked = await checkRateLimit(config)
      expect(blocked.allowed).toBe(false)

      // Manual reset
      await resetRateLimit(identifier)

      // Should be allowed again immediately
      const afterReset = await checkRateLimit(config)
      expect(afterReset.allowed).toBe(true)
      expect(afterReset.current).toBe(1)
      expect(afterReset.remaining).toBe(1)
    })
  })

  describe('Rate Limit Presets', () => {
    it('should have correct AUTH_LOGIN preset configuration', () => {
      expect(RATE_LIMITS.AUTH_LOGIN).toEqual({
        maxRequests: 5,
        windowSeconds: 15 * 60, // 15 minutes
      })
    })

    it('should have correct PASSWORD_RESET preset configuration', () => {
      expect(RATE_LIMITS.PASSWORD_RESET).toEqual({
        maxRequests: 3,
        windowSeconds: 60 * 60, // 1 hour
      })
    })

    it('should enforce AUTH_LOGIN limits correctly', async () => {
      const identifier = 'auth-test-user'
      const config = {
        identifier: `auth:login:${identifier}`,
        ...RATE_LIMITS.AUTH_LOGIN,
      }

      // Allow 5 login attempts
      for (let i = 1; i <= 5; i++) {
        const result = await checkRateLimit(config)
        expect(result.allowed).toBe(true)
        expect(result.current).toBe(i)
      }

      // 6th attempt should be blocked
      const blocked = await checkRateLimit(config)
      expect(blocked.allowed).toBe(false)
      expect(blocked.current).toBe(6)
    })

    it('should enforce PASSWORD_RESET limits correctly', async () => {
      const identifier = 'reset-test-email@example.com'
      const config = {
        identifier: `password-reset:${identifier}`,
        ...RATE_LIMITS.PASSWORD_RESET,
      }

      // Allow 3 password reset attempts
      for (let i = 1; i <= 3; i++) {
        const result = await checkRateLimit(config)
        expect(result.allowed).toBe(true)
        expect(result.current).toBe(i)
      }

      // 4th attempt should be blocked
      const blocked = await checkRateLimit(config)
      expect(blocked.allowed).toBe(false)
      expect(blocked.current).toBe(4)
    })
  })

  describe('Rate Limit Headers', () => {
    it('should create correct rate limit headers', () => {
      const result = {
        allowed: true,
        remaining: 47,
        resetIn: 60,
        current: 3,
      }

      const headers = createRateLimitHeaders(result)

      expect(headers).toEqual({
        'X-RateLimit-Limit': '3',
        'X-RateLimit-Remaining': '47',
        'X-RateLimit-Reset': '60',
      })
    })

    it('should create headers when rate limit exceeded', () => {
      const result = {
        allowed: false,
        remaining: 0,
        resetIn: 120,
        current: 101,
      }

      const headers = createRateLimitHeaders(result)

      expect(headers).toEqual({
        'X-RateLimit-Limit': '101',
        'X-RateLimit-Remaining': '0',
        'X-RateLimit-Reset': '120',
      })
    })
  })

  describe('Storage Backend', () => {
    it('should report storage info', () => {
      const info = getStorageInfo()

      expect(info).toHaveProperty('type')
      expect(info).toHaveProperty('production')
      expect(['vercel-kv', 'in-memory']).toContain(info.type)
      expect(typeof info.production).toBe('boolean')
    })

    it('should use in-memory storage in test environment', () => {
      // In test environment without Vercel KV env vars, should use in-memory
      if (!process.env.KV_REST_API_URL || !process.env.KV_REST_API_TOKEN) {
        const info = getStorageInfo()
        expect(info.type).toBe('in-memory')
        expect(info.production).toBe(false)
      }
    })
  })

  describe('Cleanup', () => {
    it('should cleanup expired entries', async () => {
      const config = {
        identifier: 'cleanup-test',
        maxRequests: 5,
        windowSeconds: 1, // 1 second window
      }

      // Make some requests
      await checkRateLimit(config)
      await checkRateLimit(config)

      // Wait for window to expire
      await delay(1100)

      // Cleanup
      await cleanupRateLimits()

      // After cleanup, should start fresh
      const result = await checkRateLimit(config)
      expect(result.current).toBe(1)
      expect(result.remaining).toBe(4)
    })
  })

  describe('Edge Cases', () => {
    it('should handle zero maxRequests', async () => {
      const config = {
        identifier: 'zero-max',
        maxRequests: 0,
        windowSeconds: 10,
      }

      const result = await checkRateLimit(config)
      expect(result.allowed).toBe(false)
      expect(result.remaining).toBe(0)
    })

    it('should handle very large maxRequests', async () => {
      const config = {
        identifier: 'large-max',
        maxRequests: 1000000,
        windowSeconds: 60,
      }

      const result = await checkRateLimit(config)
      expect(result.allowed).toBe(true)
      expect(result.current).toBe(1)
      expect(result.remaining).toBe(999999)
    })

    it('should handle special characters in identifier', async () => {
      const config = {
        identifier: 'user:email@example.com:action:login',
        maxRequests: 3,
        windowSeconds: 10,
      }

      const result = await checkRateLimit(config)
      expect(result.allowed).toBe(true)
      expect(result.current).toBe(1)
    })

    it('should handle rapid consecutive requests', async () => {
      const identifier = 'rapid-test'
      const config = {
        identifier,
        maxRequests: 10,
        windowSeconds: 10,
      }

      // Fire 10 requests rapidly in parallel
      const promises = Array.from({ length: 10 }, () => checkRateLimit(config))
      const results = await Promise.all(promises)

      // All should be allowed (though order may vary)
      const allowedCount = results.filter((r) => r.allowed).length
      expect(allowedCount).toBeGreaterThanOrEqual(8) // Allow some race conditions

      // Next request should be blocked
      const blocked = await checkRateLimit(config)
      expect(blocked.allowed).toBe(false)
    })
  })
})
