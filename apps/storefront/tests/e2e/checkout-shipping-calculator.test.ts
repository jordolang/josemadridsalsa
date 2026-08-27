import { it, expect, beforeAll } from 'vitest'
import { describeIfE2E, e2eBaseUrl } from '../helpers/e2e'
import { HANDLING_FEE } from '@/lib/shipping/handling-fee'
import prisma from '@/lib/prisma'

/**
 * The carriage half of a quoted shipping cost — what the state multiplier actually scales.
 *
 * A quote is `rate × stateMultiplier + packagingFee`. The fee is flat by design (a box costs the
 * same to Anchorage as to San Francisco), so dividing two all-in quotes understates the multiplier:
 * $14.48 / $10.99 is 1.32, not the 1.5 the config specifies. Netting the fee off both sides pins
 * the multiplier itself rather than widening the tolerance until the arithmetic happens to fit.
 */
const carriage = (shippingCost: number): number => shippingCost - HANDLING_FEE

/**
 * E2E Test: Shipping Calculator Integration
 *
 * This test verifies the shipping calculator functionality in the checkout flow:
 * 1. Real-time shipping rate calculation
 * 2. Multiple carrier options selection
 * 3. Cost accuracy with different addresses and cart contents
 * 4. Integration with checkout API
 *
 * Note: This test requires:
 * - Seeded products in database with dimensions
 * - Shipping API credentials configured (or uses fallback rates)
 * - Next.js development server running on http://localhost:3000
 */

describeIfE2E('E2E: Shipping Calculator Integration', () => {
  let testProductId: string | null = null
  let testProductPrice: number = 0
  const baseUrl = e2eBaseUrl

  beforeAll(async () => {
    // Get a test product from the database
    const product = await prisma.product.findFirst({
      where: {
        isActive: true,
        inventory: { gt: 0 }
      }
    })

    if (product) {
      testProductId = product.id
      testProductPrice = Number(product.price)
    }
  })

  describe('Basic Calculator Functionality', () => {
    it('should calculate shipping for single item', async () => {
      if (!testProductId) {
        console.log('⚠️  Skipping: No test product available')
        return
      }

      const response = await fetch(`${baseUrl}/api/checkout/calculate-shipping`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          items: [
            {
              productId: testProductId,
              quantity: 1,
            }
          ],
          shippingAddress: {
            address1: '123 Main Street',
            city: 'San Francisco',
            state: 'CA',
            postalCode: '94111',
            country: 'US',
          },
        }),
      })

      expect(response.status).toBe(200)
      const data = await response.json()

      // Verify basic response structure
      expect(data).toHaveProperty('shippingCost')
      expect(data).toHaveProperty('shippingMethod')
      expect(data).toHaveProperty('estimatedDelivery')
      expect(data).toHaveProperty('availableOptions')

      // Verify shipping cost is reasonable
      expect(typeof data.shippingCost).toBe('number')
      expect(data.shippingCost).toBeGreaterThanOrEqual(0)
      expect(data.shippingCost).toBeLessThan(50)

      console.log('✓ Single item shipping:', {
        cost: `$${data.shippingCost.toFixed(2)}`,
        method: data.shippingMethod,
        delivery: data.estimatedDelivery,
      })
    })

    it('should calculate shipping for multiple items', async () => {
      if (!testProductId) {
        console.log('⚠️  Skipping: No test product available')
        return
      }

      const response = await fetch(`${baseUrl}/api/checkout/calculate-shipping`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          items: [
            {
              productId: testProductId,
              quantity: 3,
            }
          ],
          shippingAddress: {
            address1: '123 Main Street',
            city: 'San Francisco',
            state: 'CA',
            postalCode: '94111',
            country: 'US',
          },
        }),
      })

      expect(response.status).toBe(200)
      const data = await response.json()

      expect(data.shippingCost).toBeGreaterThanOrEqual(0)
      expect(data.availableOptions).toBeDefined()

      console.log('✓ Multiple items shipping:', {
        quantity: 3,
        cost: `$${data.shippingCost.toFixed(2)}`,
        method: data.shippingMethod,
      })
    })

    it('should provide multiple carrier options', async () => {
      if (!testProductId) {
        console.log('⚠️  Skipping: No test product available')
        return
      }

      const response = await fetch(`${baseUrl}/api/checkout/calculate-shipping`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          items: [{ productId: testProductId, quantity: 1 }],
          shippingAddress: {
            address1: '123 Main Street',
            city: 'San Francisco',
            state: 'CA',
            postalCode: '94111',
            country: 'US',
          },
        }),
      })

      const data = await response.json()

      expect(data.availableOptions).toBeDefined()
      expect(Array.isArray(data.availableOptions)).toBe(true)

      if (data.availableOptions && data.availableOptions.length > 0) {
        console.log(`✓ Found ${data.availableOptions.length} shipping options:`)

        data.availableOptions.forEach((option: any) => {
          // Verify option structure
          expect(option).toHaveProperty('method')
          expect(option).toHaveProperty('cost')
          expect(option).toHaveProperty('estimatedDays')

          // Verify data types
          expect(typeof option.method).toBe('string')
          expect(typeof option.cost).toBe('number')
          expect(option.method).not.toBe('')

          // Verify realistic pricing
          expect(option.cost).toBeGreaterThanOrEqual(0)
          expect(option.cost).toBeLessThan(50)

          console.log(`  - ${option.method}: $${option.cost.toFixed(2)} (${option.estimatedDays})`)
        })
      } else {
        console.log('⚠️  No shipping options returned (using fallback rates)')
      }
    })
  })

  describe('Address-Based Calculation', () => {
    it('should calculate different rates for different states', async () => {
      if (!testProductId) {
        console.log('⚠️  Skipping: No test product available')
        return
      }

      // Test California
      const caResponse = await fetch(`${baseUrl}/api/checkout/calculate-shipping`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          items: [{ productId: testProductId, quantity: 1 }],
          shippingAddress: {
            address1: '123 Main Street',
            city: 'San Francisco',
            state: 'CA',
            postalCode: '94111',
            country: 'US',
          },
        }),
      })

      expect(caResponse.status).toBe(200)
      const caData = await caResponse.json()

      // Test New York
      const nyResponse = await fetch(`${baseUrl}/api/checkout/calculate-shipping`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          items: [{ productId: testProductId, quantity: 1 }],
          shippingAddress: {
            address1: '456 Broadway',
            city: 'New York',
            state: 'NY',
            postalCode: '10013',
            country: 'US',
          },
        }),
      })

      expect(nyResponse.status).toBe(200)
      const nyData = await nyResponse.json()

      console.log('✓ State-based shipping rates:')
      console.log(`  California: $${caData.shippingCost.toFixed(2)}`)
      console.log(`  New York: $${nyData.shippingCost.toFixed(2)}`)

      // Both should be valid positive numbers
      expect(caData.shippingCost).toBeGreaterThanOrEqual(0)
      expect(nyData.shippingCost).toBeGreaterThanOrEqual(0)

      // Rates may differ based on carrier zones
      console.log(`✓ Cross-country rate difference: $${Math.abs(nyData.shippingCost - caData.shippingCost).toFixed(2)}`)
    })

    it('should apply surcharge for Alaska', async () => {
      if (!testProductId) {
        console.log('⚠️  Skipping: No test product available')
        return
      }

      // Baseline: California
      const caResponse = await fetch(`${baseUrl}/api/checkout/calculate-shipping`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          items: [{ productId: testProductId, quantity: 1 }],
          shippingAddress: {
            address1: '123 Main Street',
            city: 'San Francisco',
            state: 'CA',
            postalCode: '94111',
            country: 'US',
          },
        }),
      })

      const caData = await caResponse.json()

      // Alaska with surcharge
      const akResponse = await fetch(`${baseUrl}/api/checkout/calculate-shipping`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          items: [{ productId: testProductId, quantity: 1 }],
          shippingAddress: {
            address1: '123 Northern Lights Blvd',
            city: 'Anchorage',
            state: 'AK',
            postalCode: '99501',
            country: 'US',
          },
        }),
      })

      expect(akResponse.status).toBe(200)
      const akData = await akResponse.json()

      console.log('✓ Alaska surcharge verification:')
      console.log(`  California: $${caData.shippingCost.toFixed(2)}`)
      console.log(`  Alaska: $${akData.shippingCost.toFixed(2)}`)

      // Alaska should cost more
      expect(akData.shippingCost).toBeGreaterThan(caData.shippingCost)

      // Ratio of carriage, not of the all-in price: the packaging fee is flat and does not scale.
      const surchargeRatio = carriage(akData.shippingCost) / carriage(caData.shippingCost)
      console.log(`  Surcharge ratio: ${surchargeRatio.toFixed(2)}x`)

      // Expect approximately 1.5x surcharge
      expect(surchargeRatio).toBeGreaterThanOrEqual(1.4)
      expect(surchargeRatio).toBeLessThanOrEqual(1.6)
    })

    it('should apply surcharge for Hawaii', async () => {
      if (!testProductId) {
        console.log('⚠️  Skipping: No test product available')
        return
      }

      // Baseline: California
      const caResponse = await fetch(`${baseUrl}/api/checkout/calculate-shipping`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          items: [{ productId: testProductId, quantity: 1 }],
          shippingAddress: {
            address1: '123 Main Street',
            city: 'San Francisco',
            state: 'CA',
            postalCode: '94111',
            country: 'US',
          },
        }),
      })

      const caData = await caResponse.json()

      // Hawaii with surcharge
      const hiResponse = await fetch(`${baseUrl}/api/checkout/calculate-shipping`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          items: [{ productId: testProductId, quantity: 1 }],
          shippingAddress: {
            address1: '123 Kalakaua Avenue',
            city: 'Honolulu',
            state: 'HI',
            postalCode: '96815',
            country: 'US',
          },
        }),
      })

      expect(hiResponse.status).toBe(200)
      const hiData = await hiResponse.json()

      console.log('✓ Hawaii surcharge verification:')
      console.log(`  California: $${caData.shippingCost.toFixed(2)}`)
      console.log(`  Hawaii: $${hiData.shippingCost.toFixed(2)}`)

      // Hawaii should cost more
      expect(hiData.shippingCost).toBeGreaterThan(caData.shippingCost)

      // Ratio of carriage, not of the all-in price: the packaging fee is flat and does not scale.
      const surchargeRatio = carriage(hiData.shippingCost) / carriage(caData.shippingCost)
      console.log(`  Surcharge ratio: ${surchargeRatio.toFixed(2)}x`)

      // Expect approximately 1.5x surcharge
      expect(surchargeRatio).toBeGreaterThanOrEqual(1.4)
      expect(surchargeRatio).toBeLessThanOrEqual(1.6)
    })
  })


  describe('PO Box Handling', () => {
    it('should detect PO Box addresses', async () => {
      if (!testProductId) {
        console.log('⚠️  Skipping: No test product available')
        return
      }

      const response = await fetch(`${baseUrl}/api/checkout/calculate-shipping`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          items: [{ productId: testProductId, quantity: 1 }],
          shippingAddress: {
            address1: 'PO Box 123',
            city: 'San Francisco',
            state: 'CA',
            postalCode: '94111',
            country: 'US',
          },
        }),
      })

      expect(response.status).toBe(200)
      const data = await response.json()

      console.log('✓ PO Box shipping:')

      if (data.availableOptions && data.availableOptions.length > 0) {
        // Should be USPS only for PO Box
        const allUSPS = data.availableOptions.every((opt: any) =>
          opt.method.toUpperCase().includes('USPS')
        )

        console.log(`  All options USPS: ${allUSPS}`)
        console.log(`  Options count: ${data.availableOptions.length}`)

        data.availableOptions.forEach((opt: any) => {
          console.log(`    - ${opt.method}: $${opt.cost.toFixed(2)}`)
        })

        expect(allUSPS).toBe(true)
      }
    })
  })

  describe('Error Handling', () => {
    it('should handle invalid product ID', async () => {
      const response = await fetch(`${baseUrl}/api/checkout/calculate-shipping`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          items: [{ productId: 'invalid-id-xyz', quantity: 1 }],
          shippingAddress: {
            address1: '123 Main Street',
            city: 'San Francisco',
            state: 'CA',
            postalCode: '94111',
            country: 'US',
          },
        }),
      })

      // Should either return 200 with fallback or 400 error
      expect([200, 400]).toContain(response.status)

      if (response.status === 200) {
        const data = await response.json()
        expect(data).toHaveProperty('shippingCost')
        console.log('✓ Returns fallback rates for invalid product')
      } else {
        console.log('✓ Returns error for invalid product')
      }
    })

    it('should handle missing address fields', async () => {
      if (!testProductId) {
        console.log('⚠️  Skipping: No test product available')
        return
      }

      const response = await fetch(`${baseUrl}/api/checkout/calculate-shipping`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          items: [{ productId: testProductId, quantity: 1 }],
          shippingAddress: {
            city: 'San Francisco',
            // Missing required fields
          },
        }),
      })

      // Should return validation error
      expect(response.status).toBe(400)
      console.log('✓ Validates required address fields')
    })

    it('should handle empty cart', async () => {
      const response = await fetch(`${baseUrl}/api/checkout/calculate-shipping`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          items: [],
          shippingAddress: {
            address1: '123 Main Street',
            city: 'San Francisco',
            state: 'CA',
            postalCode: '94111',
            country: 'US',
          },
        }),
      })

      // Should return error for empty cart
      expect(response.status).toBe(400)
      console.log('✓ Validates non-empty cart')
    })
  })

  describe('Performance', () => {
    it('should calculate shipping within 3 seconds', async () => {
      if (!testProductId) {
        console.log('⚠️  Skipping: No test product available')
        return
      }

      const startTime = Date.now()

      const response = await fetch(`${baseUrl}/api/checkout/calculate-shipping`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          items: [{ productId: testProductId, quantity: 2 }],
          shippingAddress: {
            address1: '123 Main Street',
            city: 'San Francisco',
            state: 'CA',
            postalCode: '94111',
            country: 'US',
          },
        }),
      })

      const endTime = Date.now()
      const duration = endTime - startTime

      expect(response.status).toBe(200)
      expect(duration).toBeLessThan(3000)

      console.log(`✓ Shipping calculation completed in ${duration}ms`)
    })
  })
})

describe('E2E: Shipping Calculator Test Summary', () => {
  it('should provide test summary', () => {
    console.log(`
╔════════════════════════════════════════════════════════════════════════════╗
║                    SHIPPING CALCULATOR TEST SUMMARY                        ║
╚════════════════════════════════════════════════════════════════════════════╝

Test Coverage:
  ✓ Basic calculator functionality
  ✓ Multiple carrier options
  ✓ Address-based rate calculation
  ✓ State surcharges (AK/HI)
  ✓ PO Box address handling
  ✓ Error handling and validation
  ✓ Performance benchmarks

Run Command:
  npm test tests/e2e/checkout-shipping-calculator.test.ts

Or with Playwright:
  npx playwright test tests/e2e/checkout-shipping-calculator.test.ts

For manual browser testing, see:
  tests/e2e/checkout-shipping-flow.test.ts (lines 776-845)

    `)

    expect(true).toBe(true)
  })
})
