import { readFileSync } from 'node:fs'
import { join } from 'node:path'
import { describe, expect, it } from 'vitest'

import { KIOSK_FLAVORS } from '@/lib/kiosk/catalog'
import { getProductUpc } from '@/lib/product-upcs'

/** True when a 12-digit code's last digit is the correct UPC-A check digit. */
function isValidUpc(code: string): boolean {
  if (!/^\d{12}$/.test(code)) return false
  const digits = [...code].map(Number)
  const sum = digits.slice(0, 11).reduce((total, digit, i) => total + digit * (i % 2 === 0 ? 3 : 1), 0)
  return (10 - (sum % 10)) % 10 === digits[11]
}

describe('getProductUpc', () => {
  it('gives every kiosk flavor with a barcode its UPC', () => {
    for (const flavor of KIOSK_FLAVORS.filter((f) => f.upc)) {
      expect(getProductUpc(flavor.name)).toBe(flavor.upc)
    }
  })

  it('matches catalog spellings from the imported data', () => {
    expect(getProductUpc('Roasted Garlic &amp; Olives')).toBe('093662452812')
    expect(getProductUpc('Clovis Medium (Original Medium Chunky)')).toBe('093662452638')
    expect(getProductUpc('Black Bean Corn Pablano')).toBe('093662452874')
    expect(getProductUpc('Black Bean Corn Salsa')).toBe('093662452874')
    expect(getProductUpc('Garden Fresh Cilantro Salsa Mild')).toBe('093662452904')
    expect(getProductUpc('Spanish Verde XX Hot')).toBe('093662452676')
    expect(getProductUpc('Jose Madrid Mango Habanero Salsa')).toBe('093662452973')
  })

  it('keeps similar flavors apart', () => {
    expect(getProductUpc('Cherry Hot')).toBe('093662453000')
    expect(getProductUpc('Cherry Chocolate Hot')).toBe('093662452928')
    expect(getProductUpc('Mango Mild')).toBe('093662452850')
  })

  it('skips packs, gift boxes and flavors without a barcode', () => {
    expect(getProductUpc('Mango Habanero 3 Pack')).toBeNull()
    expect(getProductUpc('Choose 6 Gift Box')).toBeNull()
    expect(getProductUpc('Green Apple')).toBeNull()
  })

  it('finds a UPC for every salsa in the imported catalog except retired Green Apple', () => {
    const csv = readFileSync(join(process.cwd(), 'data/products-transformed.csv'), 'utf8')
    const names = csv.split('\n').slice(1).filter(Boolean).map((line) => line.split(',')[0].replace(/"/g, ''))
    expect(names.filter((name) => !getProductUpc(name))).toEqual(['Green Apple'])
  })
})

describe('label UPCs', () => {
  it('all have a correct check digit', () => {
    for (const flavor of KIOSK_FLAVORS.filter((f) => f.upc)) {
      expect(isValidUpc(flavor.upc as string)).toBe(true)
    }
  })
})
