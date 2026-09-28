import { describe, it, expect, beforeEach, vi } from 'vitest'
import { useCartStore, toCheckoutItems, cartItemProductId } from '@/lib/store/cart'
import type { BundleSelection } from '@/lib/store/cart'

// The store posts every change to /api/cart/track for abandoned-cart recovery.
vi.stubGlobal('fetch', vi.fn(() => Promise.resolve({ ok: true, json: async () => ({}) })))

const jar = (id: string, price = 9): BundleSelection => ({
  productId: id,
  name: `Salsa ${id}`,
  slug: `salsa-${id}`,
  image: `/salsa-${id}.jpg`,
  sku: `SKU-${id}`,
  heatLevel: 'MEDIUM',
  price,
})

const cartTotal = () =>
  Math.round(
    useCartStore.getState().items.reduce((sum, item) => sum + item.price * item.quantity, 0) * 100
  ) / 100

describe('cart packs', () => {
  beforeEach(() => {
    useCartStore.getState().clearCart()
  })

  it('adds a Choose 5 at the advertised $28, not five jars at $9', () => {
    const added = useCartStore
      .getState()
      .addBundle('choose-5', ['a', 'b', 'c', 'd', 'e'].map((id) => jar(id)))

    expect(added).toBe(true)
    expect(cartTotal()).toBe(28)
    expect(useCartStore.getState().totalItems()).toBe(5)
  })

  it('labels the pack a jar belongs to', () => {
    useCartStore.getState().addBundle('choose-3', ['a', 'b', 'c'].map((id) => jar(id)))

    expect(useCartStore.getState().items.every((item) => item.bundleName === 'Choose 3 Pack')).toBe(
      true
    )
  })

  it('prices a pack at BigCommerce\'s live price when the storefront sells through it', () => {
    const added = useCartStore
      .getState()
      .addBundle('choose-5', ['a', 'b', 'c', 'd', 'e'].map((id) => jar(id)), {
        'choose-5': { price: 30, available: true },
      })

    expect(added).toBe(true)
    expect(cartTotal()).toBe(30)
  })

  it('refuses a pack BigCommerce cannot sell right now', () => {
    const added = useCartStore
      .getState()
      .addBundle('choose-3', ['a', 'b', 'c'].map((id) => jar(id)), {
        'choose-3': { price: 23, available: false },
      })

    expect(added).toBe(false)
    expect(useCartStore.getState().items).toHaveLength(0)
  })

  it('refuses a selection that is not the pack it claims to be', () => {
    expect(useCartStore.getState().addBundle('choose-5', [jar('a'), jar('b')])).toBe(false)
    expect(useCartStore.getState().addBundle('choose-99', [jar('a')])).toBe(false)
    expect(useCartStore.getState().items).toHaveLength(0)
  })

  it('keeps a pack jar separate from the same salsa bought loose', () => {
    useCartStore.getState().addItem({
      id: 'a',
      name: 'Salsa a',
      slug: 'salsa-a',
      price: 9,
      image: '/salsa-a.jpg',
      sku: 'SKU-a',
      heatLevel: 'MEDIUM',
    })
    useCartStore.getState().addBundle('choose-3', ['a', 'b', 'c'].map((id) => jar(id)))

    expect(useCartStore.getState().items).toHaveLength(4)
    expect(cartTotal()).toBe(32)
  })

  it('keeps two packs of the same kind apart', () => {
    useCartStore.getState().addBundle('choose-3', ['a', 'b', 'c'].map((id) => jar(id)))
    useCartStore.getState().addBundle('choose-3', ['a', 'd', 'e'].map((id) => jar(id)))

    const groups = new Set(useCartStore.getState().items.map((item) => item.bundleGroupId))
    expect(groups.size).toBe(2)
    expect(cartTotal()).toBe(46)
  })

  it('still totals the pack price when one salsa fills two slots', () => {
    useCartStore.getState().addBundle('choose-3', [jar('a'), jar('a'), jar('b')])

    // One line per slot, so the pack totals $23 to the cent rather than $23.01.
    expect(useCartStore.getState().items).toHaveLength(3)
    expect(cartTotal()).toBe(23)
  })

  it('merges the two slots into one order line for checkout', () => {
    useCartStore.getState().addBundle('choose-3', [jar('a'), jar('a'), jar('b')])

    const payload = toCheckoutItems(useCartStore.getState().items)
    expect(payload).toHaveLength(2)
    expect(payload[0]).toMatchObject({ productId: 'a', quantity: 2, bundleId: 'choose-3' })
    expect(payload[1]).toMatchObject({ productId: 'b', quantity: 1, bundleId: 'choose-3' })
  })

  it('removes the whole pack when one of its jars is removed', () => {
    useCartStore.getState().addBundle('choose-3', ['a', 'b', 'c'].map((id) => jar(id)))
    const [first] = useCartStore.getState().items

    useCartStore.getState().removeItem(first.id)

    expect(useCartStore.getState().items).toHaveLength(0)
  })

  it('leaves loose items alone when a pack is removed', () => {
    useCartStore.getState().addItem({
      id: 'loose',
      name: 'Salsa loose',
      slug: 'salsa-loose',
      price: 9,
      image: '/loose.jpg',
      sku: 'SKU-loose',
      heatLevel: 'MILD',
    })
    useCartStore.getState().addBundle('choose-3', ['a', 'b', 'c'].map((id) => jar(id)))

    const packItem = useCartStore.getState().items.find((item) => item.bundleGroupId)!
    useCartStore.getState().removeItem(packItem.id)

    expect(useCartStore.getState().items.map((item) => item.id)).toEqual(['loose'])
  })

  it('will not let a pack line be re-quantified out of shape', () => {
    useCartStore.getState().addBundle('choose-3', ['a', 'b', 'c'].map((id) => jar(id)))
    const [first] = useCartStore.getState().items

    useCartStore.getState().updateQuantity(first.id, 5)

    expect(useCartStore.getState().items[0].quantity).toBe(1)
    expect(cartTotal()).toBe(23)
  })

  it('sends the pack tags and the real product id to checkout', () => {
    useCartStore.getState().addBundle('choose-3', ['a', 'b', 'c'].map((id) => jar(id)))

    const payload = toCheckoutItems(useCartStore.getState().items)
    expect(payload).toEqual([
      { productId: 'a', quantity: 1, bundleId: 'choose-3', bundleGroupId: expect.any(String) },
      { productId: 'b', quantity: 1, bundleId: 'choose-3', bundleGroupId: expect.any(String) },
      { productId: 'c', quantity: 1, bundleId: 'choose-3', bundleGroupId: expect.any(String) },
    ])
  })

  it('reads the product id off a line saved before packs existed', () => {
    expect(
      cartItemProductId({
        id: 'legacy-product-id',
        name: 'Salsa',
        slug: 'salsa',
        price: 9,
        image: '/salsa.jpg',
        quantity: 1,
        sku: 'SKU',
        heatLevel: 'MILD',
      })
    ).toBe('legacy-product-id')
  })
})
