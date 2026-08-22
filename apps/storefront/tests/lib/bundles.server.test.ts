import { beforeEach, describe, expect, it, vi } from 'vitest'

vi.mock('@/lib/prisma', () => {
  const client = { bundle: { findMany: vi.fn() } }
  return { default: client, prisma: client, db: client }
})

import prisma from '@/lib/prisma'
import { resolveBundleSelections, BundleCheckoutError } from '@/lib/bundles.server'

const component = (
  id: string,
  price: number,
  quantity: number,
  over: Record<string, unknown> = {}
) => ({
  productId: id,
  quantity,
  product: {
    id,
    name: id.toUpperCase(),
    sku: `${id}-sku`,
    price,
    costPrice: null,
    featuredImage: null,
    isActive: true,
    ...over,
  },
})

const giftSet = {
  id: 'b1',
  name: 'Gift Set',
  price: 12,
  isActive: true,
  products: [component('a', 10, 1), component('b', 5, 1)],
}

beforeEach(() => {
  vi.mocked(prisma.bundle.findMany).mockReset()
})

describe('resolveBundleSelections', () => {
  it('returns empty for no selections without touching the database', async () => {
    const result = await resolveBundleSelections(undefined)
    expect(result).toEqual({ orderItems: [], reservations: [], subtotal: 0 })
    expect(prisma.bundle.findMany).not.toHaveBeenCalled()
  })

  it('expands a bundle into prorated, tagged component lines that sum to the bundle price', async () => {
    vi.mocked(prisma.bundle.findMany).mockResolvedValue([giftSet] as never)

    const { orderItems, reservations, subtotal } = await resolveBundleSelections([
      { bundleId: 'b1', quantity: 1 },
    ])

    // $12 split by value 10:5 → $8.00 and $4.00.
    expect(orderItems).toHaveLength(2)
    expect(Number(orderItems[0].totalPrice)).toBe(8)
    expect(Number(orderItems[1].totalPrice)).toBe(4)
    expect(orderItems[0].bundleId).toBe('b1')
    expect(orderItems[0].bundleName).toBe('Gift Set')
    expect(subtotal).toBe(12)
    expect(reservations).toEqual([
      { productId: 'a', quantity: 1 },
      { productId: 'b', quantity: 1 },
    ])
  })

  it('sums repeated selections of the same bundle and multiplies component quantities', async () => {
    vi.mocked(prisma.bundle.findMany).mockResolvedValue([giftSet] as never)

    const { reservations, subtotal } = await resolveBundleSelections([
      { bundleId: 'b1', quantity: 1 },
      { bundleId: 'b1', quantity: 2 },
    ])

    expect(subtotal).toBe(36) // $12 × 3
    expect(reservations).toEqual([
      { productId: 'a', quantity: 3 },
      { productId: 'b', quantity: 3 },
    ])
  })

  it('rejects a bundle that is missing or inactive', async () => {
    vi.mocked(prisma.bundle.findMany).mockResolvedValue([] as never)
    await expect(resolveBundleSelections([{ bundleId: 'gone', quantity: 1 }])).rejects.toBeInstanceOf(
      BundleCheckoutError
    )
  })

  it('rejects a bundle whose component product is inactive', async () => {
    vi.mocked(prisma.bundle.findMany).mockResolvedValue([
      { ...giftSet, products: [component('a', 10, 1), component('b', 5, 1, { isActive: false })] },
    ] as never)
    await expect(resolveBundleSelections([{ bundleId: 'b1', quantity: 1 }])).rejects.toBeInstanceOf(
      BundleCheckoutError
    )
  })
})
