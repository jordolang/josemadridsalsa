import { describe, it, expect, vi, beforeEach } from 'vitest'

// Mock prisma
vi.mock('@/lib/prisma', () => ({
  prisma: {
    seoConfiguration: {
      findFirst: vi.fn(),
    },
  },
}))

import { prisma } from '@/lib/prisma'
import { applyMetadataTemplate } from '@/lib/seo/configuration'
import { renderTemplate, buildTemplatedMeta } from '@/lib/seo/metadata'

const mockFindFirst = prisma.seoConfiguration.findFirst as ReturnType<typeof vi.fn>

const baseConfig = {
  siteName: 'Jose Madrid Salsa',
  siteDescription: 'Salsa',
  siteUrl: 'https://www.josemadridsalsa.com',
  defaultKeywords: [],
  productTitleTemplate: '{product_name} - {heat_level} Salsa | {site_name}',
  productDescTemplate: 'Buy {product_name} for {price}. {category} salsa from {site_name}.',
}

describe('applyMetadataTemplate', () => {
  it('replaces all occurrences of a variable', () => {
    expect(
      applyMetadataTemplate('{name} and {name}', { name: 'Verde' })
    ).toBe('Verde and Verde')
  })

  it('does not treat $ in values as regex replacement patterns', () => {
    expect(
      applyMetadataTemplate('Price: {price}', { price: "$5.99 (that's $& cheap)" })
    ).toBe("Price: $5.99 (that's $& cheap)")
  })

  it('leaves unknown variables untouched', () => {
    expect(applyMetadataTemplate('{a} {b}', { a: 'x' })).toBe('x {b}')
  })
})

describe('renderTemplate', () => {
  it('fills variables and strips unresolved tokens', () => {
    expect(
      renderTemplate('{product_name} {missing} | Store', { product_name: 'Verde' })
    ).toBe('Verde | Store')
  })

  it('trims dangling separators left by empty variables', () => {
    expect(renderTemplate('{product_name} | {category}', { product_name: 'Verde', category: '' })).toBe('Verde')
  })
})

describe('buildTemplatedMeta', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  it('uses configured templates with variables', async () => {
    mockFindFirst.mockResolvedValue(baseConfig)

    const meta = await buildTemplatedMeta({
      entity: 'product',
      variables: {
        product_name: 'Salsa Verde',
        category: 'Green',
        heat_level: 'Medium',
        price: '$8.99',
      },
      fallbackTitle: 'fallback',
      fallbackDescription: 'fallback desc',
    })

    expect(meta.title).toBe('Salsa Verde - Medium Salsa | Jose Madrid Salsa')
    expect(meta.description).toBe('Buy Salsa Verde for $8.99. Green salsa from Jose Madrid Salsa.')
  })

  it('prefers explicit overrides over templates', async () => {
    mockFindFirst.mockResolvedValue(baseConfig)

    const meta = await buildTemplatedMeta({
      entity: 'product',
      variables: { product_name: 'Salsa Verde' },
      overrideTitle: 'Custom Title',
      overrideDescription: 'Custom description',
      fallbackTitle: 'fallback',
      fallbackDescription: 'fallback desc',
    })

    expect(meta.title).toBe('Custom Title')
    expect(meta.description).toBe('Custom description')
  })

  it('falls back when no config exists', async () => {
    mockFindFirst.mockResolvedValue(null)

    const meta = await buildTemplatedMeta({
      entity: 'product',
      variables: { product_name: 'Salsa Verde' },
      fallbackTitle: 'fallback',
      fallbackDescription: 'fallback desc',
    })

    expect(meta.title).toBe('fallback')
    expect(meta.description).toBe('fallback desc')
  })

  it('falls back when the database is unreachable', async () => {
    mockFindFirst.mockRejectedValue(new Error('db down'))

    const meta = await buildTemplatedMeta({
      entity: 'product',
      variables: { product_name: 'Salsa Verde' },
      fallbackTitle: 'fallback',
      fallbackDescription: 'fallback desc',
    })

    expect(meta.title).toBe('fallback')
    expect(meta.description).toBe('fallback desc')
  })
})
