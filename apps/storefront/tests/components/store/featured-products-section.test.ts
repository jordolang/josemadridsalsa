import { beforeEach, describe, expect, it, vi } from 'vitest'
import { HeatLevel } from '@prisma/client'

const getProducts = vi.fn()
vi.mock('@/lib/db/products', () => ({ getProducts: (...args: unknown[]) => getProducts(...args) }))
vi.mock('@/lib/logger', () => ({ logger: { error: vi.fn() } }))

import {
  HEAT_LEVEL_TILES,
  loadHomepageProducts,
} from '@/components/store/featured-products-section'

const row = (id: string) => ({
  id,
  name: `Salsa ${id}`,
  slug: `salsa-${id}`,
  description: null,
  price: 10,
  compareAtPrice: null,
  featuredImage: null,
  heatLevel: 'MILD',
  sku: id,
  inventory: 5,
  isFeatured: false,
  ingredients: null,
  weight: 16,
  dimensions: null,
})

describe('loadHomepageProducts', () => {
  beforeEach(() => getProducts.mockReset())

  it('returns featured in-stock products when any are flagged', async () => {
    getProducts.mockResolvedValueOnce([row('a')])

    const result = await loadHomepageProducts(4)

    expect(result.isFeatured).toBe(true)
    expect(result.products.map((p) => p.id)).toEqual(['a'])
    expect(getProducts).toHaveBeenCalledTimes(1)
    expect(getProducts).toHaveBeenCalledWith({ featured: true, inStock: true, take: 4 })
  })

  it('falls back to any in-stock products when none are featured', async () => {
    getProducts.mockResolvedValueOnce([]).mockResolvedValueOnce([row('b'), row('c')])

    const result = await loadHomepageProducts(4)

    expect(result.isFeatured).toBe(false)
    expect(result.products.map((p) => p.id)).toEqual(['b', 'c'])
    expect(getProducts).toHaveBeenLastCalledWith({ inStock: true, take: 4 })
  })
})

describe('HEAT_LEVEL_TILES', () => {
  it('offers a tile for every heat level in the schema', () => {
    expect(HEAT_LEVEL_TILES.map((t) => t.level)).toEqual(Object.values(HeatLevel))
  })
})
