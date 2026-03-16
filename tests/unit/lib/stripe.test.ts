/**
 * Stripe Client Tests
 * José Madrid Salsa E-commerce Platform
 */

import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'

// Store original environment variables
const originalEnv = { ...process.env }

// Create a spy for tracking constructor calls
const constructorSpy = vi.fn()

// Mock Stripe constructor
vi.mock('stripe', () => {
  class MockStripe {
    _secretKey: string
    _config: any
    tax: any
    customers: any
    paymentIntents: any

    constructor(secretKey: string, config: any) {
      constructorSpy(secretKey, config)
      this._secretKey = secretKey
      this._config = config
      this.tax = {}
      this.customers = {}
      this.paymentIntents = {}
    }
  }

  return { default: MockStripe }
})

describe('Stripe Client', () => {
  beforeEach(() => {
    // Clear module cache to reset the singleton
    vi.resetModules()
    // Clear mocks and spy
    vi.clearAllMocks()
    constructorSpy.mockClear()
    // Reset environment variables
    process.env = { ...originalEnv }
  })

  afterEach(() => {
    // Restore original environment
    process.env = originalEnv
  })

  describe('getStripe', () => {
    it('should create and return a Stripe client with STRIPE_SECRET_KEY', async () => {
      process.env.STRIPE_SECRET_KEY = 'sk_test_123456'

      const { getStripe } = await import('@/lib/stripe')
      const stripe = getStripe()

      expect(stripe).toBeDefined()
      expect(constructorSpy).toHaveBeenCalledWith('sk_test_123456', {
        apiVersion: '2025-10-29.clover',
      })
      expect(constructorSpy).toHaveBeenCalledTimes(1)
    })

    it('should create and return a Stripe client with STRIPE_SECRET fallback', async () => {
      delete process.env.STRIPE_SECRET_KEY
      process.env.STRIPE_SECRET = 'sk_test_fallback'

      const { getStripe } = await import('@/lib/stripe')
      const stripe = getStripe()

      expect(stripe).toBeDefined()
      expect(constructorSpy).toHaveBeenCalledWith('sk_test_fallback', {
        apiVersion: '2025-10-29.clover',
      })
    })

    it('should create and return a Stripe client with NEXT_PUBLIC_STRIPE_SECRET_KEY fallback', async () => {
      delete process.env.STRIPE_SECRET_KEY
      delete process.env.STRIPE_SECRET
      process.env.NEXT_PUBLIC_STRIPE_SECRET_KEY = 'sk_test_next_public'

      const { getStripe } = await import('@/lib/stripe')
      const stripe = getStripe()

      expect(stripe).toBeDefined()
      expect(constructorSpy).toHaveBeenCalledWith('sk_test_next_public', {
        apiVersion: '2025-10-29.clover',
      })
    })

    it('should throw an error when no secret key is configured', async () => {
      delete process.env.STRIPE_SECRET_KEY
      delete process.env.STRIPE_SECRET
      delete process.env.NEXT_PUBLIC_STRIPE_SECRET_KEY

      const { getStripe } = await import('@/lib/stripe')

      expect(() => getStripe()).toThrow(
        'Stripe secret key is not configured. Please set STRIPE_SECRET_KEY in your environment.'
      )
    })

    it('should return the cached client on subsequent calls (singleton pattern)', async () => {
      process.env.STRIPE_SECRET_KEY = 'sk_test_singleton'

      const { getStripe } = await import('@/lib/stripe')

      const stripe1 = getStripe()
      const stripe2 = getStripe()
      const stripe3 = getStripe()

      expect(stripe1).toBe(stripe2)
      expect(stripe2).toBe(stripe3)
      // Stripe constructor should only be called once
      expect(constructorSpy).toHaveBeenCalledTimes(1)
    })

    it('should prioritize STRIPE_SECRET_KEY over other environment variables', async () => {
      process.env.STRIPE_SECRET_KEY = 'sk_test_primary'
      process.env.STRIPE_SECRET = 'sk_test_fallback'
      process.env.NEXT_PUBLIC_STRIPE_SECRET_KEY = 'sk_test_next_public'

      const { getStripe } = await import('@/lib/stripe')
      const stripe = getStripe()

      expect(stripe).toBeDefined()
      expect(constructorSpy).toHaveBeenCalledWith('sk_test_primary', {
        apiVersion: '2025-10-29.clover',
      })
    })
  })
})
