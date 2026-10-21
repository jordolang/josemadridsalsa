import { describe, expect, it } from 'vitest'

import {
  DEFAULT_JAR_CONTENTS_OZ,
  jarGrossWeightOz,
  JARS_PER_CASE,
  JAR_TARE_OZ,
  SHIPPING_BOXES,
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
  it('assumes the 13 oz jar when it only knows the count', () => {
    expect(DEFAULT_JAR_CONTENTS_OZ).toBe(13)
    expect(packJars(3).weightOz).toBe(packJars(3, 3 * 13).weightOz)
  })

  it.each([
    [1, '1–3 jar box', 10, 7, 5],
    [3, '1–3 jar box', 10, 7, 5],
    [4, '4–6 jar box', 12, 9, 6],
    [6, '4–6 jar box', 12, 9, 6],
    [7, 'Case box', 14, 10, 8],
    [JARS_PER_CASE, 'Case box', 14, 10, 8],
    [13, '2-case box', 20, 15, 9],
    [24, '2-case box', 20, 15, 9],
  ])('ships %i jars in the %s (%i × %i × %i)', (jars, name, length, width, height) => {
    const parcel = packJars(jars)
    expect(parcel.box?.name).toBe(name)
    expect(parcel).toMatchObject({ length, width, height, boxes: 1 })
  })

  it('weighs a case close to a real salsa carton', () => {
    // With 13 oz of salsa in each jar, a case of twelve weighs about 19 lb.
    const parcel = packJars(12)
    expect(parcel.weightOz / 16).toBeGreaterThan(17)
    expect(parcel.weightOz / 16).toBeLessThan(22)
  })

  it('opens a second 2-case box on the twenty-fifth jar', () => {
    expect(packJars(24).boxes).toBe(1)
    expect(packJars(25).boxes).toBe(2)
    expect(packJars(48).boxes).toBe(2)
    expect(packJars(49).boxes).toBe(3)
  })

  it('stacks 2-case boxes in height rather than footprint beyond two cases', () => {
    const parcel = packJars(36)
    expect(parcel).toMatchObject({ length: 20, width: 15, height: 18 })
  })

  it('counts box and divider weight per box, not once', () => {
    const one = packJars(24)
    const two = packJars(48)
    // Four cases weigh more than twice two cases' jars alone, because there are two boxes.
    expect(two.weightOz).toBeGreaterThan(one.weightOz * 2 - 1)
  })

  it('reports the longest side as the length', () => {
    for (const box of SHIPPING_BOXES) {
      expect(box.length).toBeGreaterThanOrEqual(box.width)
    }
  })

  it('is empty for zero jars rather than producing a phantom box', () => {
    expect(packJars(0)).toMatchObject({ boxes: 0, weightOz: 0, length: 0 })
  })

  it('ignores a fractional or negative count', () => {
    expect(packJars(3.7).box?.name).toBe('1–3 jar box')
    expect(packJars(-4).boxes).toBe(0)
  })
})

describe('describeJarPacking', () => {
  it('tells staff which box to pack', () => {
    expect(describeJarPacking(packJars(5))).toContain('4–6 jar box — 12″ × 9″ × 6″')
  })

  it('says when an order needs more than one box', () => {
    expect(describeJarPacking(packJars(30))).toContain('2 × 2-case box')
  })

  it('handles nothing gracefully', () => {
    expect(describeJarPacking(packJars(0))).toBe('Nothing to pack')
  })
})
