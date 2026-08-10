/**
 * Shipping Calculator Tests
 * José Madrid Salsa E-commerce Platform
 */

import { describe, it, expect } from 'vitest'
import {
  calculateOrderParcel,
  OUNCES_PER_POUND,
  calculateShipping,
  getShippingEstimate,
  validateShippingAddress,
} from '@/lib/shipping-calculator'

/**
 * Written when `ShippingItem.weight` meant **pounds**. The field is now `weightOz` in ounces —
 * `Product.weight` was always ounces, and both rate paths treating it as pounds is what made every
 * quote 16× overweight. Each literal below is converted (× 16) rather than the expectations being
 * loosened, so the suite still pins the same physical parcels.
 */
/**
 * The estimate-path cost for a set of items, derived from the calculator's own parcel model and the
 * documented rate constants.
 *
 * Used instead of a hardcoded dollar figure wherever the weight surcharge bites, because the parcel
 * weight now includes the physical packaging — glass, lid, dividers, box — and `JAR_TARE_OZ` is
 * explicitly a number to correct against a real scale. Hardcoding the total would mean a truer tare
 * breaks the suite.
 */
function expectedEstimateCost(
  items: Parameters<typeof calculateOrderParcel>[0],
  stateMultiplier = 1
): number {
  const FLAT = 6.99
  const BASE = 4.99
  const PER_LB = 0.5
  const THRESHOLD_LB = 5

  const pounds = calculateOrderParcel(items).weight / OUNCES_PER_POUND
  const base =
    pounds > THRESHOLD_LB ? Math.max(FLAT, BASE + (pounds - THRESHOLD_LB) * PER_LB) : FLAT
  return parseFloat((base * stateMultiplier).toFixed(2))
}

describe('Shipping Calculator', () => {
  describe('calculateShipping', () => {
    it('should return free shipping for orders over $50', async () => {
      const result = await calculateShipping({
        items: [{ quantity: 1, weightOz: 32 }],
        shippingAddress: {
          state: 'CA',
          postalCode: '94111',
          country: 'US',
        },
        subtotal: 75.0,
      })

      expect(result).toMatchObject({
        shippingCost: 0,
        shippingMethod: 'Free Shipping',
        estimatedDelivery: '3-5 business days',
      })
    })

    it('should return free shipping for orders exactly at $50 threshold', async () => {
      const result = await calculateShipping({
        items: [{ quantity: 1, weightOz: 32 }],
        shippingAddress: {
          state: 'CA',
          postalCode: '94111',
          country: 'US',
        },
        subtotal: 50.0,
      })

      expect(result).toMatchObject({
        shippingCost: 0,
        shippingMethod: 'Free Shipping',
      })
    })

    it('should calculate flat rate shipping for domestic orders', async () => {
      const result = await calculateShipping({
        items: [{ quantity: 2, weightOz: 16 }],
        shippingAddress: {
          state: 'CA',
          postalCode: '94111',
          country: 'US',
        },
        subtotal: 25.0,
      })

      expect(result).toMatchObject({
        shippingCost: 6.99,
        shippingMethod: 'Standard Shipping',
        estimatedDelivery: '3-5 business days',
      })
      expect(result.availableOptions).toBeDefined()
      expect(result.availableOptions).toHaveLength(1)
    })

    it('should calculate international shipping for non-US orders', async () => {
      const result = await calculateShipping({
        items: [{ quantity: 1, weightOz: 32 }],
        shippingAddress: {
          state: 'ON',
          postalCode: 'M5H 2N2',
          country: 'CA',
        },
        subtotal: 30.0,
      })

      expect(result).toMatchObject({
        shippingCost: 24.99,
        shippingMethod: 'International Shipping',
        estimatedDelivery: '7-14 business days',
      })
    })

    it('should apply weight-based pricing for heavy orders', async () => {
      const result = await calculateShipping({
        items: [{ quantity: 1, weightOz: 160 }],
        shippingAddress: {
          state: 'CA',
          postalCode: '94111',
          country: 'US',
        },
        subtotal: 30.0,
      })

      // Total weightOz: 160 lbs
      // Weight-based: $4.99 + (10 - 5) * $0.50 = $4.99 + $2.50 = $7.49
      // Flat rate: $6.99
      // Should use max: $7.49
      expect(result.shippingCost).toBe(expectedEstimateCost([{ quantity: 1, weightOz: 160 }]))
      expect(result.shippingMethod).toBe('Standard Shipping')
    })

    it('should use default weight of 1 lb if weight not specified', async () => {
      const result = await calculateShipping({
        items: [{ quantity: 3 }],
        shippingAddress: {
          state: 'NY',
          postalCode: '10001',
          country: 'US',
        },
        subtotal: 20.0,
      })

      // Total weightOz: 48 items * 1 lb = 3 lbs (below 5 lb threshold)
      expect(result.shippingCost).toBe(6.99)
    })

    it('should apply state multiplier for Alaska', async () => {
      const result = await calculateShipping({
        items: [{ quantity: 1, weightOz: 32 }],
        shippingAddress: {
          state: 'AK',
          postalCode: '99501',
          country: 'US',
        },
        subtotal: 30.0,
      })

      // Flat rate $6.99 * 1.5 = $10.485 rounded to $10.48
      expect(result.shippingCost).toBe(10.48)
      expect(result.availableOptions?.[0].cost).toBe(10.48)
    })

    it('should apply state multiplier for Hawaii', async () => {
      const result = await calculateShipping({
        items: [{ quantity: 1, weightOz: 32 }],
        shippingAddress: {
          state: 'HI',
          postalCode: '96801',
          country: 'US',
        },
        subtotal: 30.0,
      })

      // Flat rate $6.99 * 1.5 = $10.485 rounded to $10.48
      expect(result.shippingCost).toBe(10.48)
    })

    it('should apply state multiplier for Puerto Rico', async () => {
      const result = await calculateShipping({
        items: [{ quantity: 1, weightOz: 32 }],
        shippingAddress: {
          state: 'PR',
          postalCode: '00901',
          country: 'US',
        },
        subtotal: 30.0,
      })

      // Flat rate $6.99 * 2.0 = $13.98
      expect(result.shippingCost).toBe(13.98)
    })

    it('should handle lowercase state codes', async () => {
      const result = await calculateShipping({
        items: [{ quantity: 1, weightOz: 32 }],
        shippingAddress: {
          state: 'ak',
          postalCode: '99501',
          country: 'US',
        },
        subtotal: 30.0,
      })

      expect(result.shippingCost).toBe(10.48)
    })

    it('should return standard shipping as the only available option', async () => {
      const result = await calculateShipping({
        items: [{ quantity: 1, weightOz: 32 }],
        shippingAddress: {
          state: 'CA',
          postalCode: '94111',
          country: 'US',
        },
        subtotal: 30.0,
      })

      expect(result.availableOptions).toHaveLength(1)
      expect(result.availableOptions?.[0]).toMatchObject({
        method: 'Standard Shipping',
        cost: 6.99,
        estimatedDays: '3-5 business days',
      })
    })

    it('should never offer an express shipping option', async () => {
      for (const subtotal of [10.0, 30.0, 49.99]) {
        const result = await calculateShipping({
          items: [{ quantity: 1, weightOz: 32 }],
          shippingAddress: {
            state: 'AK',
            postalCode: '99501',
            country: 'US',
          },
          subtotal,
        })

        expect(result.availableOptions).toHaveLength(1)
        expect(result.shippingMethod).not.toMatch(/express/i)
        expect(
          result.availableOptions?.some((option) => /express/i.test(option.method))
        ).toBe(false)
      }
    })

    it('should handle multiple items with different weights', async () => {
      const result = await calculateShipping({
        items: [
          { quantity: 2, weightOz: 24 }, // 3 lbs
          { quantity: 1, weightOz: 48 }, // 3 lbs
        ],
        shippingAddress: {
          state: 'TX',
          postalCode: '75001',
          country: 'US',
        },
        subtotal: 40.0,
      })

      // Total weightOz: 96 lbs
      // Weight-based: $4.99 + (6 - 5) * $0.50 = $5.49
      // Flat rate: $6.99
      // Should use max: $6.99
      expect(result.shippingCost).toBe(6.99)
    })
  })

  describe('getShippingEstimate', () => {
    it('should return 0 for orders over free shipping threshold', async () => {
      const estimate = await getShippingEstimate({
        subtotal: 75.0,
        state: 'CA',
        country: 'US',
      })

      expect(estimate).toBe(0)
    })

    it('should return 0 for orders exactly at threshold', async () => {
      const estimate = await getShippingEstimate({
        subtotal: 50.0,
        state: 'CA',
        country: 'US',
      })

      expect(estimate).toBe(0)
    })

    it('should return international rate for non-US countries', async () => {
      const estimate = await getShippingEstimate({
        subtotal: 30.0,
        state: 'ON',
        country: 'CA',
      })

      expect(estimate).toBe(24.99)
    })

    it('should return flat rate for standard US states', async () => {
      const estimate = await getShippingEstimate({
        subtotal: 30.0,
        state: 'CA',
        country: 'US',
      })

      expect(estimate).toBe(6.99)
    })

    it('should apply state multiplier for Alaska', async () => {
      const estimate = await getShippingEstimate({
        subtotal: 30.0,
        state: 'AK',
        country: 'US',
      })

      expect(estimate).toBe(10.48)
    })

    it('should apply state multiplier for Hawaii', async () => {
      const estimate = await getShippingEstimate({
        subtotal: 30.0,
        state: 'HI',
        country: 'US',
      })

      expect(estimate).toBe(10.48)
    })

    it('should apply state multiplier for Puerto Rico', async () => {
      const estimate = await getShippingEstimate({
        subtotal: 30.0,
        state: 'PR',
        country: 'US',
      })

      expect(estimate).toBe(13.98)
    })

    it('should default to US when country is not specified', async () => {
      const estimate = await getShippingEstimate({
        subtotal: 30.0,
        state: 'NY',
      })

      expect(estimate).toBe(6.99)
    })

    it('should handle lowercase state codes', async () => {
      const estimate = await getShippingEstimate({
        subtotal: 30.0,
        state: 'hi',
        country: 'US',
      })

      expect(estimate).toBe(10.48)
    })
  })

  describe('validateShippingAddress', () => {
    it('should validate a correct address', () => {
      const result = validateShippingAddress({
        address1: '123 Main St',
        city: 'San Francisco',
        state: 'CA',
        postalCode: '94111',
        country: 'US',
      })

      expect(result.valid).toBe(true)
      expect(result.errors).toEqual([])
    })

    it('should reject missing address1', () => {
      const result = validateShippingAddress({
        address1: '',
        city: 'San Francisco',
        state: 'CA',
        postalCode: '94111',
        country: 'US',
      })

      expect(result.valid).toBe(false)
      expect(result.errors).toContain('Address line 1 is required')
    })

    it('should reject short address1', () => {
      const result = validateShippingAddress({
        address1: 'Ab',
        city: 'San Francisco',
        state: 'CA',
        postalCode: '94111',
        country: 'US',
      })

      expect(result.valid).toBe(false)
      expect(result.errors).toContain('Address line 1 is required')
    })

    it('should reject missing city', () => {
      const result = validateShippingAddress({
        address1: '123 Main St',
        city: '',
        state: 'CA',
        postalCode: '94111',
        country: 'US',
      })

      expect(result.valid).toBe(false)
      expect(result.errors).toContain('City is required')
    })

    it('should reject short city', () => {
      const result = validateShippingAddress({
        address1: '123 Main St',
        city: 'A',
        state: 'CA',
        postalCode: '94111',
        country: 'US',
      })

      expect(result.valid).toBe(false)
      expect(result.errors).toContain('City is required')
    })

    it('should reject invalid state code', () => {
      const result = validateShippingAddress({
        address1: '123 Main St',
        city: 'San Francisco',
        state: 'California',
        postalCode: '94111',
        country: 'US',
      })

      expect(result.valid).toBe(false)
      expect(result.errors).toContain('State must be a 2-letter code (e.g., CA, NY)')
    })

    it('should reject missing state', () => {
      const result = validateShippingAddress({
        address1: '123 Main St',
        city: 'San Francisco',
        state: '',
        postalCode: '94111',
        country: 'US',
      })

      expect(result.valid).toBe(false)
      expect(result.errors).toContain('State must be a 2-letter code (e.g., CA, NY)')
    })

    it('should reject invalid postal code', () => {
      const result = validateShippingAddress({
        address1: '123 Main St',
        city: 'San Francisco',
        state: 'CA',
        postalCode: '123',
        country: 'US',
      })

      expect(result.valid).toBe(false)
      expect(result.errors).toContain('Valid ZIP code is required')
    })

    it('should reject missing postal code', () => {
      const result = validateShippingAddress({
        address1: '123 Main St',
        city: 'San Francisco',
        state: 'CA',
        postalCode: '',
        country: 'US',
      })

      expect(result.valid).toBe(false)
      expect(result.errors).toContain('Valid ZIP code is required')
    })

    it('should reject invalid country code', () => {
      const result = validateShippingAddress({
        address1: '123 Main St',
        city: 'San Francisco',
        state: 'CA',
        postalCode: '94111',
        country: 'USA',
      })

      expect(result.valid).toBe(false)
      expect(result.errors).toContain('Country must be a 2-letter code (e.g., US)')
    })

    it('should reject missing country', () => {
      const result = validateShippingAddress({
        address1: '123 Main St',
        city: 'San Francisco',
        state: 'CA',
        postalCode: '94111',
        country: '',
      })

      expect(result.valid).toBe(false)
      expect(result.errors).toContain('Country must be a 2-letter code (e.g., US)')
    })

    it('should return multiple errors for completely invalid address', () => {
      const result = validateShippingAddress({
        address1: '',
        city: '',
        state: '',
        postalCode: '',
        country: '',
      })

      expect(result.valid).toBe(false)
      expect(result.errors).toHaveLength(5)
    })

    it('should accept valid international address', () => {
      const result = validateShippingAddress({
        address1: '10 Downing Street',
        city: 'London',
        state: 'EN',
        postalCode: 'SW1A 2AA',
        country: 'GB',
      })

      expect(result.valid).toBe(true)
      expect(result.errors).toEqual([])
    })
  })

  describe('Edge Cases', () => {
    describe('Zero and Empty Values', () => {
      it('should handle empty items array', async () => {
        const result = await calculateShipping({
          items: [],
          shippingAddress: {
            state: 'CA',
            postalCode: '94111',
            country: 'US',
          },
          subtotal: 30.0,
        })

        // Should still calculate shipping with default/minimum values
        expect(result).toBeDefined()
        expect(result.shippingCost).toBeGreaterThan(0)
      })

      it('should handle zero subtotal', async () => {
        const result = await calculateShipping({
          items: [{ quantity: 1, weightOz: 32 }],
          shippingAddress: {
            state: 'CA',
            postalCode: '94111',
            country: 'US',
          },
          subtotal: 0,
        })

        // Should not qualify for free shipping
        expect(result.shippingCost).toBeGreaterThan(0)
      })

      it('should handle zero weight items with default weight', async () => {
        const result = await calculateShipping({
          items: [{ quantity: 2, weightOz: 0 }],
          shippingAddress: {
            state: 'CA',
            postalCode: '94111',
            country: 'US',
          },
          subtotal: 30.0,
        })

        // Should use default weight of 1 lb per item
        expect(result).toBeDefined()
        expect(result.shippingCost).toBe(6.99)
      })

      it('should handle zero quantity items', async () => {
        const result = await calculateShipping({
          items: [{ quantity: 0, weightOz: 80 }],
          shippingAddress: {
            state: 'CA',
            postalCode: '94111',
            country: 'US',
          },
          subtotal: 30.0,
        })

        // Zero quantity means zero weight
        expect(result).toBeDefined()
        expect(result.shippingCost).toBe(6.99) // Flat rate
      })
    })

    describe('Negative Values', () => {
      it('should handle negative subtotal gracefully', async () => {
        const result = await calculateShipping({
          items: [{ quantity: 1, weightOz: 32 }],
          shippingAddress: {
            state: 'CA',
            postalCode: '94111',
            country: 'US',
          },
          subtotal: -10.0,
        })

        // Should not qualify for free shipping
        expect(result.shippingCost).toBeGreaterThan(0)
      })

      it('should handle negative weight gracefully', async () => {
        const result = await calculateShipping({
          items: [{ quantity: 1, weight: -5 }],
          shippingAddress: {
            state: 'CA',
            postalCode: '94111',
            country: 'US',
          },
          subtotal: 30.0,
        })

        // Should still calculate shipping
        expect(result).toBeDefined()
        expect(result.shippingCost).toBeGreaterThan(0)
      })

      it('should handle negative quantity gracefully', async () => {
        const result = await calculateShipping({
          items: [{ quantity: -2, weightOz: 48 }],
          shippingAddress: {
            state: 'CA',
            postalCode: '94111',
            country: 'US',
          },
          subtotal: 30.0,
        })

        // Should still calculate shipping
        expect(result).toBeDefined()
        expect(result.shippingCost).toBeGreaterThan(0)
      })
    })

    describe('Extreme Values', () => {
      it('should handle very large subtotal ($10,000)', async () => {
        const result = await calculateShipping({
          items: [{ quantity: 1, weightOz: 32 }],
          shippingAddress: {
            state: 'CA',
            postalCode: '94111',
            country: 'US',
          },
          subtotal: 10000.0,
        })

        // Should qualify for free shipping
        expect(result.shippingCost).toBe(0)
        expect(result.shippingMethod).toBe('Free Shipping')
      })

      it('should handle very large weight (100 lbs)', async () => {
        const result = await calculateShipping({
          items: [{ quantity: 1, weightOz: 1600 }],
          shippingAddress: {
            state: 'CA',
            postalCode: '94111',
            country: 'US',
          },
          subtotal: 30.0,
        })

        expect(result.shippingCost).toBe(expectedEstimateCost([{ quantity: 1, weightOz: 1600 }]))
      })

      it('should handle very large quantity (1000 items)', async () => {
        const result = await calculateShipping({
          items: [{ quantity: 1000, weightOz: 16 }],
          shippingAddress: {
            state: 'CA',
            postalCode: '94111',
            country: 'US',
          },
          subtotal: 30.0,
        })

        // Total weightOz: 16000 lbs
        // Weight-based: $4.99 + (1000 - 5) * $0.50 = $4.99 + $497.50 = $502.49
        expect(result.shippingCost).toBe(expectedEstimateCost([{ quantity: 1000, weightOz: 16 }]))
      })

      it('should handle multiple items with extreme quantities', async () => {
        const result = await calculateShipping({
          items: [
            { quantity: 100, weightOz: 32 },
            { quantity: 50, weightOz: 48 },
          ],
          shippingAddress: {
            state: 'CA',
            postalCode: '94111',
            country: 'US',
          },
          subtotal: 30.0,
        })

        // Total weight: (100 * 2) + (50 * 3) = 200 + 150 = 350 lbs
        expect(result.shippingCost).toBeGreaterThan(100)
      })
    })

    describe('Boundary Conditions', () => {
      it('should handle subtotal exactly $49.99 (just under threshold)', async () => {
        const result = await calculateShipping({
          items: [{ quantity: 1, weightOz: 32 }],
          shippingAddress: {
            state: 'CA',
            postalCode: '94111',
            country: 'US',
          },
          subtotal: 49.99,
        })

        // Should NOT qualify for free shipping
        expect(result.shippingCost).toBeGreaterThan(0)
      })

      it('should handle subtotal exactly $50.01 (just over threshold)', async () => {
        const result = await calculateShipping({
          items: [{ quantity: 1, weightOz: 32 }],
          shippingAddress: {
            state: 'CA',
            postalCode: '94111',
            country: 'US',
          },
          subtotal: 50.01,
        })

        // Should qualify for free shipping
        expect(result.shippingCost).toBe(0)
        expect(result.shippingMethod).toBe('Free Shipping')
      })

      it('should handle weight exactly at 5 lbs threshold', async () => {
        const result = await calculateShipping({
          items: [{ quantity: 1, weightOz: 80 }],
          shippingAddress: {
            state: 'CA',
            postalCode: '94111',
            country: 'US',
          },
          subtotal: 30.0,
        })

        // At exactly 5 lbs, no weight-based surcharge
        expect(result.shippingCost).toBe(6.99)
      })

      it('should handle weight just over 5 lbs threshold (5.01 lbs)', async () => {
        const result = await calculateShipping({
          items: [{ quantity: 1, weightOz: 80.16 }],
          shippingAddress: {
            state: 'CA',
            postalCode: '94111',
            country: 'US',
          },
          subtotal: 30.0,
        })

        // Weight-based: $4.99 + (5.01 - 5) * $0.50 = $4.99 + $0.005 = $4.995
        // Flat rate: $6.99
        // Should use max: $6.99
        expect(result.shippingCost).toBe(6.99)
      })

      it('should handle weight just under 5 lbs threshold (4.99 lbs)', async () => {
        const result = await calculateShipping({
          items: [{ quantity: 1, weightOz: 79.84 }],
          shippingAddress: {
            state: 'CA',
            postalCode: '94111',
            country: 'US',
          },
          subtotal: 30.0,
        })

        // Below threshold, use flat rate
        expect(result.shippingCost).toBe(6.99)
      })
    })

    describe('Rounding and Precision', () => {
      it('should handle subtotal with many decimal places', async () => {
        const result = await calculateShipping({
          items: [{ quantity: 1, weightOz: 32 }],
          shippingAddress: {
            state: 'CA',
            postalCode: '94111',
            country: 'US',
          },
          subtotal: 50.000001,
        })

        // Should qualify for free shipping (over $50)
        expect(result.shippingCost).toBe(0)
      })

      it('should handle weight with many decimal places', async () => {
        const result = await calculateShipping({
          items: [{ quantity: 1, weightOz: 161.9753 }],
          shippingAddress: {
            state: 'CA',
            postalCode: '94111',
            country: 'US',
          },
          subtotal: 30.0,
        })

        // Weight-based: $4.99 + (10.123456 - 5) * $0.50 = $4.99 + $2.561728 = $7.551728
        // Should round to 2 decimal places
        expect(result.shippingCost).toBe(expectedEstimateCost([{ quantity: 1, weightOz: 161.9753 }]))
      })

      it('should round AK multiplier calculation correctly', async () => {
        const result = await calculateShipping({
          items: [{ quantity: 1, weightOz: 37.328 }],
          shippingAddress: {
            state: 'AK',
            postalCode: '99501',
            country: 'US',
          },
          subtotal: 30.0,
        })

        // Flat rate $6.99 * 1.5 = $10.485, should round to $10.48
        expect(result.shippingCost).toBe(10.48)
      })

      it('should round PR multiplier calculation correctly', async () => {
        const result = await calculateShipping({
          items: [{ quantity: 1, weightOz: 48 }],
          shippingAddress: {
            state: 'PR',
            postalCode: '00901',
            country: 'US',
          },
          subtotal: 30.0,
        })

        // Flat rate $6.99 * 2.0 = $13.98
        expect(result.shippingCost).toBe(13.98)
      })
    })

    describe('Combined Complex Scenarios', () => {
      it('should handle AK + heavy weight + low subtotal', async () => {
        const result = await calculateShipping({
          items: [{ quantity: 1, weightOz: 320 }],
          shippingAddress: {
            state: 'AK',
            postalCode: '99501',
            country: 'US',
          },
          subtotal: 25.0,
        })

        // Weight-based: $4.99 + (20 - 5) * $0.50 = $4.99 + $7.50 = $12.49
        // With AK multiplier: $12.49 * 1.5 = $18.735, rounded to $18.73
        expect(result.shippingCost).toBe(expectedEstimateCost([{ quantity: 1, weightOz: 320 }], 1.5))
      })

      it('should handle HI + heavy weight + just under free threshold', async () => {
        const result = await calculateShipping({
          items: [{ quantity: 1, weightOz: 240 }],
          shippingAddress: {
            state: 'HI',
            postalCode: '96801',
            country: 'US',
          },
          subtotal: 49.99,
        })

        // Weight-based: $4.99 + (15 - 5) * $0.50 = $4.99 + $5.00 = $9.99
        // With HI multiplier: $9.99 * 1.5 = $14.985, rounded to $14.98
        expect(result.shippingCost).toBe(expectedEstimateCost([{ quantity: 1, weightOz: 240 }], 1.5))
      })

      it('should handle PR + multiple heavy items + free shipping', async () => {
        const result = await calculateShipping({
          items: [
            { quantity: 2, weightOz: 160 },
            { quantity: 1, weightOz: 80 },
          ],
          shippingAddress: {
            state: 'PR',
            postalCode: '00901',
            country: 'US',
          },
          subtotal: 75.0,
        })

        // Should get free shipping despite PR location
        expect(result.shippingCost).toBe(0)
        expect(result.shippingMethod).toBe('Free Shipping')
      })

      it('should handle international + very heavy items', async () => {
        const result = await calculateShipping({
          items: [{ quantity: 1, weightOz: 800 }],
          shippingAddress: {
            state: 'ON',
            postalCode: 'M5H 2N2',
            country: 'CA',
          },
          subtotal: 30.0,
        })

        // International flat rate regardless of weight
        expect(result.shippingCost).toBe(24.99)
        expect(result.shippingMethod).toBe('International Shipping')
      })

      it('should handle multiple items with mixed weights and zero weights', async () => {
        const result = await calculateShipping({
          items: [
            { quantity: 2, weightOz: 48 },
            { quantity: 1, weightOz: 0 }, // Should use default 1 lb
            { quantity: 3 }, // Should use default 1 lb
          ],
          shippingAddress: {
            state: 'CA',
            postalCode: '94111',
            country: 'US',
          },
          subtotal: 30.0,
        })

        // Total: (2*3) + (1*1) + (3*1) = 6 + 1 + 3 = 10 lbs
        // Weight-based: $4.99 + (10 - 5) * $0.50 = $4.99 + $2.50 = $7.49
        expect(result.shippingCost).toBe(expectedEstimateCost([{ quantity: 2, weightOz: 48 }, { quantity: 1, weightOz: 0 }, { quantity: 3 }]))
      })

      it('should handle fractional weights with state multiplier', async () => {
        const result = await calculateShipping({
          items: [{ quantity: 3, weightOz: 40 }],
          shippingAddress: {
            state: 'AK',
            postalCode: '99501',
            country: 'US',
          },
          subtotal: 30.0,
        })

        // Total weightOz: 48 * 2.5 = 7.5 lbs
        // Weight-based: $4.99 + (7.5 - 5) * $0.50 = $4.99 + $1.25 = $6.24
        // Flat rate: $6.99
        // Max: $6.99
        // With AK multiplier: $6.99 * 1.5 = $10.485, rounded to $10.48
        expect(result.shippingCost).toBe(expectedEstimateCost([{ quantity: 3, weightOz: 40 }], 1.5))
      })
    })

    describe('Validation Edge Cases', () => {
      it('should handle very short address', () => {
        const result = validateShippingAddress({
          address1: 'Hi',
          city: 'SF',
          state: 'CA',
          postalCode: '94111',
          country: 'US',
        })

        expect(result.valid).toBe(false)
        expect(result.errors).toContain('Address line 1 is required')
      })

      it('should handle single character city', () => {
        const result = validateShippingAddress({
          address1: '123 Main St',
          city: 'X',
          state: 'CA',
          postalCode: '94111',
          country: 'US',
        })

        expect(result.valid).toBe(false)
        expect(result.errors).toContain('City is required')
      })

      it('should handle lowercase state code', () => {
        const result = validateShippingAddress({
          address1: '123 Main St',
          city: 'San Francisco',
          state: 'ca',
          postalCode: '94111',
          country: 'US',
        })

        // Validation should accept lowercase (normalization happens in calculator)
        expect(result.valid).toBe(true)
      })

      it('should handle 3-character state code', () => {
        const result = validateShippingAddress({
          address1: '123 Main St',
          city: 'San Francisco',
          state: 'CAL',
          postalCode: '94111',
          country: 'US',
        })

        expect(result.valid).toBe(false)
        expect(result.errors).toContain('State must be a 2-letter code (e.g., CA, NY)')
      })

      it('should handle postal code with only 4 digits', () => {
        const result = validateShippingAddress({
          address1: '123 Main St',
          city: 'San Francisco',
          state: 'CA',
          postalCode: '9411',
          country: 'US',
        })

        expect(result.valid).toBe(false)
        expect(result.errors).toContain('Valid ZIP code is required')
      })

      it('should handle empty country code', () => {
        const result = validateShippingAddress({
          address1: '123 Main St',
          city: 'San Francisco',
          state: 'CA',
          postalCode: '94111',
          country: '',
        })

        expect(result.valid).toBe(false)
        expect(result.errors).toContain('Country must be a 2-letter code (e.g., US)')
      })

      it('should handle all invalid fields at once', () => {
        const result = validateShippingAddress({
          address1: '',
          city: '',
          state: '',
          postalCode: '123',
          country: 'USA',
        })

        expect(result.valid).toBe(false)
        expect(result.errors).toHaveLength(5)
      })
    })
  })
})
