import { beforeEach, describe, expect, it, vi } from 'vitest'

vi.mock('@/lib/prisma', () => ({ prisma: { product: { findFirst: vi.fn() } } }))

const { prisma } = await import('@/lib/prisma')
const { getFeedProductImages, SITE_URL } = await import('@/lib/feeds/products')

describe('getFeedProductImages', () => {
  beforeEach(() => vi.mocked(prisma.product.findFirst).mockReset())

  it('returns the primary image first, then additional images, as absolute URLs', async () => {
    vi.mocked(prisma.product.findFirst).mockResolvedValue({
      featuredImage: 'https://blob/a.webp',
      images: ['https://blob/a.webp', '/images/b.webp', ''],
    } as never)

    expect(await getFeedProductImages('JMS-1')).toEqual([
      'https://blob/a.webp',
      `${SITE_URL}/images/b.webp`,
    ])
    expect(prisma.product.findFirst).toHaveBeenCalledWith(
      expect.objectContaining({ where: { sku: 'JMS-1', isActive: true } }),
    )
  })

  it('returns null for an unknown or inactive product and [] when it has no images', async () => {
    vi.mocked(prisma.product.findFirst).mockResolvedValueOnce(null)
    expect(await getFeedProductImages('NOPE')).toBeNull()

    vi.mocked(prisma.product.findFirst).mockResolvedValueOnce({ featuredImage: null, images: [] } as never)
    expect(await getFeedProductImages('JMS-2')).toEqual([])
  })
})
