import { describe, expect, it } from 'vitest'
import { isListed, toMerchProduct, toPlainText } from '@/lib/merchandise/catalog'
import { formatPriceRange } from '@/lib/merchandise/shared'
import type { PrintifyProduct } from '@/lib/printify/client'

function tourShirt(overrides: Partial<PrintifyProduct> = {}): PrintifyProduct {
  return {
    id: '5d39b411749d0a000f30e0f4',
    title: 'Tour Shirt',
    description: '<p>Soft tee.</p><ul><li>100% cotton</li></ul>',
    tags: [],
    options: [
      { name: 'Colors', type: 'color', values: [{ id: 1, title: 'Black', colors: ['#000000'] }, { id: 2, title: 'Red', colors: ['#ff0000'] }] },
      { name: 'Sizes', type: 'size', values: [{ id: 10, title: 'M' }, { id: 11, title: 'L' }, { id: 12, title: 'XL' }] },
    ],
    variants: [
      { id: 101, price: 2500, title: 'Black / M', is_enabled: true, is_available: true, is_default: true, options: [1, 10] },
      { id: 102, price: 2500, title: 'Black / L', is_enabled: true, is_available: true, options: [1, 11] },
      { id: 103, price: 2800, title: 'Black / XL', is_enabled: true, is_available: false, options: [1, 12] },
      { id: 201, price: 2500, title: 'Red / M', is_enabled: false, is_available: true, options: [2, 10] },
    ],
    images: [
      { src: 'https://images-api.printify.com/back.jpg', variant_ids: [101, 102, 103], position: 'back', is_default: false },
      { src: 'https://images-api.printify.com/front.jpg', variant_ids: [101, 102], position: 'front', is_default: true },
      { src: 'https://images-api.printify.com/red.jpg', variant_ids: [201], position: 'front', is_default: false },
    ],
    created_at: '2026-10-01 00:00:00+00:00',
    updated_at: '2026-10-01 00:00:00+00:00',
    visible: false,
    is_locked: false,
    shop_id: '123',
    ...overrides,
  }
}

describe('toMerchProduct', () => {
  it('drops variants that are disabled or unavailable, and the option values only they used', () => {
    const product = toMerchProduct(tourShirt())!
    expect(product.variants.map((variant) => variant.id)).toEqual([101, 102])
    expect(product.options[0].values.map((value) => value.title)).toEqual(['Black'])
    expect(product.options[1].values.map((value) => value.title)).toEqual(['M', 'L'])
    expect(product.options[0].values[0].color).toBe('#000000')
  })

  it('keeps the shop the product came from, so its orders go there', () => {
    expect(toMerchProduct(tourShirt({ shop_id: '456' }))!.shopId).toBe('456')
  })

  it('keeps only photos of buyable variants, default photo first', () => {
    const product = toMerchProduct(tourShirt())!
    expect(product.images.map((image) => image.src)).toEqual([
      'https://images-api.printify.com/front.jpg',
      'https://images-api.printify.com/back.jpg',
    ])
    expect(product.images[1].variantIds).toEqual([101, 102])
  })

  it('reports the price range from buyable variants only', () => {
    const product = toMerchProduct(tourShirt())!
    expect(product.minPriceCents).toBe(2500)
    expect(product.maxPriceCents).toBe(2500)
    expect(formatPriceRange(product)).toBe('$25.00')
    expect(formatPriceRange({ minPriceCents: 2500, maxPriceCents: 2800 })).toBe('From $25.00')
  })

  it('returns null when nothing can be bought', () => {
    const product = tourShirt({
      variants: tourShirt().variants.map((variant) => ({ ...variant, is_available: false })),
    })
    expect(toMerchProduct(product)).toBeNull()
  })
})

describe('isListed', () => {
  it('lists a product never published to a sales channel, as an API shop product is', () => {
    expect(isListed(tourShirt({ visible: false, external: null }))).toBe(true)
  })

  it('hides a published product that was hidden in Printify', () => {
    expect(isListed(tourShirt({ visible: false, external: { id: 'x' } }))).toBe(false)
    expect(isListed(tourShirt({ visible: true, external: { id: 'x' } }))).toBe(true)
  })
})

describe('toPlainText', () => {
  it('turns Printify description HTML into readable text', () => {
    expect(toPlainText('<p>Soft &amp; light.</p><ul><li>100% cotton</li><li>Unisex</li></ul>')).toBe(
      'Soft & light.\n• 100% cotton\n• Unisex'
    )
  })
})
