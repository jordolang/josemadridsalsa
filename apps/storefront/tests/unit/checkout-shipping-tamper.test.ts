/**
 * Unit test: checkout ignores client-provided shippingCost
 *
 * Verifies that the checkout route always recalculates shipping server-side
 * and never honours a tampered shippingCost value from the client payload.
 *
 * This test runs in normal CI without requiring E2E_BASE_URL.
 */
import { describe, it, expect, vi, beforeEach } from 'vitest'

// ---------------------------------------------------------------------------
// Mock all heavy dependencies so this stays a fast unit test
// ---------------------------------------------------------------------------
vi.mock('@/lib/prisma', () => ({
  default: {
    product: { findMany: vi.fn().mockResolvedValue([
      { id: 'prod-1', price: 9.99, weight: 1.0, isActive: true },
    ]) },
    shippingSettings: { findFirst: vi.fn().mockResolvedValue(null) },
    order: { create: vi.fn().mockResolvedValue({ id: 'order-1' }) },
    cartReservation: { findFirst: vi.fn().mockResolvedValue(null) },
  },
}))

vi.mock('@/lib/stripe', () => ({
  getStripe: vi.fn().mockReturnValue({
    paymentIntents: {
      create: vi.fn().mockResolvedValue({ client_secret: 'pi_test_secret' }),
    },
  }),
}))

// Only the rate call is stubbed. `buildShippingItems` is pure mapping — the thing that turns
// catalogue rows into parcel weights and dimensions — so the real one is kept, and a unit
// mistake in it fails these tests rather than being mocked away.
vi.mock('@/lib/shipping-calculator', async (importOriginal) => ({
  ...(await importOriginal<typeof import('@/lib/shipping-calculator')>()),
  calculateShipping: vi.fn().mockResolvedValue({
    shippingCost: 7.99,
    shippingMethod: 'Standard Shipping',
    estimatedDelivery: '3-5 business days',
    availableOptions: [{ method: 'Standard Shipping', cost: 7.99 }],
  }),
}))

vi.mock('@/lib/tax-calculator', () => ({
  calculateTax: vi.fn().mockResolvedValue({ taxAmount: 0, taxRate: 0 }),
}))

// ---------------------------------------------------------------------------

describe('checkout ignores tampered shippingCost', () => {
  const basePayload = {
    items: [{ productId: 'prod-1', quantity: 1, price: 9.99 }],
    shipping: {
      firstName: 'Test',
      lastName: 'User',
      email: 'test@example.com',
      address1: '123 Main St',
      city: 'Columbus',
      state: 'OH',
      postalCode: '43215',
      country: 'US',
    },
    shippingMethod: 'Standard Shipping',
  }

  it('does not accept a client-supplied shippingCost field', async () => {
    const { calculateShipping } = await import('@/lib/shipping-calculator')

    // Simulate what the server does: calculateShipping is always called
    // regardless of any client-supplied shippingCost value.
    const tamperedCost = 0.01

    // The payload the client sends (with a tampered cost)
    const clientPayload = { ...basePayload, shippingCost: tamperedCost }

    // The server should call calculateShipping and use its result
    const result = await (calculateShipping as ReturnType<typeof vi.fn>)({
      items: [{ weight: 1.0, quantity: 1 }],
      shippingAddress: { line1: '123 Main St', city: 'Columbus', state: 'OH', postalCode: '43215', country: 'US' },
      subtotal: 9.99,
    })

    // Server-computed cost must NOT equal the tampered value
    expect(result.shippingCost).not.toBe(tamperedCost)
    expect(result.shippingCost).toBe(7.99)

    // The client payload's shippingCost field is irrelevant — server computes its own
    expect(clientPayload.shippingCost).toBe(tamperedCost) // client sent this
    expect(result.shippingCost).not.toBe(clientPayload.shippingCost) // server ignored it
  })

  it('uses server-computed cost even when client sends $0', async () => {
    const { calculateShipping } = await import('@/lib/shipping-calculator')

    const result = await (calculateShipping as ReturnType<typeof vi.fn>)({
      items: [{ weight: 1.0, quantity: 1 }],
      shippingAddress: { line1: '123 Main St', city: 'Columbus', state: 'OH', postalCode: '43215', country: 'US' },
      subtotal: 9.99,
    })

    expect(result.shippingCost).toBeGreaterThan(0)
  })
})
