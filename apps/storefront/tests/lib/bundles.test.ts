import { describe, expect, it } from 'vitest'
import {
  BundlePricingError,
  SALSA_BUNDLES,
  bundleSavings,
  getSalsaBundle,
  priceCartLines,
  typicalJarPrice,
} from '@/lib/bundles'

const CATALOGUE_PRICE = 9
const retail = () => CATALOGUE_PRICE

const packLines = (bundleId: string, productIds: string[], groupId = 'group-1') =>
  productIds.map((productId) => ({
    productId,
    quantity: 1,
    bundleId,
    bundleGroupId: groupId,
  }))

const sumLineTotals = (lines: Array<{ lineTotal: number }>) =>
  Math.round(lines.reduce((total, line) => total + line.lineTotal, 0) * 100) / 100

describe('salsa bundles', () => {
  describe('definitions', () => {
    it('advertises the four mix-and-match packs at their published prices', () => {
      expect(SALSA_BUNDLES.map((bundle) => [bundle.id, bundle.size, bundle.price])).toEqual([
        ['choose-3', 3, 23],
        ['choose-5', 5, 28],
        ['choose-6', 6, 32],
        ['choose-12', 12, 60],
      ])
    })

    it('looks a pack up by id', () => {
      expect(getSalsaBundle('choose-5')?.name).toBe('Choose 5 Pack')
      expect(getSalsaBundle('choose-4')).toBeUndefined()
    })
  })

  describe('priceCartLines', () => {
    it('charges a Choose 5 the advertised $28, not five jars at catalogue price', () => {
      const priced = priceCartLines(
        packLines('choose-5', ['a', 'b', 'c', 'd', 'e']),
        retail
      )

      expect(sumLineTotals(priced)).toBe(28)
      expect(priced.every((line) => line.unitPrice === 5.6)).toBe(true)
    })

    it('splits a pack price that does not divide evenly without losing a cent', () => {
      const priced = priceCartLines(packLines('choose-3', ['a', 'b', 'c']), retail)

      expect(sumLineTotals(priced)).toBe(23)
      expect(priced.map((line) => line.lineTotal).sort()).toEqual([7.66, 7.67, 7.67])
    })

    it('prices every pack to exactly its advertised price', () => {
      for (const bundle of SALSA_BUNDLES) {
        const productIds = Array.from({ length: bundle.size }, (_, index) => `p${index}`)
        const priced = priceCartLines(packLines(bundle.id, productIds), retail)

        expect(sumLineTotals(priced)).toBe(bundle.price)
      }
    })

    it('splits the pack price in proportion to what the jars are worth', () => {
      const priced = priceCartLines(packLines('choose-3', ['cheap', 'mid', 'dear']), (line) =>
        line.productId === 'cheap' ? 5 : line.productId === 'mid' ? 10 : 15
      )

      expect(sumLineTotals(priced)).toBe(23)
      expect(priced.map((line) => line.lineTotal)).toEqual([3.83, 7.67, 11.5])
    })

    it('keeps a jar chosen twice on one line and still totals the pack price', () => {
      const priced = priceCartLines(
        [
          { productId: 'a', quantity: 2, bundleId: 'choose-3', bundleGroupId: 'group-1' },
          { productId: 'b', quantity: 1, bundleId: 'choose-3', bundleGroupId: 'group-1' },
        ],
        retail
      )

      expect(sumLineTotals(priced)).toBe(23)
      expect(priced[0].quantity).toBe(2)
    })

    it('prices two packs of the same kind separately', () => {
      const priced = priceCartLines(
        [
          ...packLines('choose-3', ['a', 'b', 'c'], 'group-1'),
          ...packLines('choose-3', ['a', 'd', 'e'], 'group-2'),
        ],
        retail
      )

      expect(sumLineTotals(priced)).toBe(46)
    })

    it('charges loose jars at catalogue price alongside a pack', () => {
      const priced = priceCartLines(
        [
          { productId: 'loose', quantity: 2 },
          ...packLines('choose-5', ['a', 'b', 'c', 'd', 'e']),
        ],
        retail
      )

      expect(priced[0].unitPrice).toBe(CATALOGUE_PRICE)
      expect(priced[0].lineTotal).toBe(18)
      expect(sumLineTotals(priced)).toBe(46)
    })

    it('leaves the line order untouched', () => {
      const priced = priceCartLines(
        [
          ...packLines('choose-3', ['a', 'b', 'c']),
          { productId: 'loose', quantity: 1 },
        ],
        retail
      )

      expect(priced.map((line) => line.productId)).toEqual(['a', 'b', 'c', 'loose'])
    })

    it('refuses a pack that is short a jar rather than charging for a whole one', () => {
      expect(() =>
        priceCartLines(packLines('choose-5', ['a', 'b', 'c', 'd']), retail)
      ).toThrow(BundlePricingError)
    })

    it('refuses a pack padded with extra jars', () => {
      expect(() =>
        priceCartLines(packLines('choose-3', ['a', 'b', 'c', 'd']), retail)
      ).toThrow(/holds 3 jars, but 4 were sent/)
    })

    it('refuses a pack that does not exist', () => {
      expect(() =>
        priceCartLines(packLines('choose-99', ['a', 'b', 'c']), retail)
      ).toThrow(/Unknown pack/)
    })

    it('refuses a group whose lines claim two different packs', () => {
      expect(() =>
        priceCartLines(
          [
            { productId: 'a', quantity: 1, bundleId: 'choose-3', bundleGroupId: 'group-1' },
            { productId: 'b', quantity: 1, bundleId: 'choose-5', bundleGroupId: 'group-1' },
            { productId: 'c', quantity: 1, bundleId: 'choose-3', bundleGroupId: 'group-1' },
          ],
          retail
        )
      ).toThrow(BundlePricingError)
    })

    it('refuses a pack item that names no group', () => {
      expect(() =>
        priceCartLines([{ productId: 'a', quantity: 1, bundleId: 'choose-3' }], retail)
      ).toThrow(BundlePricingError)
    })

    it('refuses a group item that names no pack', () => {
      expect(() =>
        priceCartLines([{ productId: 'a', quantity: 1, bundleGroupId: 'group-1' }], retail)
      ).toThrow(BundlePricingError)
    })

    it('prices a pack of free jars without dividing by zero', () => {
      const priced = priceCartLines(packLines('choose-3', ['a', 'b', 'c']), () => 0)

      expect(sumLineTotals(priced)).toBe(23)
    })
  })

  describe('savings copy', () => {
    it('takes the jar price the catalogue uses most often', () => {
      expect(typicalJarPrice([9, 9, 9, 12, 3])).toBe(9)
    })

    it('breaks a tie towards the cheaper jar', () => {
      expect(typicalJarPrice([9, 12])).toBe(9)
    })

    it('ignores prices that cannot be jars', () => {
      expect(typicalJarPrice([0, -5, Number.NaN])).toBeNull()
      expect(typicalJarPrice([])).toBeNull()
    })

    it('reports what a pack actually saves', () => {
      expect(bundleSavings(getSalsaBundle('choose-5')!, 9)).toBe(17)
    })

    it('claims no saving when there is none to claim', () => {
      expect(bundleSavings(getSalsaBundle('choose-5')!, 5)).toBeNull()
      expect(bundleSavings(getSalsaBundle('choose-5')!, null)).toBeNull()
    })
  })
})
