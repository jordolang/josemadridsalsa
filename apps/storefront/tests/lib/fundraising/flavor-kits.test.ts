import { describe, it, expect, vi, beforeEach } from 'vitest'

vi.mock('@/lib/prisma', () => ({
  prisma: { product: { findMany: vi.fn() } },
}))

import { prisma } from '@/lib/prisma'
import { KIT_IDS, isKitId, kitProductSlugs } from '@/lib/fundraising/flavor-kits'
import { resolveKitCatalog, shouldBlockApproval } from '@/lib/fundraising/kit-catalog.server'

describe('flavor kits', () => {
  it('gives every flavor its own product slug', () => {
    const slugs = kitProductSlugs('25')
    expect(slugs).toHaveLength(25)
    expect(new Set(slugs).size).toBe(25)
  })

  it('builds the 9 and 16 flavor kits from the 25', () => {
    const all = new Set(kitProductSlugs('25'))
    expect(kitProductSlugs('9')).toHaveLength(9)
    expect(kitProductSlugs('16')).toHaveLength(16)
    for (const kit of KIT_IDS) {
      for (const slug of kitProductSlugs(kit)) expect(all.has(slug)).toBe(true)
    }
  })

  it('only accepts the three packages', () => {
    expect(isKitId('16')).toBe(true)
    expect(isKitId('12')).toBe(false)
    expect(isKitId(null)).toBe(false)
  })
})

describe('resolveKitCatalog', () => {
  const findMany = prisma.product.findMany as unknown as ReturnType<typeof vi.fn>

  beforeEach(() => findMany.mockReset())

  it('lists the kit in kit order and reports slugs with no product', async () => {
    const [first, second, ...rest] = kitProductSlugs('9')
    // Returned out of order, and one flavor missing from the catalogue.
    findMany.mockResolvedValue(
      [second, first, ...rest.slice(1)].map((slug) => ({ id: `id-${slug}`, slug }))
    )

    const result = await resolveKitCatalog('9')

    expect(result.kitSize).toBe(9)
    expect(result.missingSlugs).toEqual([rest[0]])
    expect(result.catalog.slice(0, 2)).toEqual([
      { productId: `id-${first}`, sortOrder: 0 },
      { productId: `id-${second}`, sortOrder: 1 },
    ])
    expect(result.catalog).toHaveLength(8)
  })

  it('enables nothing when no package was chosen', async () => {
    const result = await resolveKitCatalog(null)
    expect(result).toEqual({ kitSize: 0, catalog: [], missingSlugs: [] })
    expect(findMany).not.toHaveBeenCalled()
  })
})

describe('shouldBlockApproval', () => {
  it('blocks when any kit salsa is missing', () => {
    expect(shouldBlockApproval(['original-hot'], 9)).toBe(true)
    expect(shouldBlockApproval([], 9)).toBe(false)
  })

  it('never blocks a sign-up without a package', () => {
    expect(shouldBlockApproval([], 0)).toBe(false)
  })
})
