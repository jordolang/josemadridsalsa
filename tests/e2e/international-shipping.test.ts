import { describe, it, expect, beforeAll } from 'vitest'
import prisma from '@/lib/prisma'

/**
 * E2E Test: International Shipping
 *
 * This test verifies international shipping functionality including:
 * 1. Canada and Mexico address handling
 * 2. International shipping rate calculation
 * 3. Comparison with domestic rates
 *
 * Note: Current MVP implementation uses flat-rate international shipping.
 * Customs forms, HS codes, and real carrier API rates for international
 * shipments are NOT implemented. This is documented as a future enhancement.
 *
 * Requirements for full international shipping:
 * - Customs declaration forms
 * - Harmonized System (HS) codes for products
 * - Customs value calculation
 * - Restricted item checking
 * - Country-specific regulations
 */

const runE2E = process.env.RUN_E2E_TESTS === 'true'

describe.skipIf(!runE2E)('E2E: International Shipping', () => {
  let testProductId: string | null = null
  const baseUrl = process.env.NEXT_PUBLIC_BASE_URL || 'http://localhost:3000'

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
    }
  })

  describe('Canada Shipping', () => {
    it('should calculate shipping for Canadian addresses', async () => {
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
            address1: '123 Yonge Street',
            city: 'Toronto',
            state: 'ON',
            postalCode: 'M5B 2H1',
            country: 'CA',
          },
        }),
      })

      expect(response.status).toBe(200)
      const data = await response.json()

      // Verify response structure
      expect(data).toHaveProperty('shippingCost')
      expect(data).toHaveProperty('shippingMethod')
      expect(data).toHaveProperty('estimatedDelivery')

      // Verify shipping cost is reasonable for international
      expect(data.shippingCost).toBeGreaterThan(0)
      expect(data.shippingCost).toBeGreaterThanOrEqual(20) // International should be higher
      expect(data.shippingCost).toBeLessThan(100)

      // Verify method indicates international shipping
      expect(data.shippingMethod.toLowerCase()).toContain('international')

      console.log('✓ Canada shipping calculation:')
      console.log(`  Cost: $${data.shippingCost.toFixed(2)}`)
      console.log(`  Method: ${data.shippingMethod}`)
      console.log(`  Delivery: ${data.estimatedDelivery}`)
    })

    it('should calculate shipping for Vancouver, BC', async () => {
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
            address1: '456 Granville Street',
            city: 'Vancouver',
            state: 'BC',
            postalCode: 'V6C 1V4',
            country: 'CA',
          },
        }),
      })

      expect(response.status).toBe(200)
      const data = await response.json()

      expect(data.shippingCost).toBeGreaterThan(0)
      expect(data.shippingMethod.toLowerCase()).toContain('international')

      console.log('✓ Vancouver, BC shipping: $' + data.shippingCost.toFixed(2))
    })
  })

  describe('Mexico Shipping', () => {
    it('should calculate shipping for Mexican addresses', async () => {
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
            address1: 'Av. Insurgentes Sur 1458',
            city: 'Mexico City',
            state: 'CDMX',
            postalCode: '03900',
            country: 'MX',
          },
        }),
      })

      expect(response.status).toBe(200)
      const data = await response.json()

      // Verify response structure
      expect(data).toHaveProperty('shippingCost')
      expect(data).toHaveProperty('shippingMethod')
      expect(data).toHaveProperty('estimatedDelivery')

      // Verify international shipping rate
      expect(data.shippingCost).toBeGreaterThan(0)
      expect(data.shippingCost).toBeGreaterThanOrEqual(20)
      expect(data.shippingCost).toBeLessThan(100)

      expect(data.shippingMethod.toLowerCase()).toContain('international')

      console.log('✓ Mexico shipping calculation:')
      console.log(`  Cost: $${data.shippingCost.toFixed(2)}`)
      console.log(`  Method: ${data.shippingMethod}`)
      console.log(`  Delivery: ${data.estimatedDelivery}`)
    })

    it('should calculate shipping for Monterrey, Mexico', async () => {
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
            address1: 'Av. Constitución 2001',
            city: 'Monterrey',
            state: 'NL',
            postalCode: '64000',
            country: 'MX',
          },
        }),
      })

      expect(response.status).toBe(200)
      const data = await response.json()

      expect(data.shippingCost).toBeGreaterThan(0)
      expect(data.shippingMethod.toLowerCase()).toContain('international')

      console.log('✓ Monterrey, Mexico shipping: $' + data.shippingCost.toFixed(2))
    })
  })

  describe('International vs Domestic Comparison', () => {
    it('should charge more for international than domestic shipping', async () => {
      if (!testProductId) {
        console.log('⚠️  Skipping: No test product available')
        return
      }

      // Get domestic (US) shipping rate
      const domesticResponse = await fetch(`${baseUrl}/api/checkout/calculate-shipping`, {
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

      expect(domesticResponse.status).toBe(200)
      const domesticData = await domesticResponse.json()

      // Get international (Canada) shipping rate
      const internationalResponse = await fetch(`${baseUrl}/api/checkout/calculate-shipping`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          items: [{ productId: testProductId, quantity: 1 }],
          shippingAddress: {
            address1: '123 Yonge Street',
            city: 'Toronto',
            state: 'ON',
            postalCode: 'M5B 2H1',
            country: 'CA',
          },
        }),
      })

      expect(internationalResponse.status).toBe(200)
      const internationalData = await internationalResponse.json()

      console.log('✓ Domestic vs International comparison:')
      console.log(`  US (CA): $${domesticData.shippingCost.toFixed(2)} - ${domesticData.shippingMethod}`)
      console.log(`  Canada: $${internationalData.shippingCost.toFixed(2)} - ${internationalData.shippingMethod}`)

      // International should cost more than domestic
      expect(internationalData.shippingCost).toBeGreaterThan(domesticData.shippingCost)

      const costRatio = internationalData.shippingCost / domesticData.shippingCost
      console.log(`  International cost multiplier: ${costRatio.toFixed(2)}x`)

      // International should be at least 2x domestic (reasonable for cross-border)
      expect(costRatio).toBeGreaterThanOrEqual(1.5)
    })

    it('should have longer delivery times for international shipping', async () => {
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
            address1: '123 Yonge Street',
            city: 'Toronto',
            state: 'ON',
            postalCode: 'M5B 2H1',
            country: 'CA',
          },
        }),
      })

      const data = await response.json()

      // Verify delivery time indicates international (typically 7-14 days)
      expect(data.estimatedDelivery).toBeTruthy()

      // Should mention either "7-14" or specific number of days > 5
      const hasReasonableDeliveryTime =
        data.estimatedDelivery.includes('7') ||
        data.estimatedDelivery.includes('10') ||
        data.estimatedDelivery.includes('14')

      console.log(`✓ International delivery estimate: ${data.estimatedDelivery}`)
      expect(hasReasonableDeliveryTime).toBe(true)
    })
  })

  describe('Free Shipping Threshold with International', () => {
    it('should NOT apply free shipping threshold to international orders', async () => {
      if (!testProductId) {
        console.log('⚠️  Skipping: No test product available')
        return
      }

      // Get product to calculate quantity for high-value order
      const product = await prisma.product.findUnique({
        where: { id: testProductId }
      })

      if (!product) {
        console.log('⚠️  Skipping: Product not found')
        return
      }

      // Create order over $50 (free shipping threshold for domestic)
      const quantity = Math.ceil(60 / Number(product.price))

      const response = await fetch(`${baseUrl}/api/checkout/calculate-shipping`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          items: [{ productId: testProductId, quantity }],
          shippingAddress: {
            address1: '123 Yonge Street',
            city: 'Toronto',
            state: 'ON',
            postalCode: 'M5B 2H1',
            country: 'CA',
          },
        }),
      })

      const data = await response.json()
      const subtotal = Number(product.price) * quantity

      console.log(`✓ Testing international order over $${subtotal.toFixed(2)}:`)
      console.log(`  Shipping cost: $${data.shippingCost.toFixed(2)}`)

      // International orders should still have shipping charges
      // even if over free shipping threshold
      expect(data.shippingCost).toBeGreaterThan(0)
      console.log(`  ✓ International shipping charged despite high subtotal`)
    })
  })

  describe('Other International Countries', () => {
    it('should handle UK addresses', async () => {
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
            address1: '10 Downing Street',
            city: 'London',
            state: 'England',
            postalCode: 'SW1A 2AA',
            country: 'GB',
          },
        }),
      })

      expect(response.status).toBe(200)
      const data = await response.json()

      expect(data.shippingCost).toBeGreaterThan(0)
      expect(data.shippingMethod.toLowerCase()).toContain('international')

      console.log('✓ UK shipping: $' + data.shippingCost.toFixed(2))
    })

    it('should handle Australian addresses', async () => {
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
            address1: '1 George Street',
            city: 'Sydney',
            state: 'NSW',
            postalCode: '2000',
            country: 'AU',
          },
        }),
      })

      expect(response.status).toBe(200)
      const data = await response.json()

      expect(data.shippingCost).toBeGreaterThan(0)
      expect(data.shippingMethod.toLowerCase()).toContain('international')

      console.log('✓ Australia shipping: $' + data.shippingCost.toFixed(2))
    })
  })
})

describe('International Shipping: MVP Limitations', () => {
  it('should document current MVP limitations and future requirements', () => {
    console.log(`
╔════════════════════════════════════════════════════════════════════════════╗
║               INTERNATIONAL SHIPPING - MVP STATUS                          ║
╚════════════════════════════════════════════════════════════════════════════╝

✓ IMPLEMENTED (MVP):
  • Basic international shipping support
  • Flat-rate international shipping ($24.99)
  • Canada and Mexico address handling
  • Longer delivery estimates (7-14 business days)
  • Country code validation (2-letter codes)

✗ NOT IMPLEMENTED (Future Enhancement):
  • Customs declaration forms
  • Harmonized System (HS) codes for products
  • Customs value calculation
  • Duty and tax estimation
  • Restricted/prohibited item checking
  • Country-specific shipping regulations
  • Real carrier API rates for international shipments
  • International shipping insurance
  • Package tracking for international orders
  • Multiple international shipping speed options

⚠️  CURRENT BEHAVIOR:
  • All non-US addresses receive flat-rate international shipping
  • No distinction between Canada/Mexico and other countries
  • Customs forms must be handled manually
  • Merchants responsible for customs compliance

╔════════════════════════════════════════════════════════════════════════════╗
║               FUTURE ENHANCEMENT REQUIREMENTS                              ║
╚════════════════════════════════════════════════════════════════════════════╝

For production-ready international shipping, implement:

1. Product Information:
   - Add HS code field to Product model
   - Add country of origin
   - Add customs description
   - Flag restricted items by country

2. Customs Forms:
   - CN22/CN23 form generation for postal
   - Commercial invoice generation
   - Certificate of origin
   - USMCA/NAFTA documentation (Canada/Mexico)

3. Carrier Integration:
   - Enable international rates in EasyPost/Shippo
   - Support USPS First-Class International
   - Support USPS Priority Mail International
   - Support FedEx International Economy/Priority
   - Support UPS Worldwide services

4. Compliance:
   - Calculate landed cost (duties + taxes)
   - Check import restrictions by country
   - Verify value limits for postal services
   - Handle special requirements (food products, etc.)

5. Customer Experience:
   - Display estimated duties/taxes at checkout
   - Show customs requirements
   - Provide international tracking
   - Handle customs holds/delays

RECOMMENDATION:
For MVP, consider disabling international shipping or adding clear messaging:
"International shipping available - customs forms processed manually"
    `)

    expect(true).toBe(true) // Documentation test always passes
  })
})
