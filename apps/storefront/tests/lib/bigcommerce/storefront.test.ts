import { afterEach, describe, expect, it, vi } from 'vitest'
import { http, HttpResponse } from 'msw'
import { server } from '@/tests/mocks/server'
import { normalizeBigCommerceProduct, type RawBigCommerceProduct } from '@/lib/bigcommerce/catalog'
import {
  applyBigCommercePricing,
  getBigCommercePackOverrides,
  getBigCommerceOrderHistoryUrl,
  isBigCommerceStorefrontEnabled,
  overlayBigCommercePricing,
  indexBigCommercePricing,
  toBigCommercePricing,
} from '@/lib/bigcommerce/storefront'
import fixtures from './fixtures.json'

const [originalHot, chooseSix, greenApple] = fixtures as unknown as RawBigCommerceProduct[]

function enableStorefront() {
  vi.stubEnv('NEXT_PUBLIC_COMMERCE_BACKEND', 'bigcommerce')
  vi.stubEnv('BIGCOMMERCE_STORE_HASH', 'testhash')
  vi.stubEnv('BIGCOMMERCE_ACCESS_TOKEN', 'test-token')
  vi.stubEnv('BIGCOMMERCE_CLIENT_ID', 'test-client')
  vi.stubEnv('BIGCOMMERCE_CLIENT_SECRET', 'test-secret')
}

afterEach(() => vi.unstubAllEnvs())

describe('isBigCommerceStorefrontEnabled', () => {
  it('needs both the switch and the main store credentials', () => {
    vi.stubEnv('NEXT_PUBLIC_COMMERCE_BACKEND', 'bigcommerce')
    expect(isBigCommerceStorefrontEnabled()).toBe(false)

    enableStorefront()
    expect(isBigCommerceStorefrontEnabled()).toBe(true)

    vi.stubEnv('NEXT_PUBLIC_COMMERCE_BACKEND', '')
    expect(isBigCommerceStorefrontEnabled()).toBe(false)
  })
})

describe('toBigCommercePricing', () => {
  it('shows the cart ceiling for untracked stock and zero when not purchasable', () => {
    expect(toBigCommercePricing(normalizeBigCommerceProduct(originalHot))).toEqual({
      price: 7,
      compareAtPrice: null,
      inventory: 99,
    })
    expect(toBigCommercePricing(normalizeBigCommerceProduct(greenApple)).inventory).toBe(0)
    expect(
      toBigCommercePricing(
        normalizeBigCommerceProduct({ ...originalHot, inventory_tracking: 'product', inventory_level: 12 }),
      ).inventory,
    ).toBe(12)
  })
})

describe('overlayBigCommercePricing', () => {
  const pricing = indexBigCommercePricing([originalHot, chooseSix].map((raw) => normalizeBigCommerceProduct(raw)))

  it('indexes mapped products by site slug and the rest by name', () => {
    expect([...pricing.bySlug.keys()]).toEqual(['original-hot'])
    expect([...pricing.byName.keys()]).toEqual(['choose6'])
  })

  it('links a product missing from the map by name, so a new salsa needs no code change', () => {
    const newSalsa = normalizeBigCommerceProduct({ ...originalHot, id: 999, name: 'Smoky Peach Hot', price: 8, calculated_price: 8 })
    const index = indexBigCommercePricing([newSalsa])
    const [product] = overlayBigCommercePricing(
      [{ slug: 'smoky-peach-hot-salsa', name: 'Smoky Peach  HOT', price: 9, compareAtPrice: null, inventory: 0 }],
      index,
    )
    expect(product).toMatchObject({ price: 8, inventory: 99 })
  })

  it('replaces price and stock on sold products and zeroes stock on unsold ones', () => {
    const result = overlayBigCommercePricing(
      [
        { slug: 'original-hot', price: 9, compareAtPrice: 12, inventory: 0, name: 'Original Hot' },
        { slug: 'salsa-t-shirt', price: 20, compareAtPrice: null, inventory: 40, name: 'T-shirt' },
      ],
      pricing,
    )

    expect(result).toEqual([
      { slug: 'original-hot', price: 7, compareAtPrice: null, inventory: 99, name: 'Original Hot' },
      { slug: 'salsa-t-shirt', price: 20, compareAtPrice: null, inventory: 0, name: 'T-shirt' },
    ])
  })

  it('does not add a stock field to shapes that have none', () => {
    const [suggestion] = overlayBigCommercePricing([{ slug: 'original-hot', price: 9 }], pricing)
    expect(suggestion).toEqual({ slug: 'original-hot', price: 7, compareAtPrice: null })
  })
})

describe('applyBigCommercePricing', () => {
  const dbProducts = [{ slug: 'original-hot', price: 9, compareAtPrice: null, inventory: 3 }]

  it('is a no-op until the storefront is switched to BigCommerce', async () => {
    await expect(applyBigCommercePricing(dbProducts)).resolves.toBe(dbProducts)
  })

  it('prices from the live catalog when switched on', async () => {
    enableStorefront()
    server.use(
      http.get('https://api.bigcommerce.com/stores/testhash/v3/catalog/products', () =>
        HttpResponse.json({ data: [originalHot], meta: { pagination: { current_page: 1, total_pages: 1 } } }),
      ),
    )

    await expect(applyBigCommercePricing(dbProducts)).resolves.toEqual([
      { slug: 'original-hot', price: 7, compareAtPrice: null, inventory: 99 },
    ])
  })

  it('keeps database prices when BigCommerce is unreachable', async () => {
    enableStorefront()
    vi.spyOn(console, 'error').mockImplementation(() => {})
    server.use(
      http.get('https://api.bigcommerce.com/stores/testhash/v3/catalog/products', () =>
        HttpResponse.json({ title: 'Internal error' }, { status: 500 }),
      ),
    )

    await expect(applyBigCommercePricing(dbProducts)).resolves.toBe(dbProducts)
  })
})

describe('getBigCommerceOrderHistoryUrl', () => {
  it('points at the BigCommerce storefront order page once it has its own address', () => {
    expect(getBigCommerceOrderHistoryUrl()).toBeNull()

    enableStorefront()
    expect(getBigCommerceOrderHistoryUrl()).toBeNull()

    vi.stubEnv('BIGCOMMERCE_STOREFRONT_URL', 'https://shop.josemadridsalsa.com/')
    expect(getBigCommerceOrderHistoryUrl()).toBe('https://shop.josemadridsalsa.com/account.php?action=order_status')

    vi.stubEnv('BIGCOMMERCE_STOREFRONT_URL', 'not a url')
    expect(getBigCommerceOrderHistoryUrl()).toBeNull()
  })
})

describe('getBigCommercePackOverrides', () => {
  const catalogResponse = (products: RawBigCommerceProduct[]) =>
    http.get('https://api.bigcommerce.com/stores/testhash/v3/catalog/products', () =>
      HttpResponse.json({ data: products, meta: { pagination: { current_page: 1, total_pages: 1 } } }),
    )

  it('is empty until the storefront sells through BigCommerce', async () => {
    await expect(getBigCommercePackOverrides()).resolves.toEqual({})
  })

  it('reads each pack\'s price and availability, marking packs missing from BigCommerce unavailable', async () => {
    enableStorefront()
    server.use(
      catalogResponse([
        { ...chooseSix, id: 121, price: 34, calculated_price: 34 },
        { ...chooseSix, id: 120, name: 'Choose-3', price: 23, calculated_price: 23, inventory_tracking: 'product', inventory_level: 0 },
      ]),
    )

    const overrides = await getBigCommercePackOverrides()
    expect(overrides['choose-6']).toEqual({ price: 34, available: true })
    expect(overrides['choose-3']).toEqual({ price: 23, available: false })
    // Choose-5 and Choose-12 are not in this catalog response.
    expect(overrides['choose-5']).toEqual({ price: 28, available: false })
  })

  it('falls back to listed prices when BigCommerce is unreachable', async () => {
    enableStorefront()
    vi.spyOn(console, 'error').mockImplementation(() => {})
    server.use(
      http.get('https://api.bigcommerce.com/stores/testhash/v3/catalog/products', () =>
        HttpResponse.json({ title: 'Down' }, { status: 500 }),
      ),
    )
    await expect(getBigCommercePackOverrides()).resolves.toEqual({})
  })
})
