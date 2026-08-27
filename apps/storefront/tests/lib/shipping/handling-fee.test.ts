import { beforeEach, describe, expect, it, vi } from 'vitest'

import { HANDLING_FEE, HANDLING_FEE_CENTS, withHandlingFee } from '@/lib/shipping/handling-fee'

/**
 * The packaging-and-materials fee.
 *
 * Shipping used to be quoted as the carrier's price for moving the parcel and nothing else, so the
 * box, dividers, tape and label came out of margin on every order. These pin the two things that
 * matter: the fee is $4, and it is on *every* quote — live carrier rate, domestic estimate and
 * international flat rate alike — because a path that forgets it is a path that ships at a loss.
 */

vi.mock('@/lib/prisma', () => ({
  prisma: {
    shippingSettings: { findUnique: vi.fn().mockResolvedValue(null) },
  },
  default: {
    shippingSettings: { findUnique: vi.fn().mockResolvedValue(null) },
  },
}))

vi.mock('@/lib/shipping/origin', async (importOriginal) => ({
  ...(await importOriginal<typeof import('@/lib/shipping/origin')>()),
  getShippingOrigin: vi.fn(),
}))

vi.mock('@/lib/shipping-api', async (importOriginal) => ({
  ...(await importOriginal<typeof import('@/lib/shipping-api')>()),
  getShippingRates: vi.fn(),
}))

const { calculateShipping, getShippingEstimate } = await import('@/lib/shipping-calculator')
const { getShippingOrigin } = await import('@/lib/shipping/origin')
const { getShippingRates } = await import('@/lib/shipping-api')

const ORIGIN = {
  name: 'Jose Madrid Salsa',
  street1: '321 Market St',
  city: 'Zanesville',
  state: 'OH',
  zip: '43701',
  country: 'US',
}

const domesticAddress = { state: 'OH', postalCode: '43701', country: 'US' }

describe('withHandlingFee', () => {
  it('is $4', () => {
    expect(HANDLING_FEE_CENTS).toBe(400)
    expect(HANDLING_FEE).toBe(4)
  })

  it('adds the fee to a rate', () => {
    expect(withHandlingFee(6.99)).toBe(10.99)
  })

  it('rounds to cents rather than trailing float noise', () => {
    // 10.485 rounds to 10.48 upstream; adding 4 must not reintroduce a third decimal.
    expect(withHandlingFee(10.48)).toBe(14.48)
    expect(withHandlingFee(0.1 + 0.2)).toBe(4.3)
  })

  it('still charges for packaging when the carriage is free', () => {
    // A $0 rate is not a free order: the box was still bought and packed.
    expect(withHandlingFee(0)).toBe(4)
  })
})

describe('shipping quotes include the packaging fee', () => {
  beforeEach(() => {
    vi.mocked(getShippingOrigin).mockResolvedValue({ ok: true, origin: ORIGIN })
    vi.mocked(getShippingRates).mockReset()
  })

  it('adds it to a live carrier rate', async () => {
    vi.mocked(getShippingRates).mockResolvedValue({
      rates: [
        {
          id: 'rate_1',
          carrier: 'USPS',
          service: 'GroundAdvantage',
          rate: 8.35,
          deliveryDays: 3,
        },
      ],
    } as Awaited<ReturnType<typeof getShippingRates>>)

    const result = await calculateShipping({
      items: [{ quantity: 2, weightOz: 16 }],
      shippingAddress: domesticAddress,
      subtotal: 25,
    })

    expect(result.shippingCost).toBe(12.35)
    expect(result.availableOptions?.[0].cost).toBe(12.35)
  })

  it('adds it to the domestic estimate when no carrier rate comes back', async () => {
    vi.mocked(getShippingRates).mockResolvedValue({ rates: [] } as Awaited<
      ReturnType<typeof getShippingRates>
    >)

    const result = await calculateShipping({
      items: [{ quantity: 2, weightOz: 16 }],
      shippingAddress: domesticAddress,
      subtotal: 25,
    })

    expect(result.fallback).toBe(true)
    expect(result.shippingCost).toBe(10.99)
  })

  it('adds it once to an international order, not per item', async () => {
    const result = await calculateShipping({
      items: [{ quantity: 6, weightOz: 16 }],
      shippingAddress: { state: 'ON', postalCode: 'M5H 2N2', country: 'CA' },
      subtotal: 60,
    })

    expect(result.shippingCost).toBe(28.99)
  })

  it('adds it to the frontend preview, so the estimate matches checkout', async () => {
    expect(await getShippingEstimate({ subtotal: 25, state: 'OH', country: 'US' })).toBe(10.99)
  })
})
