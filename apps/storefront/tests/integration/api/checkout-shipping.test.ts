import { describe, it, expect, vi, beforeEach } from 'vitest'
import { POST } from '@/app/api/checkout/calculate-shipping/route'

// Mock dependencies
vi.mock('@/lib/shipping-calculator', () => ({
  calculateShipping: vi.fn(),
}))

vi.mock('@/lib/prisma', () => ({
  default: {
    product: {
      findMany: vi.fn(),
    },
  },
}))

describe('Checkout Shipping Calculation API Integration Tests', () => {
  beforeEach(async () => {
    vi.clearAllMocks()
    // Reset modules to clear the shipping cache between tests
    await vi.resetModules()
  })

  const validShippingRequest = {
    items: [
      {
        productId: 'clxxx1234567890abc',
        quantity: 2,
      },
    ],
    shippingAddress: {
      address1: '123 Main St',
      address2: 'Apt 4',
      city: 'Los Angeles',
      state: 'CA',
      postalCode: '90001',
      country: 'US',
    },
  }

  const mockProducts = [
    {
      id: 'clxxx1234567890abc',
      price: 8.99,
      weight: 1.5,
    },
  ]

  const mockShippingResult = {
    shippingCost: 8.99,
    shippingMethod: 'USPS Ground Advantage',
    estimatedDelivery: '3-5 business days',
    availableOptions: [
      {
        method: 'USPS Ground Advantage',
        cost: 8.99,
        estimatedDays: '3-5 business days',
      },
      {
        method: 'USPS Priority Mail',
        cost: 14.99,
        estimatedDays: '1-3 business days',
      },
    ],
  }

  describe('Shipping Calculation Flow', () => {
    it('should calculate shipping for valid request with real carrier rates', async () => {
      const { calculateShipping } = await import('@/lib/shipping-calculator')
      const prisma = (await import('@/lib/prisma')).default

      vi.mocked(prisma.product.findMany).mockResolvedValue(mockProducts)
      vi.mocked(calculateShipping).mockResolvedValue(mockShippingResult)

      const request = new Request('http://localhost/api/checkout/calculate-shipping', {
        method: 'POST',
        body: JSON.stringify(validShippingRequest),
      })

      const response = await POST(request)
      const data = await response.json()

      expect(response.status).toBe(200)
      expect(data.success).toBe(true)
      expect(data.subtotal).toBe(17.98) // 8.99 * 2
      expect(data.shippingCost).toBe(8.99)
      expect(data.shippingMethod).toBe('USPS Ground Advantage')
      expect(data.estimatedDelivery).toBe('3-5 business days')
      expect(data.availableOptions).toHaveLength(2)
      expect(data.availableOptions[0].method).toBe('USPS Ground Advantage')
      expect(data.availableOptions[1].method).toBe('USPS Priority Mail')
      expect(data.fallback).toBe(false) // fallback defaults to false when using real rates

      // Verify prisma was called to fetch product details
      expect(prisma.product.findMany).toHaveBeenCalledWith({
        where: { id: { in: ['clxxx1234567890abc'] } },
        select: {
          id: true,
          price: true,
          weight: true,
        },
      })

      // Verify shipping calculator was called with correct parameters
      expect(calculateShipping).toHaveBeenCalledWith({
        items: [
          {
            weight: 1.5,
            quantity: 2,
          },
        ],
        shippingAddress: {
          line1: '123 Main St',
          line2: 'Apt 4',
          city: 'Los Angeles',
          state: 'CA',
          postalCode: '90001',
          country: 'US',
        },
        subtotal: 17.98,
      })
    })

    it('should handle multiple items with different weights', async () => {
      const { calculateShipping } = await import('@/lib/shipping-calculator')
      const prisma = (await import('@/lib/prisma')).default

      const multiItemRequest = {
        ...validShippingRequest,
        items: [
          {
            productId: 'clxxx1234567890abc',
            quantity: 2,
          },
          {
            productId: 'clxxx0987654321xyz',
            quantity: 1,
          },
        ],
      }

      const multiProducts = [
        {
          id: 'clxxx1234567890abc',
          price: 8.99,
          weight: 1.5,
        },
        {
          id: 'clxxx0987654321xyz',
          price: 12.99,
          weight: 2.0,
        },
      ]

      vi.mocked(prisma.product.findMany).mockResolvedValue(multiProducts)
      vi.mocked(calculateShipping).mockResolvedValue({
        shippingCost: 12.99,
        shippingMethod: 'USPS Ground Advantage',
        estimatedDelivery: '3-5 business days',
        availableOptions: mockShippingResult.availableOptions,
      })

      const request = new Request('http://localhost/api/checkout/calculate-shipping', {
        method: 'POST',
        body: JSON.stringify(multiItemRequest),
      })

      const response = await POST(request)
      const data = await response.json()

      expect(response.status).toBe(200)
      expect(data.success).toBe(true)
      expect(data.subtotal).toBe(30.97) // (8.99 * 2) + (12.99 * 1)
      expect(data.shippingCost).toBe(12.99)

      // Verify shipping was calculated with combined weights
      expect(calculateShipping).toHaveBeenCalledWith({
        items: [
          { weight: 1.5, quantity: 2 },
          { weight: 2.0, quantity: 1 },
        ],
        shippingAddress: expect.any(Object),
        subtotal: 30.97,
      })
    })

    it('should use default weight when product weight is not provided', async () => {
      const prisma = (await import('@/lib/prisma')).default
      const { calculateShipping } = await import('@/lib/shipping-calculator')

      const productsWithoutWeight = [
        {
          id: 'clxxx1234567890abc',
          price: 8.99,
          weight: null, // No weight specified
        },
      ]

      vi.mocked(prisma.product.findMany).mockResolvedValue(productsWithoutWeight)
      vi.mocked(calculateShipping).mockResolvedValue(mockShippingResult)

      const { POST } = await import('@/app/api/checkout/calculate-shipping/route')

      const request = new Request('http://localhost/api/checkout/calculate-shipping', {
        method: 'POST',
        body: JSON.stringify(validShippingRequest),
      })

      const response = await POST(request)
      const data = await response.json()

      expect(response.status).toBe(200)
      expect(data.success).toBe(true)

      // Verify default weight of 1.0 lb was used
      expect(calculateShipping).toHaveBeenCalledWith({
        items: [
          { weight: 1.0, quantity: 2 }, // Default weight
        ],
        shippingAddress: expect.any(Object),
        subtotal: 17.98,
      })
    })

    it('should handle missing product by using defaults', async () => {
      const prisma = (await import('@/lib/prisma')).default
      const { calculateShipping } = await import('@/lib/shipping-calculator')

      // Product not found in database
      vi.mocked(prisma.product.findMany).mockResolvedValue([])
      vi.mocked(calculateShipping).mockResolvedValue(mockShippingResult)

      const { POST } = await import('@/app/api/checkout/calculate-shipping/route')

      const request = new Request('http://localhost/api/checkout/calculate-shipping', {
        method: 'POST',
        body: JSON.stringify(validShippingRequest),
      })

      const response = await POST(request)
      const data = await response.json()

      expect(response.status).toBe(200)
      expect(data.success).toBe(true)
      // When products aren't found, route uses defaults but subtotal is 0
      expect(data.subtotal).toBe(0)

      // Verify default weight was used
      expect(calculateShipping).toHaveBeenCalledWith({
        items: [
          { weight: 1.0, quantity: 2 }, // Default weight
        ],
        shippingAddress: expect.any(Object),
        subtotal: 0,
      })
    })

    it('should return fallback rates when shipping calculator returns fallback', async () => {
      const prisma = (await import('@/lib/prisma')).default
      const { calculateShipping } = await import('@/lib/shipping-calculator')

      vi.mocked(prisma.product.findMany).mockResolvedValue(mockProducts)
      vi.mocked(calculateShipping).mockResolvedValue({
        shippingCost: 6.99,
        shippingMethod: 'Standard Shipping (Estimate)',
        estimatedDelivery: '3-5 business days',
        availableOptions: [
          {
            method: 'Standard Shipping (Estimate)',
            cost: 6.99,
            estimatedDays: '3-5 business days',
          },
        ],
        fallback: true, // API failed, using fallback
      })

      const { POST } = await import('@/app/api/checkout/calculate-shipping/route')

      const request = new Request('http://localhost/api/checkout/calculate-shipping', {
        method: 'POST',
        body: JSON.stringify(validShippingRequest),
      })

      const response = await POST(request)
      const data = await response.json()

      expect(response.status).toBe(200)
      expect(data.success).toBe(true)
      expect(data.fallback).toBe(true)
      expect(data.shippingCost).toBe(6.99)
      expect(data.shippingMethod).toContain('Estimate')
    })

    it('should return cached result for identical request', async () => {
      const prisma = (await import('@/lib/prisma')).default
      const { calculateShipping } = await import('@/lib/shipping-calculator')

      vi.mocked(prisma.product.findMany).mockResolvedValue(mockProducts)
      vi.mocked(calculateShipping).mockResolvedValue(mockShippingResult)

      const { POST } = await import('@/app/api/checkout/calculate-shipping/route')

      // First request
      const request1 = new Request('http://localhost/api/checkout/calculate-shipping', {
        method: 'POST',
        body: JSON.stringify(validShippingRequest),
      })

      const response1 = await POST(request1)
      const data1 = await response1.json()

      expect(response1.status).toBe(200)
      expect(data1.success).toBe(true)
      expect(calculateShipping).toHaveBeenCalledTimes(1)

      // Second identical request should hit cache
      const request2 = new Request('http://localhost/api/checkout/calculate-shipping', {
        method: 'POST',
        body: JSON.stringify(validShippingRequest),
      })

      const response2 = await POST(request2)
      const data2 = await response2.json()

      expect(response2.status).toBe(200)
      expect(data2.success).toBe(true)
      expect(data2.shippingCost).toBe(data1.shippingCost)
      // Should still only be called once (second request used cache)
      expect(calculateShipping).toHaveBeenCalledTimes(1)
    })
  })

  describe('Validation', () => {
    it('should reject empty items array', async () => {
      const invalidRequest = {
        ...validShippingRequest,
        items: [],
      }

      const request = new Request('http://localhost/api/checkout/calculate-shipping', {
        method: 'POST',
        body: JSON.stringify(invalidRequest),
      })

      const response = await POST(request)
      const data = await response.json()

      expect(response.status).toBe(400)
      expect(data.error).toBe('Invalid shipping calculation request')
      expect(data.details.fieldErrors.items).toBeDefined()
    })

    it('should reject invalid productId format', async () => {
      const invalidRequest = {
        ...validShippingRequest,
        items: [
          {
            productId: 'invalid-id', // Not a CUID
            quantity: 2,
          },
        ],
      }

      const request = new Request('http://localhost/api/checkout/calculate-shipping', {
        method: 'POST',
        body: JSON.stringify(invalidRequest),
      })

      const response = await POST(request)
      const data = await response.json()

      expect(response.status).toBe(400)
      expect(data.error).toBe('Invalid shipping calculation request')
    })

    it('should reject invalid quantity', async () => {
      const invalidRequest = {
        ...validShippingRequest,
        items: [
          {
            productId: 'clxxx1234567890abc',
            quantity: -1, // Negative quantity
          },
        ],
      }

      const request = new Request('http://localhost/api/checkout/calculate-shipping', {
        method: 'POST',
        body: JSON.stringify(invalidRequest),
      })

      const response = await POST(request)
      const data = await response.json()

      expect(response.status).toBe(400)
      expect(data.error).toBe('Invalid shipping calculation request')
    })

    it('should reject missing required address fields', async () => {
      const invalidRequest = {
        items: validShippingRequest.items,
        shippingAddress: {
          address1: '123 Main St',
          // Missing city, state, postalCode
        },
      }

      const request = new Request('http://localhost/api/checkout/calculate-shipping', {
        method: 'POST',
        body: JSON.stringify(invalidRequest),
      })

      const response = await POST(request)
      const data = await response.json()

      expect(response.status).toBe(400)
      expect(data.error).toBe('Invalid shipping calculation request')
      expect(data.details.fieldErrors.shippingAddress).toBeDefined()
    })

    it('should reject invalid postal code', async () => {
      const invalidRequest = {
        ...validShippingRequest,
        shippingAddress: {
          ...validShippingRequest.shippingAddress,
          postalCode: '123', // Too short
        },
      }

      const request = new Request('http://localhost/api/checkout/calculate-shipping', {
        method: 'POST',
        body: JSON.stringify(invalidRequest),
      })

      const response = await POST(request)
      const data = await response.json()

      expect(response.status).toBe(400)
      expect(data.error).toBe('Invalid shipping calculation request')
    })

    it('should accept optional address2 field', async () => {
      const { calculateShipping } = await import('@/lib/shipping-calculator')
      const prisma = (await import('@/lib/prisma')).default

      vi.mocked(prisma.product.findMany).mockResolvedValue(mockProducts)
      vi.mocked(calculateShipping).mockResolvedValue(mockShippingResult)

      const requestNoAddress2 = {
        ...validShippingRequest,
        shippingAddress: {
          address1: '123 Main St',
          city: 'Los Angeles',
          state: 'CA',
          postalCode: '90001',
          country: 'US',
          // address2 omitted
        },
      }

      const request = new Request('http://localhost/api/checkout/calculate-shipping', {
        method: 'POST',
        body: JSON.stringify(requestNoAddress2),
      })

      const response = await POST(request)
      const data = await response.json()

      expect(response.status).toBe(200)
      expect(data.success).toBe(true)
    })

    it('should default country to US if not provided', async () => {
      const prisma = (await import('@/lib/prisma')).default
      const { calculateShipping } = await import('@/lib/shipping-calculator')

      vi.mocked(prisma.product.findMany).mockResolvedValue(mockProducts)
      vi.mocked(calculateShipping).mockResolvedValue(mockShippingResult)

      const { POST } = await import('@/app/api/checkout/calculate-shipping/route')

      const requestNoCountry = {
        items: validShippingRequest.items,
        shippingAddress: {
          address1: '123 Main St',
          city: 'Los Angeles',
          state: 'CA',
          postalCode: '90001',
          // country omitted - should default to US
        },
      }

      const request = new Request('http://localhost/api/checkout/calculate-shipping', {
        method: 'POST',
        body: JSON.stringify(requestNoCountry),
      })

      const response = await POST(request)
      const data = await response.json()

      expect(response.status).toBe(200)
      expect(data.success).toBe(true)

      // Verify country defaulted to US
      expect(calculateShipping).toHaveBeenCalledWith({
        items: expect.any(Array),
        shippingAddress: expect.objectContaining({
          country: 'US',
        }),
        subtotal: expect.any(Number),
      })
    })
  })

  describe('Error Handling', () => {
    it('should return fallback rates when shipping calculator throws error', async () => {
      const prisma = (await import('@/lib/prisma')).default
      const { calculateShipping } = await import('@/lib/shipping-calculator')

      vi.mocked(prisma.product.findMany).mockResolvedValue(mockProducts)
      vi.mocked(calculateShipping).mockRejectedValue(new Error('Carrier API unavailable'))

      const { POST } = await import('@/app/api/checkout/calculate-shipping/route')

      const request = new Request('http://localhost/api/checkout/calculate-shipping', {
        method: 'POST',
        body: JSON.stringify(validShippingRequest),
      })

      const response = await POST(request)
      const data = await response.json()

      // Should still return 200 with fallback rates to not block checkout
      expect(response.status).toBe(200)
      expect(data.success).toBe(false)
      expect(data.fallback).toBe(true)
      expect(data.shippingCost).toBe(6.99) // Fallback flat rate
      expect(data.shippingMethod).toContain('Estimate')
      expect(data.error).toBe('Unable to calculate exact shipping cost')
    })

    it('should return fallback rates when prisma query fails', async () => {
      const prisma = (await import('@/lib/prisma')).default
      const { calculateShipping } = await import('@/lib/shipping-calculator')

      vi.mocked(prisma.product.findMany).mockRejectedValue(new Error('Database error'))
      vi.mocked(calculateShipping).mockResolvedValue(mockShippingResult)

      const { POST } = await import('@/app/api/checkout/calculate-shipping/route')

      const request = new Request('http://localhost/api/checkout/calculate-shipping', {
        method: 'POST',
        body: JSON.stringify(validShippingRequest),
      })

      const response = await POST(request)
      const data = await response.json()

      // Should return 200 with fallback rates to not block checkout
      expect(response.status).toBe(200)
      expect(data.success).toBe(false)
      expect(data.fallback).toBe(true)
      expect(data.shippingCost).toBe(6.99)
    })

    it('should handle malformed JSON request', async () => {
      const request = new Request('http://localhost/api/checkout/calculate-shipping', {
        method: 'POST',
        body: 'not valid json',
      })

      const response = await POST(request)
      const data = await response.json()

      expect(response.status).toBe(200)
      expect(data.success).toBe(false)
      expect(data.fallback).toBe(true)
    })
  })
})
