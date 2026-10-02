import { beforeEach, describe, expect, it, vi } from 'vitest'

const calculateTax = vi.fn()
const getShippingOrigin = vi.fn()

vi.mock('@/lib/tax-calculator', () => ({ calculateTax }))
vi.mock('@/lib/shipping/origin', () => ({
  getShippingOrigin,
  describeMissingOrigin: (missing: string[]) => `missing ${missing.join(', ')}`,
}))

const { quotePosTaxCents, PosTaxError } = await import('@/lib/pos/tax')

const STORE = { street1: '1 Main St', city: 'Zanesville', state: 'OH', zip: '43701', country: 'US' }

describe('quotePosTaxCents', () => {
  beforeEach(() => {
    calculateTax.mockReset()
    getShippingOrigin.mockReset()
  })

  it('taxes the sale at the store address as packaged food', async () => {
    getShippingOrigin.mockResolvedValue({ ok: true, origin: STORE })
    calculateTax.mockResolvedValue({ taxAmount: 0 })

    const cents = await quotePosTaxCents([{ productId: 'p1', unitPriceCents: 799, quantity: 3 }])

    expect(cents).toBe(0)
    const input = calculateTax.mock.calls[0][0]
    expect(input.lineItems).toEqual([{ amount: 2397, reference: 'p1', taxCode: 'txcd_30011000' }])
    expect(input.shippingAddress).toMatchObject({ city: 'Zanesville', state: 'OH', postalCode: '43701' })
  })

  it('returns whatever Stripe Tax computes, not a flat rate', async () => {
    getShippingOrigin.mockResolvedValue({ ok: true, origin: STORE })
    calculateTax.mockResolvedValue({ taxAmount: 123 })
    await expect(quotePosTaxCents([{ productId: 'p1', unitPriceCents: 1000, quantity: 1 }])).resolves.toBe(123)
  })

  it('refuses to guess when the store address is not configured', async () => {
    getShippingOrigin.mockResolvedValue({ ok: false, missing: ['street'] })
    await expect(quotePosTaxCents([{ productId: 'p1', unitPriceCents: 1000, quantity: 1 }])).rejects.toBeInstanceOf(PosTaxError)
    expect(calculateTax).not.toHaveBeenCalled()
  })

  it('charges no tax on an empty cart without calling Stripe', async () => {
    await expect(quotePosTaxCents([])).resolves.toBe(0)
    expect(calculateTax).not.toHaveBeenCalled()
  })
})
