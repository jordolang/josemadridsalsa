import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { trackCheckoutStarted } from '@/lib/analytics/checkout-started'
import { trackEvent } from '@/lib/analytics/amplitude'

vi.mock('@/lib/analytics/amplitude', () => ({ trackEvent: vi.fn() }))

type TestWindow = Window & {
  dataLayer?: unknown[]
  fbq?: ReturnType<typeof vi.fn>
  ttq?: { track: ReturnType<typeof vi.fn> }
}
const w = window as TestWindow

const lines = [
  { slug: 'original-hot', name: 'Original Hot', price: 8, quantity: 2 },
  { slug: 'ghost-of-clovis', name: 'Ghost of Clovis', price: 5.6, quantity: 1 },
]

describe('trackCheckoutStarted', () => {
  beforeEach(() => {
    w.dataLayer = []
    w.fbq = vi.fn()
    w.ttq = { track: vi.fn() }
    vi.mocked(trackEvent).mockReset()
  })
  afterEach(() => {
    delete w.dataLayer
    delete w.fbq
    delete w.ttq
  })

  it('tells every tracker the checkout value and items', () => {
    trackCheckoutStarted(lines)

    expect(w.dataLayer).toEqual([
      { ecommerce: null },
      {
        event: 'begin_checkout',
        ecommerce: {
          currency: 'USD',
          value: 21.6,
          items: [
            { item_id: 'original-hot', item_name: 'Original Hot', price: 8, quantity: 2 },
            { item_id: 'ghost-of-clovis', item_name: 'Ghost of Clovis', price: 5.6, quantity: 1 },
          ],
        },
      },
    ])
    expect(w.fbq).toHaveBeenCalledWith('track', 'InitiateCheckout', {
      value: 21.6,
      currency: 'USD',
      num_items: 3,
      content_ids: ['original-hot', 'ghost-of-clovis'],
    })
    expect(w.ttq!.track).toHaveBeenCalledWith('InitiateCheckout', expect.objectContaining({ value: 21.6, currency: 'USD' }))
    expect(trackEvent).toHaveBeenCalledWith('Checkout Started', { value: 21.6, numItems: 3, checkout: 'bigcommerce' })
  })

  it('keeps going when a tracker is missing or throws', () => {
    delete w.ttq
    w.fbq = vi.fn(() => {
      throw new Error('blocked by an ad blocker')
    })

    expect(() => trackCheckoutStarted(lines)).not.toThrow()
    expect(trackEvent).toHaveBeenCalled()
    expect(w.dataLayer).toHaveLength(2)
  })

  it('sends nothing for an empty cart', () => {
    trackCheckoutStarted([])
    expect(w.dataLayer).toEqual([])
    expect(trackEvent).not.toHaveBeenCalled()
  })
})
