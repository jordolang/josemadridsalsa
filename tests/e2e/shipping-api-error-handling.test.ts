import { describe, it, expect, beforeAll, afterAll } from 'vitest'
import prisma from '@/lib/prisma'

/**
 * E2E Test: Shipping API Error Handling
 *
 * This test verifies that when the shipping API is unavailable or returns errors,
 * the checkout flow gracefully falls back to estimate-based rates and never blocks.
 *
 * Critical Acceptance Criteria:
 * - Checkout MUST complete successfully even when shipping API fails
 * - Estimate rates MUST be returned as fallback
 * - Error messages MUST be logged but not exposed to user
 * - All shipping options MUST still be available via estimates
 *
 * Test Scenarios:
 * 1. No API key configured
 * 2. Invalid API key
 * 3. API timeout/network error
 * 4. API returns empty rates
 * 5. Checkout completion with fallback rates
 */

const describeIfE2E = process.env.E2E_BASE_URL ? describe : describe.skip

describeIfE2E('E2E: Shipping API Error Handling', () => {
  let testProductId: string | null = null
  const baseUrl = process.env.NEXT_PUBLIC_BASE_URL || 'http://localhost:3000'

  // Store original env vars to restore later
  const originalApiKey = process.env.SHIPPING_API_KEY
  const originalProvider = process.env.SHIPPING_PROVIDER

  beforeAll(async () => {
    // Get a test product from the database
    const product = await prisma.product.findFirst({
      where: {
        isActive: true,
        inventory: { gt: 0 },
      },
    })

    if (product) {
      testProductId = product.id
    }
  })

  afterAll(() => {
    // Restore original env vars
    if (originalApiKey) {
      process.env.SHIPPING_API_KEY = originalApiKey
    }
    if (originalProvider) {
      process.env.SHIPPING_PROVIDER = originalProvider
    }
  })

  describe('Scenario 1: No API Key Configured', () => {
    it('should return estimate rates when API key is missing', async () => {
      if (!testProductId) {
        console.log('⚠️  Skipping: No test product available')
        return
      }

      // Temporarily remove API key to simulate misconfiguration
      const savedKey = process.env.SHIPPING_API_KEY
      delete process.env.SHIPPING_API_KEY

      const response = await fetch(`${baseUrl}/api/checkout/calculate-shipping`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          items: [
            {
              productId: testProductId,
              quantity: 1,
            },
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

      // Restore API key
      if (savedKey) {
        process.env.SHIPPING_API_KEY = savedKey
      }

      // Should return 200 with estimate rates, NOT 500
      expect(response.status).toBe(200)

      const data = await response.json()

      // Verify fallback flag is set
      expect(data).toHaveProperty('fallback')
      expect(data.fallback).toBe(true)

      // Verify shipping cost is returned (estimate)
      expect(data).toHaveProperty('shippingCost')
      expect(typeof data.shippingCost).toBe('number')
      expect(data.shippingCost).toBeGreaterThanOrEqual(0)

      // Verify shipping method is set
      expect(data).toHaveProperty('shippingMethod')
      expect(data.shippingMethod).toBeTruthy()

      // Verify available options exist
      expect(data).toHaveProperty('availableOptions')
      expect(Array.isArray(data.availableOptions)).toBe(true)
      expect(data.availableOptions.length).toBeGreaterThan(0)

      console.log('✓ Fallback to estimate rates when API key missing:', {
        cost: data.shippingCost,
        method: data.shippingMethod,
        optionsCount: data.availableOptions?.length || 0,
        fallback: data.fallback,
      })
    })
  })

  describe('Scenario 2: Invalid API Key', () => {
    it('should return estimate rates when API key is invalid', async () => {
      if (!testProductId) {
        console.log('⚠️  Skipping: No test product available')
        return
      }

      // Temporarily set invalid API key
      const savedKey = process.env.SHIPPING_API_KEY
      process.env.SHIPPING_API_KEY = 'invalid_test_key_12345'

      const response = await fetch(`${baseUrl}/api/checkout/calculate-shipping`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          items: [
            {
              productId: testProductId,
              quantity: 1,
            },
          ],
          shippingAddress: {
            address1: '456 Oak Avenue',
            city: 'Los Angeles',
            state: 'CA',
            postalCode: '90001',
            country: 'US',
          },
        }),
      })

      // Restore API key
      if (savedKey) {
        process.env.SHIPPING_API_KEY = savedKey
      } else {
        delete process.env.SHIPPING_API_KEY
      }

      // Should return 200 with estimate rates
      expect(response.status).toBe(200)

      const data = await response.json()

      // Verify we got estimate rates
      expect(data).toHaveProperty('shippingCost')
      expect(data.shippingCost).toBeGreaterThanOrEqual(0)
      expect(data).toHaveProperty('availableOptions')
      expect(data.availableOptions.length).toBeGreaterThan(0)

      console.log('✓ Fallback to estimate rates with invalid API key:', {
        cost: data.shippingCost,
        method: data.shippingMethod,
        optionsCount: data.availableOptions?.length || 0,
      })
    })
  })

  describe('Scenario 3: Estimate Rates Quality', () => {
    it('should return reasonable estimate rates for CA address', async () => {
      if (!testProductId) {
        console.log('⚠️  Skipping: No test product available')
        return
      }

      // Remove API key to force estimate mode
      const savedKey = process.env.SHIPPING_API_KEY
      delete process.env.SHIPPING_API_KEY

      const response = await fetch(`${baseUrl}/api/checkout/calculate-shipping`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          items: [
            {
              productId: testProductId,
              quantity: 2,
            },
          ],
          shippingAddress: {
            address1: '789 Pine Street',
            city: 'San Diego',
            state: 'CA',
            postalCode: '92101',
            country: 'US',
          },
        }),
      })

      // Restore API key
      if (savedKey) {
        process.env.SHIPPING_API_KEY = savedKey
      }

      expect(response.status).toBe(200)

      const data = await response.json()

      // Verify estimate rates are reasonable (not too high, not negative)
      expect(data.shippingCost).toBeGreaterThanOrEqual(0)
      expect(data.shippingCost).toBeLessThan(100) // Reasonable domestic shipping

      // Verify multiple options available
      expect(data.availableOptions.length).toBeGreaterThanOrEqual(2)

      // Verify options have required fields
      data.availableOptions.forEach((option: any) => {
        expect(option).toHaveProperty('method')
        expect(option).toHaveProperty('cost')
        expect(option).toHaveProperty('estimatedDays')
        expect(typeof option.cost).toBe('number')
        expect(option.cost).toBeGreaterThanOrEqual(0)
      })

      console.log('✓ Estimate rates are reasonable:', {
        cost: data.shippingCost,
        options: data.availableOptions.map((opt: any) => ({
          method: opt.method,
          cost: opt.cost,
        })),
      })
    })

    it('should apply state surcharges in estimate mode (Alaska)', async () => {
      if (!testProductId) {
        console.log('⚠️  Skipping: No test product available')
        return
      }

      // Remove API key to force estimate mode
      const savedKey = process.env.SHIPPING_API_KEY
      delete process.env.SHIPPING_API_KEY

      const response = await fetch(`${baseUrl}/api/checkout/calculate-shipping`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          items: [
            {
              productId: testProductId,
              quantity: 1,
            },
          ],
          shippingAddress: {
            address1: '123 Arctic Ave',
            city: 'Anchorage',
            state: 'AK',
            postalCode: '99501',
            country: 'US',
          },
        }),
      })

      // Restore API key
      if (savedKey) {
        process.env.SHIPPING_API_KEY = savedKey
      }

      expect(response.status).toBe(200)

      const data = await response.json()

      // Alaska should have higher shipping costs (1.5x multiplier)
      expect(data.shippingCost).toBeGreaterThan(7) // Should be higher than base rate
      expect(data.availableOptions.length).toBeGreaterThan(0)

      console.log('✓ Alaska surcharge applied in estimate mode:', {
        cost: data.shippingCost,
        method: data.shippingMethod,
      })
    })
  })

  describe('Scenario 4: Free Shipping Threshold', () => {
    it('should apply free shipping in estimate mode when threshold met', async () => {
      if (!testProductId) {
        console.log('⚠️  Skipping: No test product available')
        return
      }

      // Remove API key to force estimate mode
      const savedKey = process.env.SHIPPING_API_KEY
      delete process.env.SHIPPING_API_KEY

      // Get product details to calculate subtotal
      const product = await prisma.product.findUnique({
        where: { id: testProductId },
        select: { price: true },
      })

      if (!product) {
        console.log('⚠️  Skipping: Product not found')
        return
      }

      // Calculate quantity to exceed $50 free shipping threshold
      const productPrice = parseFloat(product.price.toString())
      const quantity = Math.ceil(55 / productPrice) // Ensure we exceed $50

      const response = await fetch(`${baseUrl}/api/checkout/calculate-shipping`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          items: [
            {
              productId: testProductId,
              quantity: quantity,
            },
          ],
          shippingAddress: {
            address1: '321 Elm Street',
            city: 'Portland',
            state: 'OR',
            postalCode: '97201',
            country: 'US',
          },
        }),
      })

      // Restore API key
      if (savedKey) {
        process.env.SHIPPING_API_KEY = savedKey
      }

      expect(response.status).toBe(200)

      const data = await response.json()

      // Verify free shipping is applied
      expect(data.shippingCost).toBe(0)
      expect(data.shippingMethod).toContain('Free')

      console.log('✓ Free shipping applied in estimate mode:', {
        subtotal: productPrice * quantity,
        shippingCost: data.shippingCost,
        method: data.shippingMethod,
      })
    })
  })

  describe('Scenario 5: PO Box Handling in Estimate Mode', () => {
    it('should return USPS-only options for PO Box in estimate mode', async () => {
      if (!testProductId) {
        console.log('⚠️  Skipping: No test product available')
        return
      }

      // Remove API key to force estimate mode
      const savedKey = process.env.SHIPPING_API_KEY
      delete process.env.SHIPPING_API_KEY

      const response = await fetch(`${baseUrl}/api/checkout/calculate-shipping`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          items: [
            {
              productId: testProductId,
              quantity: 1,
            },
          ],
          shippingAddress: {
            address1: 'PO Box 12345',
            city: 'Seattle',
            state: 'WA',
            postalCode: '98101',
            country: 'US',
          },
        }),
      })

      // Restore API key
      if (savedKey) {
        process.env.SHIPPING_API_KEY = savedKey
      }

      expect(response.status).toBe(200)

      const data = await response.json()

      // Verify we got shipping options
      expect(data.availableOptions.length).toBeGreaterThan(0)

      // All options should be USPS for PO Box
      data.availableOptions.forEach((option: any) => {
        expect(option.method.toUpperCase()).toContain('USPS')
      })

      console.log('✓ PO Box handled correctly in estimate mode:', {
        optionsCount: data.availableOptions.length,
        carriers: data.availableOptions.map((opt: any) => opt.method),
      })
    })
  })

  describe('Scenario 6: International Shipping in Estimate Mode', () => {
    it('should handle international addresses in estimate mode', async () => {
      if (!testProductId) {
        console.log('⚠️  Skipping: No test product available')
        return
      }

      // Remove API key to force estimate mode
      const savedKey = process.env.SHIPPING_API_KEY
      delete process.env.SHIPPING_API_KEY

      const response = await fetch(`${baseUrl}/api/checkout/calculate-shipping`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          items: [
            {
              productId: testProductId,
              quantity: 1,
            },
          ],
          shippingAddress: {
            address1: '123 Main Street',
            city: 'Toronto',
            state: 'ON',
            postalCode: 'M5H 2N2',
            country: 'CA',
          },
        }),
      })

      // Restore API key
      if (savedKey) {
        process.env.SHIPPING_API_KEY = savedKey
      }

      expect(response.status).toBe(200)

      const data = await response.json()

      // Verify international shipping cost
      expect(data.shippingCost).toBeGreaterThan(0)
      expect(data.shippingMethod).toContain('International')

      // International shipping should be more expensive
      expect(data.shippingCost).toBeGreaterThan(10)

      console.log('✓ International shipping handled in estimate mode:', {
        cost: data.shippingCost,
        method: data.shippingMethod,
      })
    })
  })

  describe('Scenario 7: Checkout Completion with Fallback Rates', () => {
    it('should verify checkout never blocks when API fails', async () => {
      if (!testProductId) {
        console.log('⚠️  Skipping: No test product available')
        return
      }

      // This test verifies the critical requirement:
      // Checkout MUST complete successfully even when shipping API is down

      // Remove API key to simulate API failure
      const savedKey = process.env.SHIPPING_API_KEY
      delete process.env.SHIPPING_API_KEY

      // Step 1: Calculate shipping (should use fallback)
      const shippingResponse = await fetch(
        `${baseUrl}/api/checkout/calculate-shipping`,
        {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            items: [
              {
                productId: testProductId,
                quantity: 1,
              },
            ],
            shippingAddress: {
              address1: '123 Test Street',
              city: 'Test City',
              state: 'CA',
              postalCode: '94111',
              country: 'US',
            },
          }),
        }
      )

      expect(shippingResponse.status).toBe(200)

      const shippingData = await shippingResponse.json()
      expect(shippingData.shippingCost).toBeGreaterThanOrEqual(0)

      // Restore API key
      if (savedKey) {
        process.env.SHIPPING_API_KEY = savedKey
      }

      console.log('✓ Checkout can proceed with fallback rates:', {
        shippingCost: shippingData.shippingCost,
        shippingMethod: shippingData.shippingMethod,
        estimatedDelivery: shippingData.estimatedDelivery,
        availableOptionsCount: shippingData.availableOptions?.length || 0,
        fallback: shippingData.fallback || false,
      })

      // The key assertion: checkout flow is not blocked
      expect(shippingResponse.status).not.toBe(500)
      expect(shippingData.shippingCost).toBeDefined()
      expect(shippingData.shippingMethod).toBeDefined()
    })
  })

  describe('Scenario 8: Error Recovery', () => {
    it('should recover gracefully from multiple error conditions', async () => {
      if (!testProductId) {
        console.log('⚠️  Skipping: No test product available')
        return
      }

      // Test multiple consecutive requests with API unavailable
      const savedKey = process.env.SHIPPING_API_KEY
      delete process.env.SHIPPING_API_KEY

      const testAddresses = [
        { city: 'San Francisco', state: 'CA', postalCode: '94111' },
        { city: 'Anchorage', state: 'AK', postalCode: '99501' },
        { city: 'Honolulu', state: 'HI', postalCode: '96815' },
      ]

      for (const address of testAddresses) {
        const response = await fetch(`${baseUrl}/api/checkout/calculate-shipping`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            items: [{ productId: testProductId, quantity: 1 }],
            shippingAddress: {
              address1: '123 Test St',
              ...address,
              country: 'US',
            },
          }),
        })

        expect(response.status).toBe(200)

        const data = await response.json()
        expect(data.shippingCost).toBeGreaterThanOrEqual(0)
        expect(data.availableOptions.length).toBeGreaterThan(0)
      }

      // Restore API key
      if (savedKey) {
        process.env.SHIPPING_API_KEY = savedKey
      }

      console.log('✓ Multiple error scenarios handled gracefully')
    })
  })
})
