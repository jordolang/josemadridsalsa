import { describe, it, expect, beforeEach, vi } from 'vitest'
import { useCartStore, cartStoreContext } from '@/lib/store/cart'

// The store posts every change to /api/cart/track for abandoned-cart recovery.
vi.stubGlobal('fetch', vi.fn(() => Promise.resolve({ ok: true, json: async () => ({}) })))

const jar = (id: string, store?: { slug: string; name: string }) => ({
  id,
  name: `Salsa ${id}`,
  slug: `salsa-${id}`,
  price: store ? 10 : 9,
  image: `/salsa-${id}.jpg`,
  sku: `SKU-${id}`,
  heatLevel: 'MEDIUM',
  fundraiserSlug: store?.slug,
  fundraiserName: store?.name,
})

const band = { slug: 'zhs-band', name: 'Spring Salsa Drive' }
const soccer = { slug: 'zhs-soccer', name: 'Soccer Kickoff' }

describe('a cart shops in one store at a time', () => {
  beforeEach(() => {
    useCartStore.getState().clearCart()
  })

  it('tags every line with the campaign it was picked from', () => {
    useCartStore.getState().addItem(jar('a', band))

    expect(cartStoreContext(useCartStore.getState().items)).toEqual(band)
  })

  it('reports no store for a retail cart', () => {
    useCartStore.getState().addItem(jar('a'))

    expect(cartStoreContext(useCartStore.getState().items)).toBeNull()
  })

  it('refuses to mix a second campaign into the cart', () => {
    useCartStore.getState().addItem(jar('a', band))
    const result = useCartStore.getState().addItem(jar('b', soccer))

    expect(result).toEqual({ added: false, reason: 'store-conflict', currentStore: band })
    // The band's cart is untouched: a mixed cart has no single price list and no single
    // group to credit.
    expect(useCartStore.getState().items).toHaveLength(1)
  })

  it('refuses to mix retail goods into a campaign cart, and the reverse', () => {
    useCartStore.getState().addItem(jar('a', band))
    expect(useCartStore.getState().addItem(jar('b')).added).toBe(false)

    useCartStore.getState().clearCart()

    useCartStore.getState().addItem(jar('a'))
    expect(useCartStore.getState().addItem(jar('b', band)).added).toBe(false)
  })

  it('starts a fresh cart in the new store when the customer chooses to', () => {
    useCartStore.getState().addItem(jar('a', band))
    useCartStore.getState().replaceWithItem(jar('b', soccer))

    expect(useCartStore.getState().items).toHaveLength(1)
    expect(cartStoreContext(useCartStore.getState().items)).toEqual(soccer)
  })

  it('keeps adding to the same campaign', () => {
    expect(useCartStore.getState().addItem(jar('a', band)).added).toBe(true)
    expect(useCartStore.getState().addItem(jar('b', band)).added).toBe(true)
    expect(useCartStore.getState().totalItems()).toBe(2)
  })

  it('will not put a retail pack into a campaign cart', () => {
    useCartStore.getState().addItem(jar('a', band))

    const added = useCartStore.getState().addBundle(
      'choose-5',
      ['p', 'q', 'r', 's', 't'].map((id) => ({
        productId: id,
        name: `Salsa ${id}`,
        slug: `salsa-${id}`,
        image: `/salsa-${id}.jpg`,
        sku: `SKU-${id}`,
        heatLevel: 'MEDIUM',
        price: 9,
      }))
    )

    expect(added).toBe(false)
    expect(useCartStore.getState().items).toHaveLength(1)
  })
})
