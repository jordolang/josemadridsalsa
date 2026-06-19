/**
 * Shipping API Client Tests
 * José Madrid Salsa E-commerce Platform
 */

import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import type { Rate } from '@easypost/api'

// Store original environment variables
const originalEnv = { ...process.env }

// Create spies for tracking API calls
const createShipmentSpy = vi.fn()
const easyPostConstructorSpy = vi.fn()

// Mock EasyPost client
vi.mock('@easypost/api', () => {
  return {
    default: class MockEasyPostClient {
      Shipment: {
        create: typeof createShipmentSpy
      }

      constructor(apiKey: string, config: any) {
        easyPostConstructorSpy(apiKey, config)
        this.Shipment = {
          create: createShipmentSpy,
        }
      }
    },
  }
})

describe('Shipping API', () => {
  beforeEach(() => {
    // Clear module cache to reset singletons
    vi.resetModules()
    // Clear all mocks
    vi.clearAllMocks()
    createShipmentSpy.mockClear()
    easyPostConstructorSpy.mockClear()
    // Reset environment variables
    process.env = { ...originalEnv }
  })

  afterEach(() => {
    // Restore original environment
    process.env = originalEnv
  })

  describe('getShippingClient', () => {
    it('should create EasyPost client when SHIPPING_API_KEY is configured', async () => {
      process.env.SHIPPING_API_KEY = 'EZAK_test_123456'
      process.env.SHIPPING_PROVIDER = 'easypost'

      const { getShippingClient } = await import('@/lib/shipping-api')
      const client = getShippingClient()

      expect(client).toBeDefined()
      expect(client.provider).toBe('easypost')
      expect(client.testMode).toBe(false)
    })

    it('should throw error when SHIPPING_API_KEY is not configured', async () => {
      delete process.env.SHIPPING_API_KEY

      const { getShippingClient } = await import('@/lib/shipping-api')

      expect(() => getShippingClient()).toThrow(
        'Shipping API key is not configured. Please set SHIPPING_API_KEY in your environment.'
      )
    })

    it('should default to easypost provider when SHIPPING_PROVIDER is not set', async () => {
      process.env.SHIPPING_API_KEY = 'EZAK_test_default'
      delete process.env.SHIPPING_PROVIDER

      const { getShippingClient } = await import('@/lib/shipping-api')
      const client = getShippingClient()

      expect(client.provider).toBe('easypost')
    })

    it('should return cached client on subsequent calls (singleton pattern)', async () => {
      process.env.SHIPPING_API_KEY = 'EZAK_test_singleton'

      const { getShippingClient } = await import('@/lib/shipping-api')

      const client1 = getShippingClient()
      const client2 = getShippingClient()
      const client3 = getShippingClient()

      expect(client1).toBe(client2)
      expect(client2).toBe(client3)
    })

    it('should detect test mode from SHIPPING_TEST_MODE environment variable', async () => {
      process.env.SHIPPING_API_KEY = 'EZAK_test_123456'
      process.env.SHIPPING_TEST_MODE = 'true'

      const { getShippingClient } = await import('@/lib/shipping-api')
      const client = getShippingClient()

      expect(client.testMode).toBe(true)
    })

    it('should initialize EasyPost SDK when getRates is called', async () => {
      process.env.SHIPPING_API_KEY = 'EZAK_test_init'

      createShipmentSpy.mockResolvedValue({
        rates: [
          {
            id: 'rate_test',
            carrier: 'USPS',
            service: 'Priority',
            rate: '9.49',
          },
        ],
      })

      const { getShippingClient } = await import('@/lib/shipping-api')
      const client = getShippingClient()

      await client.getRates({
        fromAddress: {
          street1: '123 Main St',
          city: 'San Francisco',
          state: 'CA',
          zip: '94111',
          country: 'US',
        },
        toAddress: {
          street1: '456 Oak Ave',
          city: 'Los Angeles',
          state: 'CA',
          zip: '90001',
          country: 'US',
        },
        parcel: {
          length: 10,
          width: 8,
          height: 4,
          weight: 16,
        },
      })

      // Verify EasyPost client was initialized with correct API key
      expect(easyPostConstructorSpy).toHaveBeenCalledWith('EZAK_test_init', {
        timeout: 60000,
      })
    })
  })

  describe('getShippingRates', () => {
    it('should fetch rates from EasyPost API', async () => {
      process.env.SHIPPING_API_KEY = 'EZAK_test_rates'

      // Mock successful EasyPost response
      const mockRates: Partial<Rate>[] = [
        {
          id: 'rate_usps',
          carrier: 'USPS',
          service: 'Priority',
          rate: '9.49',
          currency: 'USD',
          delivery_days: 2,
        },
        {
          id: 'rate_ups',
          carrier: 'UPS',
          service: 'Ground',
          rate: '12.99',
          currency: 'USD',
          delivery_days: 4,
        },
      ]

      createShipmentSpy.mockResolvedValue({
        rates: mockRates,
      })

      const { getShippingRates } = await import('@/lib/shipping-api')

      const result = await getShippingRates({
        fromAddress: {
          street1: '123 Main St',
          city: 'San Francisco',
          state: 'CA',
          zip: '94111',
          country: 'US',
        },
        toAddress: {
          street1: '456 Oak Ave',
          city: 'Los Angeles',
          state: 'CA',
          zip: '90001',
          country: 'US',
        },
        parcel: {
          length: 10,
          width: 8,
          height: 4,
          weight: 16,
        },
      })

      expect(result.rates).toHaveLength(2)
      expect(result.rates[0]).toMatchObject({
        carrier: 'USPS',
        service: 'Priority',
        rate: 9.49,
        currency: 'USD',
      })
      expect(result.rates[1]).toMatchObject({
        carrier: 'UPS',
        service: 'Ground',
        rate: 12.99,
      })
    })

    it('should return empty rates array when API call fails', async () => {
      process.env.SHIPPING_API_KEY = 'EZAK_test_error'

      createShipmentSpy.mockRejectedValue(new Error('API Error'))

      const { getShippingRates } = await import('@/lib/shipping-api')

      const result = await getShippingRates({
        fromAddress: {
          street1: '123 Main St',
          city: 'San Francisco',
          state: 'CA',
          zip: '94111',
          country: 'US',
        },
        toAddress: {
          street1: '456 Oak Ave',
          city: 'Los Angeles',
          state: 'CA',
          zip: '90001',
          country: 'US',
        },
        parcel: {
          length: 10,
          width: 8,
          height: 4,
          weight: 16,
        },
      })

      expect(result.rates).toEqual([])
      expect(result.messages).toBeDefined()
      expect(result.messages?.[0].type).toBe('error')
    })

    it('should sort rates by price (lowest first)', async () => {
      process.env.SHIPPING_API_KEY = 'EZAK_test_sort'

      const mockRates: Partial<Rate>[] = [
        {
          id: 'rate_expensive',
          carrier: 'FedEx',
          service: 'Express',
          rate: '25.99',
          currency: 'USD',
        },
        {
          id: 'rate_cheap',
          carrier: 'USPS',
          service: 'First Class',
          rate: '5.99',
          currency: 'USD',
        },
        {
          id: 'rate_medium',
          carrier: 'UPS',
          service: 'Ground',
          rate: '12.99',
          currency: 'USD',
        },
      ]

      createShipmentSpy.mockResolvedValue({
        rates: mockRates,
      })

      const { getShippingRates } = await import('@/lib/shipping-api')

      const result = await getShippingRates({
        fromAddress: {
          street1: '123 Main St',
          city: 'San Francisco',
          state: 'CA',
          zip: '94111',
          country: 'US',
        },
        toAddress: {
          street1: '456 Oak Ave',
          city: 'Los Angeles',
          state: 'CA',
          zip: '90001',
          country: 'US',
        },
        parcel: {
          length: 10,
          width: 8,
          height: 4,
          weight: 16,
        },
      })

      expect(result.rates[0].rate).toBe(5.99) // Cheapest first
      expect(result.rates[1].rate).toBe(12.99)
      expect(result.rates[2].rate).toBe(25.99) // Most expensive last
    })
  })

  describe('validateShippingConfiguration', () => {
    it('should return configured: false when SHIPPING_API_KEY is not set', async () => {
      delete process.env.SHIPPING_API_KEY

      const { validateShippingConfiguration } = await import(
        '@/lib/shipping-api'
      )
      const result = await validateShippingConfiguration()

      expect(result.configured).toBe(false)
      expect(result.error).toBe('SHIPPING_API_KEY is not set')
    })

    it('should return configured: true when API key is valid and rates are returned', async () => {
      process.env.SHIPPING_API_KEY = 'EZAK_test_valid'

      const mockRates: Partial<Rate>[] = [
        {
          id: 'rate_test',
          carrier: 'USPS',
          service: 'Priority',
          rate: '9.49',
          currency: 'USD',
        },
      ]

      createShipmentSpy.mockResolvedValue({
        rates: mockRates,
      })

      const { validateShippingConfiguration } = await import(
        '@/lib/shipping-api'
      )
      const result = await validateShippingConfiguration()

      expect(result.configured).toBe(true)
      expect(result.provider).toBe('easypost')
      expect(result.testMode).toBeDefined()
      expect(result.error).toBeUndefined()
    })

    it('should return configured: false when no rates are returned', async () => {
      process.env.SHIPPING_API_KEY = 'EZAK_test_no_rates'

      createShipmentSpy.mockResolvedValue({
        rates: [],
      })

      const { validateShippingConfiguration } = await import(
        '@/lib/shipping-api'
      )
      const result = await validateShippingConfiguration()

      expect(result.configured).toBe(false)
      expect(result.error).toBe('No rates returned from provider')
    })

    it('should return configured: false when API call throws an error', async () => {
      process.env.SHIPPING_API_KEY = 'EZAK_test_invalid'

      createShipmentSpy.mockRejectedValue(
        new Error('Invalid API key or configuration')
      )

      const { validateShippingConfiguration } = await import(
        '@/lib/shipping-api'
      )
      const result = await validateShippingConfiguration()

      expect(result.configured).toBe(false)
      // When API throws error, getRates returns empty array, which triggers this message
      expect(result.error).toBe('No rates returned from provider')
    })

    it('should perform a test shipment with correct parameters', async () => {
      process.env.SHIPPING_API_KEY = 'EZAK_test_params'

      createShipmentSpy.mockResolvedValue({
        rates: [
          {
            id: 'rate_test',
            carrier: 'USPS',
            service: 'Priority',
            rate: '9.49',
          },
        ],
      })

      const { validateShippingConfiguration } = await import(
        '@/lib/shipping-api'
      )
      await validateShippingConfiguration()

      expect(createShipmentSpy).toHaveBeenCalledWith(
        expect.objectContaining({
          from_address: expect.objectContaining({
            street1: '123 Main St',
            city: 'San Francisco',
            state: 'CA',
            zip: '94111',
            country: 'US',
          }),
          to_address: expect.objectContaining({
            street1: '456 Oak Ave',
            city: 'Los Angeles',
            state: 'CA',
            zip: '90001',
            country: 'US',
          }),
          parcel: expect.objectContaining({
            length: 10,
            width: 8,
            height: 4,
            weight: 16,
          }),
        })
      )
    })
  })
})
