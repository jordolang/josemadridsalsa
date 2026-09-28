import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { http, HttpResponse } from 'msw'
import { server } from '@/tests/mocks/server'
import { normalizeBigCommerceProduct, type RawBigCommerceProduct } from '@/lib/bigcommerce/catalog'
import {
  BigCommerceCartError,
  DEFAULT_BUNDLE_NOTE,
  buildBigCommerceLineItems,
  createBigCommerceCheckout,
  getBigCommerceChannelId,
} from '@/lib/bigcommerce/cart'
import fixtures from './fixtures.json'

const [originalHotRaw, chooseSixRaw, greenAppleRaw] = fixtures as unknown as RawBigCommerceProduct[]

// A Choose-6 with all six jar slots, each offering the two salsas below.
const jarModifiers = Array.from({ length: 6 }, (_, index) => ({
  id: 300 + index,
  display_name: `Jar ${index + 1}`,
  type: 'dropdown',
  required: index > 0,
  sort_order: index + 1,
  config: [],
  option_values: [
    { id: 900 + index * 10, label: 'Original Hot', sort_order: 0, is_default: false },
    { id: 901 + index * 10, label: 'Mango Mild', sort_order: 1, is_default: false },
  ],
}))
const chooseSixFull: RawBigCommerceProduct = {
  ...chooseSixRaw,
  modifiers: [chooseSixRaw.modifiers![0], ...jarModifiers],
}
const mangoMildRaw: RawBigCommerceProduct = {
  ...originalHotRaw,
  id: 107,
  name: 'Mango Mild',
  custom_url: { url: '/mango-mild/' },
}

const products = [originalHotRaw, chooseSixFull, greenAppleRaw, mangoMildRaw].map((raw) =>
  normalizeBigCommerceProduct(raw),
)

const jar = (slug: string, quantity = 1) => ({ slug, quantity, bundleId: 'choose-6', bundleGroupId: 'pack-a' })

describe('buildBigCommerceLineItems', () => {
  it('merges loose jars of the same salsa, matched by site slug or legacy path', () => {
    expect(
      buildBigCommerceLineItems(
        [
          { slug: 'original-hot', quantity: 2 },
          { slug: 'mango-mild-salsa', quantity: 1 },
          { slug: '/original-hot/', quantity: 1 },
        ],
        products,
      ),
    ).toEqual([
      { product_id: 98, quantity: 3 },
      { product_id: 107, quantity: 1 },
    ])
  })

  it('links a loose jar missing from the map by its name', () => {
    const unmapped = normalizeBigCommerceProduct({ ...originalHotRaw, id: 500, name: 'Smoky Peach Hot', custom_url: { url: '/smoky-peach-hot/' } })
    expect(
      buildBigCommerceLineItems([{ slug: 'smoky-peach-hot-salsa', name: 'Smoky Peach Hot', quantity: 2 }], [...products, unmapped]),
    ).toEqual([{ product_id: 500, quantity: 2 }])
  })

  it('turns a pack into one pack product with a jar per slot and a default note', () => {
    const [pack] = buildBigCommerceLineItems(
      [jar('original-hot', 4), jar('mango-mild-salsa', 2)],
      products,
    )

    expect(pack.product_id).toBe(121)
    expect(pack.quantity).toBe(1)
    expect(pack.option_selections).toEqual([
      { option_id: 300, option_value: 900 },
      { option_id: 301, option_value: 910 },
      { option_id: 302, option_value: 920 },
      { option_id: 303, option_value: 930 },
      { option_id: 304, option_value: 941 },
      { option_id: 305, option_value: 951 },
      { option_id: 203, option_value: DEFAULT_BUNDLE_NOTE },
    ])
  })

  it('matches pack choices worded differently from their product', () => {
    // Live catalog: the Jar choice reads "Garden Fresh Cilantro Mild", the product
    // "Garden Fresh Cilantro Salsa Mild". Matching by name alone refused the pack.
    const cilantro = normalizeBigCommerceProduct({
      ...originalHotRaw,
      id: 105,
      name: 'Garden Fresh Cilantro Salsa Mild',
      custom_url: { url: '/garden-fresh-cilantro-salsa-mild/' },
    })
    const pack = normalizeBigCommerceProduct({
      ...chooseSixFull,
      modifiers: [
        chooseSixRaw.modifiers![0],
        ...jarModifiers.map((modifier) => ({
          ...modifier,
          option_values: [{ id: 700 + modifier.id, label: 'Garden Fresh Cilantro Mild', sort_order: 0, is_default: false }],
        })),
      ],
    })

    const [line] = buildBigCommerceLineItems([jar('garden-cilantro-mild-salsa', 6)], [pack, cilantro])
    expect(line.option_selections?.slice(0, 6).map((selection) => selection.option_value)).toEqual([
      1000, 1001, 1002, 1003, 1004, 1005,
    ])
  })

  it('keeps two instances of the same pack separate', () => {
    const items = buildBigCommerceLineItems(
      [jar('original-hot', 6), { ...jar('mango-mild-salsa', 6), bundleGroupId: 'pack-b' }],
      products,
    )
    expect(items.map((item) => item.product_id)).toEqual([121, 121])
  })

  it('refuses a pack with the wrong number of jars', () => {
    expect(() => buildBigCommerceLineItems([jar('original-hot', 5)], products)).toThrow(
      'Choose-6 holds 6 jars, but 5 were chosen.',
    )
  })

  it('refuses a salsa the pack does not offer', () => {
    const bothMild = [jar('original-hot', 5), jar('/green-apple/')]
    expect(() => buildBigCommerceLineItems(bothMild, products)).toThrow('Green Apple is not available in Choose-6.')
  })

  it('refuses products BigCommerce does not sell or will not sell now', () => {
    expect(() => buildBigCommerceLineItems([{ slug: 'salsa-t-shirt', quantity: 1 }], products)).toThrow(
      BigCommerceCartError,
    )
    expect(() => buildBigCommerceLineItems([{ slug: '/green-apple/', quantity: 1 }], products)).toThrow(
      'Green Apple is out of stock.',
    )
  })

  it('refuses a pack line with no pack id', () => {
    expect(() =>
      buildBigCommerceLineItems([{ slug: 'original-hot', quantity: 6, bundleGroupId: 'pack-a' }], products),
    ).toThrow('A mix-and-match pack in your cart is incomplete.')
  })
})

describe('getBigCommerceChannelId', () => {
  afterEach(() => vi.unstubAllEnvs())

  it('defaults to the existing storefront channel', () => {
    expect(getBigCommerceChannelId()).toBe(1)
    vi.stubEnv('BIGCOMMERCE_CHANNEL_ID', 'nope')
    expect(getBigCommerceChannelId()).toBe(1)
    vi.stubEnv('BIGCOMMERCE_CHANNEL_ID', '1731749')
    expect(getBigCommerceChannelId()).toBe(1731749)
  })
})

describe('createBigCommerceCheckout', () => {
  const API = 'https://api.bigcommerce.com/stores/testhash'

  beforeEach(() => {
    vi.stubEnv('BIGCOMMERCE_STORE_HASH', 'testhash')
    vi.stubEnv('BIGCOMMERCE_ACCESS_TOKEN', 'test-token')
    vi.stubEnv('BIGCOMMERCE_CLIENT_ID', 'test-client')
    vi.stubEnv('BIGCOMMERCE_CLIENT_SECRET', 'test-secret')
    server.use(
      http.get(`${API}/v3/catalog/products`, () =>
        HttpResponse.json({ data: [originalHotRaw], meta: { pagination: { current_page: 1, total_pages: 1 } } }),
      ),
    )
  })
  afterEach(() => vi.unstubAllEnvs())

  it('creates the cart in the configured channel and returns its checkout URL', async () => {
    let body: unknown = null
    let include: string | null = null
    server.use(
      http.post(`${API}/v3/carts`, async ({ request }) => {
        include = new URL(request.url).searchParams.get('include')
        body = await request.json()
        return HttpResponse.json({
          data: { id: 'cart-1', redirect_urls: { checkout_url: 'https://www.josemadridsalsa.com/cart.php?action=loadInCheckout&id=cart-1' } },
        })
      }),
    )

    await expect(createBigCommerceCheckout([{ slug: 'original-hot', quantity: 2 }])).resolves.toEqual({
      cartId: 'cart-1',
      checkoutUrl: 'https://www.josemadridsalsa.com/cart.php?action=loadInCheckout&id=cart-1',
    })
    expect(include).toBe('redirect_urls')
    expect(body).toEqual({ channel_id: 1, line_items: [{ product_id: 98, quantity: 2 }] })
  })

  it('fails loudly when BigCommerce returns no checkout URL', async () => {
    server.use(http.post(`${API}/v3/carts`, () => HttpResponse.json({ data: { id: 'cart-1' } })))
    await expect(createBigCommerceCheckout([{ slug: 'original-hot', quantity: 1 }])).rejects.toThrow(
      'without a checkout URL',
    )
  })
})
