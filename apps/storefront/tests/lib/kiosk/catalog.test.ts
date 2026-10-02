import { describe, expect, it } from 'vitest'
import {
  KIOSK_FLAVORS,
  flavorsForUpc,
  matchKioskProducts,
  nameTokens,
  type CatalogProduct,
} from '@/lib/kiosk/catalog'

const product = (over: Partial<CatalogProduct> & { id: string; name: string }): CatalogProduct => ({
  sku: over.id.toUpperCase(),
  barcode: null,
  inventory: 10,
  stockReserved: 0,
  isActive: true,
  ...over,
})

describe('nameTokens', () => {
  it('ignores brand filler and punctuation', () => {
    expect(nameTokens('Jose Madrid Mango Habanero Salsa')).toEqual(['mango', 'habanero'])
    expect(nameTokens('Spanish Verde X X Hot')).toEqual(nameTokens('Spanish Verde XX Hot'))
    expect(nameTokens('Roasted Garlic & Olives')).toEqual(['roasted', 'garlic', 'olives'])
  })
})

describe('matchKioskProducts', () => {
  it('matches by UPC first', () => {
    const { items } = matchKioskProducts([product({ id: 'p1', name: 'Something Else', barcode: '093662452973' })])
    expect(items.find((i) => i.key === 'mango-habanero')?.productId).toBe('p1')
  })

  it('falls back to the product name when the barcode is missing', () => {
    const { items } = matchKioskProducts([product({ id: 'p2', name: 'Mild Salsa' })])
    expect(items.find((i) => i.key === 'original-mild')?.productId).toBe('p2')
  })

  it('splits a shared UPC by name instead of guessing', () => {
    const shared = '093662452911'
    const flavors = KIOSK_FLAVORS.filter((f) => f.key === 'cherry-mild' || f.key === 'cherry-hot').map((f) => ({ ...f, upc: shared }))
    const { items } = matchKioskProducts(
      [
        product({ id: 'hot', name: 'Cherry Hot Salsa', barcode: shared }),
        product({ id: 'mild', name: 'Cherry Mild Salsa', barcode: shared }),
      ],
      flavors
    )
    expect(items.find((i) => i.key === 'cherry-mild')?.productId).toBe('mild')
    expect(items.find((i) => i.key === 'cherry-hot')?.productId).toBe('hot')
  })

  it('never sells a shared UPC to the wrong flavor', () => {
    const flavors = KIOSK_FLAVORS.filter((f) => f.key === 'cherry-mild' || f.key === 'cherry-hot').map((f) => ({ ...f, upc: '093662452911' }))
    const { items } = matchKioskProducts([product({ id: 'x', name: 'Mystery', barcode: '093662452911' })], flavors)
    expect(items.every((i) => i.productId === null)).toBe(true)
  })

  it('reports unmatched flavors, skips inactive products, and flags stock', () => {
    const { items, unmatched } = matchKioskProducts([
      product({ id: 'hab', name: 'Mango Habanero', inventory: 0 }),
      product({ id: 'old', name: 'Peach Mild', isActive: false }),
      product({ id: 'held', name: 'Mango Mild', inventory: 3, stockReserved: 3 }),
    ])
    expect(items.find((i) => i.key === 'mango-mild')).toMatchObject({ productId: 'held', inStock: false })
    expect(items.find((i) => i.key === 'mango-habanero')).toMatchObject({ productId: 'hab', inStock: false })
    expect(unmatched).toContain('Peach Mild')
    expect(unmatched).toHaveLength(KIOSK_FLAVORS.length - 2)
  })
})

describe('flavorsForUpc', () => {
  it('accepts UPC-A and EAN-13 scans', () => {
    expect(flavorsForUpc('093662452973').map((f) => f.key)).toEqual(['mango-habanero'])
    expect(flavorsForUpc('0093662452973').map((f) => f.key)).toEqual(['mango-habanero'])
    expect(flavorsForUpc('000000000000')).toEqual([])
  })

  it('reads the corrected UPCs', () => {
    expect(flavorsForUpc('093662452911').map((f) => f.key)).toEqual(['cherry-mild'])
    expect(flavorsForUpc('093662453017').map((f) => f.key)).toEqual(['blueberry'])
    expect(flavorsForUpc('093662453000').map((f) => f.key)).toEqual(['cherry-hot'])
  })
})
