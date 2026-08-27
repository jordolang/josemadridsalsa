import { describe, it, expect, vi, beforeEach } from 'vitest'
import { POST } from '@/app/api/checkout/calculate-tax/route'
import { prisma } from '@/lib/prisma'

// Mock dependencies
vi.mock('@/lib/tax-calculator', () => ({
  calculateTax: vi.fn(),
}))

// Only the rate call is stubbed. `buildShippingItems` is pure mapping — the thing that turns
// catalogue rows into parcel weights and dimensions — so the real one is kept, and a unit
// mistake in it fails these tests rather than being mocked away.
vi.mock('@/lib/shipping-calculator', async (importOriginal) => ({
  ...(await importOriginal<typeof import('@/lib/shipping-calculator')>()),
  calculateShipping: vi.fn(),
}))

// The route reads parcel weight and dimensions from the catalogue rather than the request. It used
// to accept a client-supplied `weight`, which our own checkout never sent and which would have let
// a caller understate the parcel to quote itself cheaper shipping.
vi.mock('@/lib/prisma', () => ({
  prisma: {
    product: { findMany: vi.fn() },
  },
}))

describe('Checkout Tax Calculation API Integration Tests', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    // Default catalogue: one 1.5oz product, matching `validTaxRequest`.
    vi.mocked(prisma.product.findMany).mockResolvedValue([
      {
        id: 'clxxx1234567890abc',
        weight: 1.5,
        lengthInches: null,
        widthInches: null,
        heightInches: null,
      },
      {
        id: 'clxxx0987654321xyz',
        weight: 2.0,
        lengthInches: null,
        widthInches: null,
        heightInches: null,
      },
    ] as never)
  })

  const validTaxRequest = {
    items: [
      {
        productId: 'clxxx1234567890abc',
        quantity: 2,
        price: 8.99,
        weight: 1.5,
      },
    ],
    shippingAddress: {
      address1: '123 Main St',
      address2: 'Apt 4',
      city: 'Portland',
      state: 'OR',
      postalCode: '97201',
      country: 'US',
    },
  }

  const mockTaxResult = {
    taxAmountDecimal: 2.5,
    taxRate: 0.08,
    taxBreakdown: [
      {
        jurisdiction: 'Oregon',
        rate: 0.08,
        amount: 2.5,
      },
    ],
  }

  const mockShippingResult = {
    shippingCost: 8.99,
    shippingMethod: 'Standard Shipping',
    estimatedDelivery: '5-7 business days',
  }

  describe('Tax Calculation Flow', () => {
    it('should calculate tax and shipping for valid request', async () => {
      const { calculateTax } = await import('@/lib/tax-calculator')
      const { calculateShipping } = await import('@/lib/shipping-calculator')

      vi.mocked(calculateTax).mockResolvedValue(mockTaxResult)
      vi.mocked(calculateShipping).mockReturnValue(mockShippingResult)

      const request = new Request('http://localhost/api/checkout/calculate-tax', {
        method: 'POST',
        body: JSON.stringify(validTaxRequest),
      })

      const response = await POST(request)
      const data = await response.json()

      expect(response.status).toBe(200)
      expect(data.success).toBe(true)
      expect(data.subtotal).toBe(17.98) // 8.99 * 2
      expect(data.tax).toBe(2.5)
      expect(data.taxRate).toBe(0.08)
      expect(data.taxBreakdown).toEqual(mockTaxResult.taxBreakdown)
      expect(data.shippingCost).toBe(8.99)
      expect(data.shippingMethod).toBe('Standard Shipping')
      expect(data.estimatedDelivery).toBe('5-7 business days')
      expect(data.total).toBe(29.47) // 17.98 + 2.5 + 8.99

      // Verify tax calculator was called with correct parameters
      expect(calculateTax).toHaveBeenCalledWith({
        lineItems: [
          {
            amount: 1798, // $17.98 in cents
            // Suffixed by line, so a salsa bought loose and in a pack stays two references.
            reference: 'clxxx1234567890abc-0',
            taxCode: 'txcd_30011000', // Food & beverage
          },
        ],
        shippingAddress: {
          line1: '123 Main St',
          line2: 'Apt 4',
          city: 'Portland',
          state: 'OR',
          postalCode: '97201',
          country: 'US',
        },
      })

      // Verify shipping calculator was called with correct parameters
      expect(calculateShipping).toHaveBeenCalledWith({
        items: [
          {
            weightOz: 1.5,
            quantity: 2,
          },
        ],
        shippingAddress: {
          state: 'OR',
          postalCode: '97201',
          country: 'US',
        },
        subtotal: 17.98,
      })
    })

    it('should handle multiple items with different weights', async () => {
      const { calculateTax } = await import('@/lib/tax-calculator')
      const { calculateShipping } = await import('@/lib/shipping-calculator')

      const multiItemRequest = {
        ...validTaxRequest,
        items: [
          {
            productId: 'clxxx1234567890abc',
            quantity: 2,
            price: 8.99,
            weight: 1.5,
          },
          {
            productId: 'clxxx0987654321xyz',
            quantity: 1,
            price: 12.99,
            weight: 2.0,
          },
        ],
      }

      vi.mocked(calculateTax).mockResolvedValue({
        taxAmountDecimal: 3.5,
        taxRate: 0.08,
        taxBreakdown: mockTaxResult.taxBreakdown,
      })
      vi.mocked(calculateShipping).mockReturnValue({
        shippingCost: 12.99,
        shippingMethod: 'Standard Shipping',
        estimatedDelivery: '5-7 business days',
      })

      const request = new Request('http://localhost/api/checkout/calculate-tax', {
        method: 'POST',
        body: JSON.stringify(multiItemRequest),
      })

      const response = await POST(request)
      const data = await response.json()

      expect(response.status).toBe(200)
      expect(data.success).toBe(true)
      expect(data.subtotal).toBe(30.97) // (8.99 * 2) + (12.99 * 1)
      expect(data.tax).toBe(3.5)
      expect(data.shippingCost).toBe(12.99)
      expect(data.total).toBe(47.46) // 30.97 + 3.5 + 12.99

      // Verify shipping was calculated with combined weights
      expect(calculateShipping).toHaveBeenCalledWith({
        items: [
          { weightOz: 1.5, quantity: 2 },
          { weightOz: 2.0, quantity: 1 },
        ],
        shippingAddress: expect.any(Object),
        subtotal: 30.97,
      })
    })

    it('should use default weight when not provided', async () => {
      const { calculateTax } = await import('@/lib/tax-calculator')
      const { calculateShipping } = await import('@/lib/shipping-calculator')

      const requestNoWeight = {
        items: [
          {
            productId: 'clxxx1234567890abc',
            quantity: 2,
            price: 8.99,
          },
        ],
        shippingAddress: validTaxRequest.shippingAddress,
      }

      // The weight is absent from the *catalogue* now, not from the request — the route stopped
      // accepting a client-supplied one. A null column is what makes the default apply.
      vi.mocked(prisma.product.findMany).mockResolvedValue([
        {
          id: 'clxxx1234567890abc',
          weight: null,
          lengthInches: null,
          widthInches: null,
          heightInches: null,
        },
      ] as never)

      vi.mocked(calculateTax).mockResolvedValue(mockTaxResult)
      vi.mocked(calculateShipping).mockReturnValue(mockShippingResult)

      const request = new Request('http://localhost/api/checkout/calculate-tax', {
        method: 'POST',
        body: JSON.stringify(requestNoWeight),
      })

      const response = await POST(request)
      const data = await response.json()

      expect(response.status).toBe(200)
      expect(data.success).toBe(true)

      // Verify default weight of 1.0 lb was used
      expect(calculateShipping).toHaveBeenCalledWith({
        items: [
          {
            weightOz: undefined, // no catalogue weight; the calculator applies the documented default
            quantity: 2,
          },
        ],
        shippingAddress: expect.any(Object),
        subtotal: expect.any(Number),
      })
    })

    it('should calculate tax for different states', async () => {
      const { calculateTax } = await import('@/lib/tax-calculator')
      const { calculateShipping } = await import('@/lib/shipping-calculator')

      const californiaRequest = {
        ...validTaxRequest,
        shippingAddress: {
          address1: '456 Oak Ave',
          city: 'Los Angeles',
          state: 'CA',
          postalCode: '90001',
          country: 'US',
        },
      }

      vi.mocked(calculateTax).mockResolvedValue({
        taxAmountDecimal: 1.8,
        taxRate: 0.1, // Higher CA tax rate
        taxBreakdown: [
          {
            jurisdiction: 'California',
            rate: 0.1,
            amount: 1.8,
          },
        ],
      })
      vi.mocked(calculateShipping).mockReturnValue(mockShippingResult)

      const request = new Request('http://localhost/api/checkout/calculate-tax', {
        method: 'POST',
        body: JSON.stringify(californiaRequest),
      })

      const response = await POST(request)
      const data = await response.json()

      expect(response.status).toBe(200)
      expect(data.success).toBe(true)
      expect(data.tax).toBe(1.8)
      expect(data.taxRate).toBe(0.1)

      // Verify tax calculator was called with CA address
      expect(calculateTax).toHaveBeenCalledWith(
        expect.objectContaining({
          shippingAddress: expect.objectContaining({
            state: 'CA',
            postalCode: '90001',
          }),
        })
      )
    })

    it('should validate request payload', async () => {
      const invalidPayloads = [
        {}, // Empty
        { items: [] }, // Empty items
        {
          items: [{ productId: 'invalid', quantity: 0, price: 8.99 }], // Zero quantity
          shippingAddress: validTaxRequest.shippingAddress,
        },
        {
          items: [{ productId: 'clxxx123', quantity: 1, price: -5 }], // Negative price
          shippingAddress: validTaxRequest.shippingAddress,
        },
        {
          items: validTaxRequest.items,
          shippingAddress: {}, // Invalid address
        },
        {
          items: validTaxRequest.items,
          shippingAddress: {
            address1: '',
            city: 'Portland',
            state: 'OR',
            postalCode: '97201',
          }, // Empty address1
        },
        {
          items: validTaxRequest.items,
          shippingAddress: {
            address1: '123 Main St',
            city: '',
            state: 'OR',
            postalCode: '97201',
          }, // Empty city
        },
        {
          items: validTaxRequest.items,
          shippingAddress: {
            address1: '123 Main St',
            city: 'Portland',
            state: 'O', // Too short
            postalCode: '97201',
          },
        },
        {
          items: validTaxRequest.items,
          shippingAddress: {
            address1: '123 Main St',
            city: 'Portland',
            state: 'OR',
            postalCode: '972', // Too short
          },
        },
      ]

      for (const payload of invalidPayloads) {
        const request = new Request('http://localhost/api/checkout/calculate-tax', {
          method: 'POST',
          body: JSON.stringify(payload),
        })

        const response = await POST(request)
        const data = await response.json()

        expect(response.status).toBe(400)
        expect(data.error).toBe('Invalid tax calculation request')
        expect(data.details).toBeDefined()
      }
    })

    it('should handle tax calculation API errors', async () => {
      const { calculateTax } = await import('@/lib/tax-calculator')
      const { calculateShipping } = await import('@/lib/shipping-calculator')

      vi.mocked(calculateTax).mockRejectedValue(new Error('Stripe Tax API error'))
      vi.mocked(calculateShipping).mockReturnValue(mockShippingResult)

      const request = new Request('http://localhost/api/checkout/calculate-tax', {
        method: 'POST',
        body: JSON.stringify(validTaxRequest),
      })

      const response = await POST(request)
      const data = await response.json()

      expect(response.status).toBe(500)
      expect(data.error).toBe('Unable to calculate tax')
      expect(data.message).toBe('Stripe Tax API error')

      // Should return fallback values
      expect(data.subtotal).toBe(0)
      expect(data.tax).toBe(0)
      expect(data.taxRate).toBe(0)
      expect(data.taxBreakdown).toEqual([])
      expect(data.shippingCost).toBe(0)
      expect(data.total).toBe(0)
    })

    it('should handle shipping calculation errors gracefully', async () => {
      const { calculateTax } = await import('@/lib/tax-calculator')
      const { calculateShipping } = await import('@/lib/shipping-calculator')

      vi.mocked(calculateTax).mockResolvedValue(mockTaxResult)
      vi.mocked(calculateShipping).mockImplementation(() => {
        throw new Error('Shipping service unavailable')
      })

      const request = new Request('http://localhost/api/checkout/calculate-tax', {
        method: 'POST',
        body: JSON.stringify(validTaxRequest),
      })

      const response = await POST(request)
      const data = await response.json()

      // Should return error with fallback values
      expect(response.status).toBe(500)
      expect(data.error).toBe('Unable to calculate tax')
      expect(data.subtotal).toBe(0)
      expect(data.shippingCost).toBe(0)
      expect(data.total).toBe(0)
    })

    it('should handle international addresses with default country', async () => {
      const { calculateTax } = await import('@/lib/tax-calculator')
      const { calculateShipping } = await import('@/lib/shipping-calculator')

      const requestNoCountry = {
        items: validTaxRequest.items,
        shippingAddress: {
          address1: '123 Main St',
          city: 'Portland',
          state: 'OR',
          postalCode: '97201',
          // country not provided - should default to 'US'
        },
      }

      vi.mocked(calculateTax).mockResolvedValue(mockTaxResult)
      vi.mocked(calculateShipping).mockReturnValue(mockShippingResult)

      const request = new Request('http://localhost/api/checkout/calculate-tax', {
        method: 'POST',
        body: JSON.stringify(requestNoCountry),
      })

      const response = await POST(request)
      const data = await response.json()

      expect(response.status).toBe(200)
      expect(data.success).toBe(true)

      // Verify default country 'US' was used
      expect(calculateTax).toHaveBeenCalledWith(
        expect.objectContaining({
          shippingAddress: expect.objectContaining({
            country: 'US',
          }),
        })
      )

      expect(calculateShipping).toHaveBeenCalledWith(
        expect.objectContaining({
          shippingAddress: expect.objectContaining({
            country: 'US',
          }),
        })
      )
    })

    it('should handle large order totals correctly', async () => {
      const { calculateTax } = await import('@/lib/tax-calculator')
      const { calculateShipping } = await import('@/lib/shipping-calculator')

      const largeOrderRequest = {
        ...validTaxRequest,
        items: [
          {
            productId: 'clxxx1234567890abc',
            quantity: 100, // Large quantity
            price: 50.0, // Expensive item
            weight: 1.5,
          },
        ],
      }

      vi.mocked(calculateTax).mockResolvedValue({
        taxAmountDecimal: 400.0,
        taxRate: 0.08,
        taxBreakdown: mockTaxResult.taxBreakdown,
      })
      vi.mocked(calculateShipping).mockReturnValue({
        shippingCost: 150.0, // Higher shipping for large order
        shippingMethod: 'Freight',
        estimatedDelivery: '10-14 business days',
      })

      const request = new Request('http://localhost/api/checkout/calculate-tax', {
        method: 'POST',
        body: JSON.stringify(largeOrderRequest),
      })

      const response = await POST(request)
      const data = await response.json()

      expect(response.status).toBe(200)
      expect(data.success).toBe(true)
      expect(data.subtotal).toBe(5000.0) // 50 * 100
      expect(data.tax).toBe(400.0)
      expect(data.shippingCost).toBe(150.0)
      expect(data.total).toBe(5550.0) // 5000 + 400 + 150

      // Verify line items were calculated in cents
      expect(calculateTax).toHaveBeenCalledWith(
        expect.objectContaining({
          lineItems: [
            {
              amount: 500000, // $5000 in cents
              reference: 'clxxx1234567890abc-0',
              taxCode: 'txcd_30011000',
            },
          ],
        })
      )
    })

    it('should preserve address2 as optional', async () => {
      const { calculateTax } = await import('@/lib/tax-calculator')
      const { calculateShipping } = await import('@/lib/shipping-calculator')

      const requestNoAddress2 = {
        items: validTaxRequest.items,
        shippingAddress: {
          address1: '123 Main St',
          // address2 omitted
          city: 'Portland',
          state: 'OR',
          postalCode: '97201',
          country: 'US',
        },
      }

      vi.mocked(calculateTax).mockResolvedValue(mockTaxResult)
      vi.mocked(calculateShipping).mockReturnValue(mockShippingResult)

      const request = new Request('http://localhost/api/checkout/calculate-tax', {
        method: 'POST',
        body: JSON.stringify(requestNoAddress2),
      })

      const response = await POST(request)
      const data = await response.json()

      expect(response.status).toBe(200)
      expect(data.success).toBe(true)

      // Verify address2 is undefined (not passed)
      expect(calculateTax).toHaveBeenCalledWith(
        expect.objectContaining({
          shippingAddress: expect.objectContaining({
            line1: '123 Main St',
            line2: undefined,
          }),
        })
      )
    })

    it('should round amounts to cents correctly', async () => {
      const { calculateTax } = await import('@/lib/tax-calculator')
      const { calculateShipping } = await import('@/lib/shipping-calculator')

      const requestWithDecimals = {
        ...validTaxRequest,
        items: [
          {
            productId: 'clxxx1234567890abc',
            quantity: 3,
            price: 9.99, // Price with decimals
            weight: 1.5,
          },
        ],
      }

      vi.mocked(calculateTax).mockResolvedValue(mockTaxResult)
      vi.mocked(calculateShipping).mockReturnValue(mockShippingResult)

      const request = new Request('http://localhost/api/checkout/calculate-tax', {
        method: 'POST',
        body: JSON.stringify(requestWithDecimals),
      })

      const response = await POST(request)
      const data = await response.json()

      expect(response.status).toBe(200)
      expect(data.success).toBe(true)
      expect(data.subtotal).toBe(29.97) // 9.99 * 3

      // Verify amount was correctly converted to cents
      expect(calculateTax).toHaveBeenCalledWith(
        expect.objectContaining({
          lineItems: [
            {
              amount: 2997, // $29.97 rounded to cents
              reference: 'clxxx1234567890abc-0',
              taxCode: 'txcd_30011000',
            },
          ],
        })
      )
    })
  })
})
