import { it, expect, beforeAll } from 'vitest'
import { describeIfE2E, e2eBaseUrl } from '../helpers/e2e'
import prisma from '@/lib/prisma'

/**
 * Performance Test: Shipping Calculation Under Load
 *
 * This test verifies that the shipping calculation API can handle concurrent requests efficiently.
 * Requirements:
 * - 10 concurrent shipping calculations
 * - All requests complete within 2 seconds
 * - All requests return valid shipping rates
 *
 * Note: This test requires:
 * - Seeded products in database
 * - Shipping API credentials configured (or uses mock rates)
 * - Next.js development server running on http://localhost:3000
 */



describeIfE2E('Performance Test: Shipping Calculation Under Load', () => {
  let testProductId: string | null = null
  const baseUrl = e2eBaseUrl
  const PERFORMANCE_THRESHOLD_MS = 2000 // 2 seconds

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

  it('should handle 10 concurrent shipping calculations within 2 seconds', async () => {
    if (!testProductId) {
      console.log('⚠️  Skipping: No test product available')
      return
    }

    // Prepare test data for concurrent requests
    const testAddresses = [
      {
        address1: '123 Main Street',
        city: 'San Francisco',
        state: 'CA',
        postalCode: '94111',
        country: 'US',
      },
      {
        address1: '456 Market Street',
        city: 'Los Angeles',
        state: 'CA',
        postalCode: '90001',
        country: 'US',
      },
      {
        address1: '789 Broadway',
        city: 'New York',
        state: 'NY',
        postalCode: '10012',
        country: 'US',
      },
      {
        address1: '321 Elm Street',
        city: 'Chicago',
        state: 'IL',
        postalCode: '60601',
        country: 'US',
      },
      {
        address1: '654 Oak Avenue',
        city: 'Houston',
        state: 'TX',
        postalCode: '77001',
        country: 'US',
      },
      {
        address1: '987 Pine Road',
        city: 'Phoenix',
        state: 'AZ',
        postalCode: '85001',
        country: 'US',
      },
      {
        address1: '147 Cedar Lane',
        city: 'Philadelphia',
        state: 'PA',
        postalCode: '19019',
        country: 'US',
      },
      {
        address1: '258 Birch Court',
        city: 'San Diego',
        state: 'CA',
        postalCode: '92101',
        country: 'US',
      },
      {
        address1: '369 Maple Drive',
        city: 'Dallas',
        state: 'TX',
        postalCode: '75201',
        country: 'US',
      },
      {
        address1: '741 Walnut Street',
        city: 'San Jose',
        state: 'CA',
        postalCode: '95101',
        country: 'US',
      },
    ]

    // Create request payload function
    const createRequest = (address: typeof testAddresses[0]) => ({
      items: [
        {
          productId: testProductId,
          quantity: 2,
        },
      ],
      shippingAddress: address,
    })

    // Start performance timer
    const startTime = performance.now()

    // Execute 10 concurrent requests
    const requests = testAddresses.map((address) =>
      fetch(`${baseUrl}/api/checkout/calculate-shipping`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(createRequest(address)),
      })
    )

    // Wait for all requests to complete
    const responses = await Promise.all(requests)

    // Calculate elapsed time
    const endTime = performance.now()
    const elapsedTimeMs = endTime - startTime

    // Verify performance threshold
    console.log(`✓ 10 concurrent requests completed in ${elapsedTimeMs.toFixed(0)}ms`)
    expect(elapsedTimeMs).toBeLessThan(PERFORMANCE_THRESHOLD_MS)

    // Verify all requests succeeded
    const allSucceeded = responses.every((response) => response.status === 200)
    expect(allSucceeded).toBe(true)

    // Verify all responses have valid data
    const results = await Promise.all(responses.map((r) => r.json()))

    results.forEach((data, index) => {
      expect(data).toHaveProperty('shippingCost')
      expect(data).toHaveProperty('shippingMethod')
      expect(data).toHaveProperty('estimatedDelivery')
      expect(data).toHaveProperty('availableOptions')
      expect(typeof data.shippingCost).toBe('number')
      expect(data.shippingCost).toBeGreaterThanOrEqual(0)
    })

    // Calculate and display statistics
    const responseTimes = results.map((_, index) => elapsedTimeMs / 10) // Approximate individual response time
    const avgResponseTime = responseTimes.reduce((a, b) => a + b, 0) / responseTimes.length
    const shippingCosts = results.map((r) => r.shippingCost)
    const avgCost = shippingCosts.reduce((a, b) => a + b, 0) / shippingCosts.length

    console.log('Performance Statistics:')
    console.log(`  Total time: ${elapsedTimeMs.toFixed(0)}ms`)
    console.log(`  Avg response time: ${avgResponseTime.toFixed(0)}ms`)
    console.log(`  Avg shipping cost: $${avgCost.toFixed(2)}`)
    console.log(`  All requests: ${responses.length} succeeded`)
    console.log(`  Performance threshold: ${PERFORMANCE_THRESHOLD_MS}ms`)
    console.log(
      `  Status: ${elapsedTimeMs < PERFORMANCE_THRESHOLD_MS ? '✅ PASS' : '❌ FAIL'}`
    )
  })

  it('should return consistent results for identical requests under load', async () => {
    if (!testProductId) {
      console.log('⚠️  Skipping: No test product available')
      return
    }

    // Same address for all requests
    const sameAddress = {
      address1: '123 Main Street',
      city: 'San Francisco',
      state: 'CA',
      postalCode: '94111',
      country: 'US',
    }

    const requestPayload = {
      items: [
        {
          productId: testProductId,
          quantity: 2,
        },
      ],
      shippingAddress: sameAddress,
    }

    // Execute 10 identical concurrent requests
    const requests = Array(10)
      .fill(null)
      .map(() =>
        fetch(`${baseUrl}/api/checkout/calculate-shipping`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(requestPayload),
        })
      )

    const startTime = performance.now()
    const responses = await Promise.all(requests)
    const elapsedTimeMs = performance.now() - startTime

    console.log(`✓ 10 identical requests completed in ${elapsedTimeMs.toFixed(0)}ms`)

    // Verify all requests succeeded
    expect(responses.every((r) => r.status === 200)).toBe(true)

    // Parse all responses
    const results = await Promise.all(responses.map((r) => r.json()))

    // Verify all results are identical (same shipping cost and method)
    const firstResult = results[0]
    results.forEach((result) => {
      expect(result.shippingCost).toBe(firstResult.shippingCost)
      expect(result.shippingMethod).toBe(firstResult.shippingMethod)
      expect(result.availableOptions?.length).toBe(firstResult.availableOptions?.length)
    })

    console.log('✓ All 10 requests returned consistent results')
    console.log(`  Shipping cost: $${firstResult.shippingCost}`)
    console.log(`  Method: ${firstResult.shippingMethod}`)
    console.log(`  Options: ${firstResult.availableOptions?.length || 0}`)
  })

  it('should handle mixed request types (different states) concurrently', async () => {
    if (!testProductId) {
      console.log('⚠️  Skipping: No test product available')
      return
    }

    // Mix of regular states, Alaska, Hawaii, and international
    const mixedAddresses = [
      { address1: '123 Main St', city: 'San Francisco', state: 'CA', postalCode: '94111', country: 'US' },
      { address1: '456 Market St', city: 'New York', state: 'NY', postalCode: '10012', country: 'US' },
      { address1: '789 Broadway', city: 'Anchorage', state: 'AK', postalCode: '99501', country: 'US' },
      { address1: '321 Elm St', city: 'Honolulu', state: 'HI', postalCode: '96815', country: 'US' },
      { address1: '654 Oak Ave', city: 'Chicago', state: 'IL', postalCode: '60601', country: 'US' },
      { address1: '987 Pine Rd', city: 'Houston', state: 'TX', postalCode: '77001', country: 'US' },
      { address1: '147 Cedar Ln', city: 'Phoenix', state: 'AZ', postalCode: '85001', country: 'US' },
      { address1: '258 Birch Ct', city: 'Philadelphia', state: 'PA', postalCode: '19019', country: 'US' },
      { address1: 'PO Box 123', city: 'San Diego', state: 'CA', postalCode: '92101', country: 'US' },
      { address1: '741 Walnut St', city: 'Dallas', state: 'TX', postalCode: '75201', country: 'US' },
    ]

    const requests = mixedAddresses.map((address) =>
      fetch(`${baseUrl}/api/checkout/calculate-shipping`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          items: [{ productId: testProductId, quantity: 2 }],
          shippingAddress: address,
        }),
      })
    )

    const startTime = performance.now()
    const responses = await Promise.all(requests)
    const elapsedTimeMs = performance.now() - startTime

    console.log(`✓ 10 mixed requests completed in ${elapsedTimeMs.toFixed(0)}ms`)
    expect(elapsedTimeMs).toBeLessThan(PERFORMANCE_THRESHOLD_MS)

    // Verify all requests succeeded
    expect(responses.every((r) => r.status === 200)).toBe(true)

    // Parse all responses
    const results = await Promise.all(responses.map((r) => r.json()))

    // Verify Alaska and Hawaii have higher costs
    const caResult = results[0] // California
    const akResult = results[2] // Alaska
    const hiResult = results[3] // Hawaii

    if (!caResult.fallback && !akResult.fallback && !hiResult.fallback) {
      // Only compare if not using fallback estimates
      console.log(`  CA shipping cost: $${caResult.shippingCost}`)
      console.log(`  AK shipping cost: $${akResult.shippingCost}`)
      console.log(`  HI shipping cost: $${hiResult.shippingCost}`)

      // Alaska and Hawaii carry a multiplier, so they should be more expensive
      if (caResult.shippingCost > 0) {
        expect(akResult.shippingCost).toBeGreaterThanOrEqual(caResult.shippingCost)
        expect(hiResult.shippingCost).toBeGreaterThanOrEqual(caResult.shippingCost)
      }
    }

    console.log('✓ All edge cases handled correctly under load')
  })
})
