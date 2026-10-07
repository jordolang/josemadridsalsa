import { readFileSync } from 'node:fs'
import { join } from 'node:path'
import { describe, expect, it } from 'vitest'

import {
  SALSA_CATEGORIES,
  SALSA_CATEGORY_FLAVORS,
  getSalsaCategorySlug,
  normalizeSalsaName,
} from '@/lib/salsa-categories'

describe('SALSA_CATEGORIES', () => {
  it('has the five categories with unique slugs and names', () => {
    expect(SALSA_CATEGORIES.map((c) => c.slug)).toEqual([
      'fruit-mild-salsa',
      'fruit-hot-salsa',
      'mild-salsa',
      'medium-salsa',
      'hot-salsa',
    ])
    expect(new Set(SALSA_CATEGORIES.map((c) => c.name)).size).toBe(5)
  })

  it.each(SALSA_CATEGORIES)('$slug keeps meta title 30–60 chars and description ≤160', (category) => {
    expect(category.metaTitle.length).toBeGreaterThanOrEqual(30)
    expect(category.metaTitle.length).toBeLessThanOrEqual(60)
    expect(category.metaDescription.length).toBeLessThanOrEqual(160)
  })

  it.each(SALSA_CATEGORIES)('$slug points at an image that exists', (category) => {
    for (const path of [category.image, category.ogImage]) {
      expect(() => readFileSync(join(process.cwd(), 'public', path))).not.toThrow()
    }
  })
})

describe('getSalsaCategorySlug', () => {
  it('maps catalog names as they appear in the imported data', () => {
    expect(getSalsaCategorySlug('Peach Mild')).toBe('fruit-mild-salsa')
    expect(getSalsaCategorySlug('Mango Habanero')).toBe('fruit-hot-salsa')
    expect(getSalsaCategorySlug('Roasted Garlic &amp; Olives')).toBe('mild-salsa')
    expect(getSalsaCategorySlug('Clovis Medium (Original Medium Chunky)')).toBe('medium-salsa')
    expect(getSalsaCategorySlug('Black Bean Corn Pablano')).toBe('medium-salsa')
    expect(getSalsaCategorySlug('Spanish Verde X X Hot')).toBe('hot-salsa')
    expect(getSalsaCategorySlug('Garden Fresh Cilantro Salsa Hot')).toBe('hot-salsa')
  })

  it('does not confuse flavors that share words', () => {
    expect(getSalsaCategorySlug('Cherry Hot')).toBe('fruit-hot-salsa')
    expect(getSalsaCategorySlug('Cherry Mild')).toBe('fruit-mild-salsa')
    expect(getSalsaCategorySlug('Original Hot')).toBe('hot-salsa')
    expect(getSalsaCategorySlug('Original Mild')).toBe('mild-salsa')
  })

  it('returns null for products that are not a flavor', () => {
    expect(getSalsaCategorySlug('Variety Pack (6 Jars)')).toBeNull()
    expect(getSalsaCategorySlug('Jose Madrid T-Shirt')).toBeNull()
  })

  it('lists every flavor under exactly one category', () => {
    const names = Object.values(SALSA_CATEGORY_FLAVORS).flat().map(normalizeSalsaName)
    expect(new Set(names).size).toBe(names.length)
  })

  it('places every salsa in the imported catalog CSV', () => {
    const csv = readFileSync(join(process.cwd(), 'data/products-transformed.csv'), 'utf8')
    const names = csv
      .trim()
      .split('\n')
      .slice(1)
      .map((line) => line.split('","')[0].replace(/^"/, ''))
    expect(names.length).toBeGreaterThan(20)
    expect(names.filter((name) => !getSalsaCategorySlug(name))).toEqual([])
  })
})
