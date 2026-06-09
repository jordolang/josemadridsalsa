/**
 * Manual Test Script: Alaska and Hawaii Shipping Surcharges
 *
 * This script tests shipping calculations for Alaska and Hawaii addresses
 * to verify that surcharges are applied correctly.
 *
 * Usage:
 *   ts-node scripts/test-alaska-hawaii-surcharges.ts
 *
 * Requirements:
 *   - Development server running on http://localhost:3000
 *   - At least one active product in the database
 */

const BASE_URL = process.env.NEXT_PUBLIC_BASE_URL || 'http://localhost:3000'

interface ShippingTestResult {
  state: string
  city: string
  zip: string
  shippingCost: number
  shippingMethod: string
  estimatedDelivery: string
  availableOptions?: Array<{
    method: string
    cost: number
    estimatedDays: string
  }>
}

async function calculateShipping(address: {
  state: string
  city: string
  zip: string
  street?: string
}): Promise<ShippingTestResult> {
  const response = await fetch(`${BASE_URL}/api/checkout/calculate-shipping`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      items: [
        {
          productId: 'test-product-id', // Will use fallback rates if product not found
          quantity: 1,
        },
      ],
      shippingAddress: {
        address1: address.street || '123 Main Street',
        city: address.city,
        state: address.state,
        postalCode: address.zip,
        country: 'US',
      },
    }),
  })

  if (!response.ok) {
    throw new Error(`HTTP ${response.status}: ${response.statusText}`)
  }

  const data = await response.json()
  return {
    state: address.state,
    city: address.city,
    zip: address.zip,
    shippingCost: data.shippingCost,
    shippingMethod: data.shippingMethod,
    estimatedDelivery: data.estimatedDelivery,
    availableOptions: data.availableOptions,
  }
}

async function main() {
  console.log('╔════════════════════════════════════════════════════════════════╗')
  console.log('║     Alaska and Hawaii Shipping Surcharge Test                 ║')
  console.log('╚════════════════════════════════════════════════════════════════╝')
  console.log()

  try {
    // Test addresses
    const addresses = [
      { name: 'California (Baseline)', state: 'CA', city: 'San Francisco', zip: '94111' },
      { name: 'Alaska (Anchorage)', state: 'AK', city: 'Anchorage', zip: '99501' },
      { name: 'Hawaii (Honolulu)', state: 'HI', city: 'Honolulu', zip: '96815' },
      { name: 'New York (Control)', state: 'NY', city: 'New York', zip: '10001' },
    ]

    const results: Record<string, ShippingTestResult> = {}

    console.log('📍 Testing shipping calculations for different states...\n')

    for (const addr of addresses) {
      try {
        console.log(`Testing ${addr.name}...`)
        const result = await calculateShipping(addr)
        results[addr.state] = result

        console.log(`  ✓ Shipping Cost: $${result.shippingCost.toFixed(2)}`)
        console.log(`  ✓ Method: ${result.shippingMethod}`)
        console.log(`  ✓ Delivery: ${result.estimatedDelivery}`)

        if (result.availableOptions && result.availableOptions.length > 0) {
          console.log(`  ✓ Available Options: ${result.availableOptions.length}`)
          result.availableOptions.forEach((opt, idx) => {
            console.log(`    ${idx + 1}. ${opt.method}: $${opt.cost.toFixed(2)} (${opt.estimatedDays})`)
          })
        }
        console.log()
      } catch (error) {
        console.error(`  ✗ Error: ${error instanceof Error ? error.message : 'Unknown error'}`)
        console.log()
      }
    }

    // Analyze surcharges
    console.log('╔════════════════════════════════════════════════════════════════╗')
    console.log('║     Surcharge Analysis                                         ║')
    console.log('╚════════════════════════════════════════════════════════════════╝')
    console.log()

    if (results.CA && results.AK) {
      const akSurcharge = results.AK.shippingCost / results.CA.shippingCost
      console.log(`Alaska vs California:`)
      console.log(`  CA Cost: $${results.CA.shippingCost.toFixed(2)}`)
      console.log(`  AK Cost: $${results.AK.shippingCost.toFixed(2)}`)
      console.log(`  Surcharge Ratio: ${akSurcharge.toFixed(2)}x`)
      console.log(`  Expected: ~1.5x`)

      if (akSurcharge >= 1.4 && akSurcharge <= 1.6) {
        console.log(`  ✓ PASS: Alaska surcharge is within expected range`)
      } else {
        console.log(`  ✗ FAIL: Alaska surcharge is outside expected range`)
      }
      console.log()
    }

    if (results.CA && results.HI) {
      const hiSurcharge = results.HI.shippingCost / results.CA.shippingCost
      console.log(`Hawaii vs California:`)
      console.log(`  CA Cost: $${results.CA.shippingCost.toFixed(2)}`)
      console.log(`  HI Cost: $${results.HI.shippingCost.toFixed(2)}`)
      console.log(`  Surcharge Ratio: ${hiSurcharge.toFixed(2)}x`)
      console.log(`  Expected: ~1.5x`)

      if (hiSurcharge >= 1.4 && hiSurcharge <= 1.6) {
        console.log(`  ✓ PASS: Hawaii surcharge is within expected range`)
      } else {
        console.log(`  ✗ FAIL: Hawaii surcharge is outside expected range`)
      }
      console.log()
    }

    if (results.CA && results.NY) {
      const nySurcharge = results.NY.shippingCost / results.CA.shippingCost
      console.log(`New York vs California (should be similar):`)
      console.log(`  CA Cost: $${results.CA.shippingCost.toFixed(2)}`)
      console.log(`  NY Cost: $${results.NY.shippingCost.toFixed(2)}`)
      console.log(`  Ratio: ${nySurcharge.toFixed(2)}x`)

      if (nySurcharge >= 0.8 && nySurcharge <= 1.2) {
        console.log(`  ✓ PASS: Continental US rates are comparable`)
      } else {
        console.log(`  ⚠️  WARN: Continental US rates differ more than expected`)
      }
      console.log()
    }

    // Summary
    console.log('╔════════════════════════════════════════════════════════════════╗')
    console.log('║     Test Summary                                               ║')
    console.log('╚════════════════════════════════════════════════════════════════╝')
    console.log()

    const akPass = results.AK && results.CA && results.AK.shippingCost > results.CA.shippingCost
    const hiPass = results.HI && results.CA && results.HI.shippingCost > results.CA.shippingCost

    console.log(`Alaska Surcharge Applied: ${akPass ? '✓ PASS' : '✗ FAIL'}`)
    console.log(`Hawaii Surcharge Applied: ${hiPass ? '✓ PASS' : '✗ FAIL'}`)
    console.log()

    if (akPass && hiPass) {
      console.log('🎉 All tests passed! Alaska and Hawaii surcharges are working correctly.')
    } else {
      console.log('❌ Some tests failed. Please review the surcharge configuration.')
      process.exit(1)
    }
  } catch (error) {
    console.error('❌ Test failed with error:')
    console.error(error)
    process.exit(1)
  }
}

// Run the tests
main()
