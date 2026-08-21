import { describe, it, expect } from 'vitest'

import { LABEL_FILENAME_ALIASES } from '@/lib/images/label-aliases'
import { filenameToSlug, matchProduct, type ProductRef } from '@/lib/images/sync-plan'

function product(name: string, slug: string, sku: string): ProductRef {
  return { id: slug, name, slug, sku, featuredImage: null, images: [] }
}

describe('LABEL_FILENAME_ALIASES', () => {
  it('is keyed in the form filenames reduce to', () => {
    // A key written as a filename ("original-mild.jpg") or with capitals would never be looked up,
    // and the label would go unlinked with no error.
    for (const key of Object.keys(LABEL_FILENAME_ALIASES)) {
      expect(key).toBe(filenameToSlug(key))
    }
  })

  it('sends each aliased label scan to its product', () => {
    const catalogue = [
      product('Jose Madrid Original Mild', 'jose-madrid-original-mild', 'JMS-MILD-001'),
      product('Blueberry Mild Salsa', 'blueberry-mild-salsa', 'JMS-FRUIT-008'),
      product('Garden Cilantro Salsa Mild', 'garden-cilantro-mild-salsa', 'JMS-MILD-005'),
      product('Garden Cilantro Salsa Hot', 'garden-cilantro-hot-salsa', 'JMS-HOT-005'),
      product('Clovis Medium Salsa', 'clovis-medium-salsa', 'JMS-MILD-002'),
    ]

    const resolve = (fileName: string) =>
      matchProduct(fileName, catalogue, LABEL_FILENAME_ALIASES)?.product.slug ?? null

    expect(resolve('original-mild.jpg')).toBe('jose-madrid-original-mild')
    expect(resolve('blueberry.jpg')).toBe('blueberry-mild-salsa')
    expect(resolve('garden-fresh-cilantro-salsa-mild.jpg')).toBe('garden-cilantro-mild-salsa')
    expect(resolve('garden-fresh-cilantro-salsa-hot.jpg')).toBe('garden-cilantro-hot-salsa')
    expect(resolve('clovis-medium-original-chunky.jpg')).toBe('clovis-medium-salsa')
  })

  it('leaves a lower-resolution duplicate unmatched rather than attaching it too', () => {
    // peach.jpg is a 1280px copy of peach-mild.jpg; only the full-size scan should be linked.
    const catalogue = [product('Peach Mild', 'peach-mild-salsa', 'JMS-FRUIT-003')]

    expect(matchProduct('peach-mild.jpg', catalogue, LABEL_FILENAME_ALIASES)).not.toBeNull()
    expect(matchProduct('peach.jpg', catalogue, LABEL_FILENAME_ALIASES)).toBeNull()
  })
})
