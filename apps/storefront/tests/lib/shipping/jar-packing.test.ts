import { describe, expect, it } from 'vitest'

import {
  jarGrossWeightOz,
  JARS_PER_CASE,
  JAR_TARE_OZ,
  packJars,
  describeJarPacking,
} from '@/lib/shipping/jar-packing'

describe('jarGrossWeightOz', () => {
  it('is far heavier than the jar size, because glass is not free', () => {
    // Product.weight stores 16 — the contents. Shipping on 16 oz under-declares a jar by two
    // thirds, and an under-declared parcel is rejected at the counter.
    const gross = jarGrossWeightOz(16)
    expect(gross).toBeGreaterThan(25)
    expect(gross).toBeLessThan(30)
  })

  it('accounts for salsa being denser than water', () => {
    // 16 fluid ounces of salsa weighs more than 16 ounces.
    expect(jarGrossWeightOz(16) - JAR_TARE_OZ).toBeGreaterThan(16)
  })

  it('scales with jar size', () => {
    expect(jarGrossWeightOz(32)).toBeGreaterThan(jarGrossWeightOz(16))
  })
})

describe('packJars', () => {
  it('puts three jars in one line', () => {
    const parcel = packJars(3)
    expect(parcel).toMatchObject({ jarsAcross: 3, lines: 1, layers: 1, boxes: 1 })
  })

  it('puts five jars in two lines of three, per the warehouse rule', () => {
    const parcel = packJars(5)
    expect(parcel).toMatchObject({ jarsAcross: 3, lines: 2, boxes: 1 })
  })

  it('fills a case at twelve — four lines of three', () => {
    const parcel = packJars(JARS_PER_CASE)
    expect(parcel).toMatchObject({ jarsAcross: 3, lines: 4, layers: 1, boxes: 1 })
  })

  it('uses a small box for a single jar rather than a twelve-jar carton', () => {
    const one = packJars(1)
    const twelve = packJars(12)
    expect(one.jarsAcross).toBe(1)
    expect(one.lines).toBe(1)
    // Both dimensions of the footprint should be smaller.
    expect(one.length).toBeLessThan(twelve.length)
    expect(one.width).toBeLessThanOrEqual(twelve.width)
  })

  it('sizes a case close to a real salsa carton', () => {
    // A real case of twelve pint jars is roughly 13 x 10 x 6 inches and about 22 lb.
    const parcel = packJars(12)
    expect(parcel.length).toBeGreaterThan(11)
    expect(parcel.length).toBeLessThan(14)
    expect(parcel.width).toBeGreaterThan(8)
    expect(parcel.width).toBeLessThan(11)
    expect(parcel.height).toBeGreaterThan(5)
    expect(parcel.height).toBeLessThan(7)
    expect(parcel.weightOz / 16).toBeGreaterThan(20)
    expect(parcel.weightOz / 16).toBeLessThan(24)
  })

  it('opens a second box on the thirteenth jar', () => {
    expect(packJars(12).boxes).toBe(1)
    expect(packJars(13).boxes).toBe(2)
    expect(packJars(24).boxes).toBe(2)
    expect(packJars(25).boxes).toBe(3)
  })

  it('grows in height rather than footprint for multiple cases', () => {
    const one = packJars(12)
    const two = packJars(24)
    expect(two.length).toBe(one.length)
    expect(two.width).toBe(one.width)
    expect(two.height).toBeGreaterThan(one.height)
  })

  it('counts box and divider weight per box, not once', () => {
    const one = packJars(12)
    const two = packJars(24)
    // Two cases weigh more than twice one case's jars alone, because there are two boxes.
    expect(two.weightOz).toBeGreaterThan(one.weightOz * 2 - 1)
  })

  it('reports the longest side as the length', () => {
    const parcel = packJars(12)
    expect(parcel.length).toBeGreaterThanOrEqual(parcel.width)
  })

  it('is empty for zero jars rather than producing a phantom box', () => {
    expect(packJars(0)).toMatchObject({ boxes: 0, weightOz: 0, length: 0 })
  })

  it('ignores a fractional or negative count', () => {
    expect(packJars(2.7).jarsAcross).toBe(2)
    expect(packJars(-4).boxes).toBe(0)
  })
})

describe('describeJarPacking', () => {
  it('tells staff the grid to pack', () => {
    expect(describeJarPacking(packJars(5))).toContain('2 lines of 3')
  })

  it('says when an order needs more than one box', () => {
    expect(describeJarPacking(packJars(24))).toContain('2 boxes')
  })

  it('handles nothing gracefully', () => {
    expect(describeJarPacking(packJars(0))).toBe('Nothing to pack')
  })
})
