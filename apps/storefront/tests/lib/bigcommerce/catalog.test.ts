import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { http, HttpResponse } from 'msw'
import { server } from '@/tests/mocks/server'
import {
  findBigCommerceProductBySlug,
  getBigCommerceProducts,
  normalizeBigCommerceProduct,
  type RawBigCommerceProduct,
} from '@/lib/bigcommerce/catalog'
import fixtures from './fixtures.json'

// Trimmed from the live main-store catalog: a salsa, a Choose-6 bundle, and a
// hidden seasonal flavor.
const [originalHot, chooseSix, greenApple] = fixtures as unknown as RawBigCommerceProduct[]

describe('normalizeBigCommerceProduct', () => {
  it('maps a salsa to its site page and leads with the thumbnail image', () => {
    const product = normalizeBigCommerceProduct(originalHot)

    expect(product).toMatchObject({
      id: 98,
      name: 'Original Hot',
      legacyPath: '/original-hot/',
      siteSlug: 'original-hot',
      price: 7,
      compareAtPrice: null,
      isPurchasable: true,
      inventoryTracked: false,
      inventoryLevel: null,
      minQuantity: 1,
      maxQuantity: null,
    })
    // Fixture lists the logo crop first but flags the label as the thumbnail.
    expect(product.images[0].url).toContain('Hot__33236')
    expect(product.images[0].alt).toBe('Original Hot')
  })

  it('exposes bundle jar dropdowns and the order-notes field in BigCommerce order', () => {
    const product = normalizeBigCommerceProduct(chooseSix)

    expect(product.siteSlug).toBeNull()
    expect(product.modifiers.map((m) => [m.label, m.type, m.required])).toEqual([
      ['Order Notes', 'text', true],
      ['Jar 1', 'dropdown', false],
      ['Jar 2', 'dropdown', true],
    ])
    expect(product.modifiers[0].placeholder).toBe('Please tell us any order details')
    expect(product.modifiers[1].placeholder).toBeNull()
    expect(product.modifiers[1].values[0]).toEqual({ id: 238, label: 'Original Mild', isDefault: false })
  })

  it('only maps main-store ids to site pages, since ids collide across stores', () => {
    expect(normalizeBigCommerceProduct(originalHot, 'fundraising').siteSlug).toBeNull()
  })

  it('treats a hidden product as not purchasable', () => {
    expect(normalizeBigCommerceProduct(greenApple)).toMatchObject({ isVisible: false, isPurchasable: false })
  })

  it('reports an active sale as price plus compare-at price', () => {
    const product = normalizeBigCommerceProduct({ ...originalHot, price: 7, sale_price: 5, calculated_price: 5 })
    expect(product).toMatchObject({ price: 5, compareAtPrice: 7 })
  })

  it('blocks purchase when tracked stock runs out', () => {
    const outOfStock = normalizeBigCommerceProduct({ ...originalHot, inventory_tracking: 'product', inventory_level: 0 })
    const inStock = normalizeBigCommerceProduct({ ...originalHot, inventory_tracking: 'product', inventory_level: 4 })

    expect(outOfStock).toMatchObject({ isPurchasable: false, inventoryLevel: 0 })
    expect(inStock).toMatchObject({ isPurchasable: true, inventoryLevel: 4 })
  })

  it('blocks purchase when BigCommerce disables the product', () => {
    expect(normalizeBigCommerceProduct({ ...originalHot, availability: 'disabled' }).isPurchasable).toBe(false)
  })

  it('drops dropdown values BigCommerce has disabled and sorts the rest', () => {
    const [notes, jar] = chooseSix.modifiers!
    const product = normalizeBigCommerceProduct({
      ...chooseSix,
      modifiers: [
        notes,
        {
          ...jar,
          option_values: [
            { id: 3, label: 'C', sort_order: 2, is_default: false },
            { id: 1, label: 'A', sort_order: 0, is_default: true },
            { id: 2, label: 'B', sort_order: 1, is_default: false, adjusters: { purchasing_disabled: { status: true } } },
          ],
        },
      ],
    })

    expect(product.modifiers[1].values.map((v) => v.label)).toEqual(['A', 'C'])
  })

  it('marks modifier types the storefront cannot render', () => {
    const product = normalizeBigCommerceProduct({
      ...chooseSix,
      modifiers: [{ id: 1, display_name: 'Upload', type: 'file', required: false, sort_order: 0, config: [] }],
    })
    expect(product.modifiers[0].type).toBe('unsupported')
  })
})

describe('getBigCommerceProducts', () => {
  beforeEach(() => {
    vi.stubEnv('BIGCOMMERCE_STORE_HASH', 'testhash')
    vi.stubEnv('BIGCOMMERCE_ACCESS_TOKEN', 'test-token')
    vi.stubEnv('BIGCOMMERCE_CLIENT_ID', 'test-client')
    vi.stubEnv('BIGCOMMERCE_CLIENT_SECRET', 'test-secret')
  })
  afterEach(() => vi.unstubAllEnvs())

  it('reads every page with images and modifiers, sorted by BigCommerce sort order', async () => {
    server.use(
      http.get('https://api.bigcommerce.com/stores/testhash/v3/catalog/products', ({ request }) => {
        const url = new URL(request.url)
        expect(url.searchParams.get('include')).toBe('images,modifiers')
        const page = Number(url.searchParams.get('page'))
        return HttpResponse.json({
          data: page === 1 ? [{ ...chooseSix, sort_order: 5 }] : [{ ...originalHot, sort_order: 1 }, greenApple],
          meta: { pagination: { current_page: page, total_pages: 2 } },
        })
      }),
    )

    const products = await getBigCommerceProducts()
    expect(products.map((p) => p.name)).toEqual(['Green Apple', 'Original Hot', 'Choose-6'])
  })
})

describe('findBigCommerceProductBySlug', () => {
  const products = [originalHot, chooseSix, greenApple].map((raw) => normalizeBigCommerceProduct(raw))

  it('matches the site slug first, then the legacy BigCommerce path', () => {
    expect(findBigCommerceProductBySlug(products, 'original-hot')?.id).toBe(98)
    expect(findBigCommerceProductBySlug(products, '/choose-6/')?.id).toBe(121)
    expect(findBigCommerceProductBySlug(products, 'green-apple')?.id).toBe(130)
    expect(findBigCommerceProductBySlug(products, 'nope')).toBeNull()
  })
})
