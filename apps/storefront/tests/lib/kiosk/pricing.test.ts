import { describe, expect, it } from 'vitest'
import { dealLabel, formatCents, nextJarHint, quoteJars } from '@/lib/kiosk/pricing'

describe('quoteJars', () => {
  it('charges exactly what the booth sign says', () => {
    expect(quoteJars(1).totalCents).toBe(1000)
    expect(quoteJars(3).totalCents).toBe(2500)
    expect(quoteJars(4).totalCents).toBe(3200)
    expect(quoteJars(5).totalCents).toBe(4000)
    expect(quoteJars(12).totalCents).toBe(8000)
  })

  it('gives a bag of chips with the show special', () => {
    expect(quoteJars(5)).toMatchObject({ freeChips: 1, deals: [{ name: 'Show Special', count: 1 }] })
    expect(quoteJars(10)).toMatchObject({ totalCents: 8000, freeChips: 2 })
  })

  it('stacks bundles for the cheapest total', () => {
    expect(quoteJars(7)).toMatchObject({ totalCents: 5700, savingsCents: 1300 })
    expect(quoteJars(9)).toMatchObject({ totalCents: 7200, freeChips: 1 })
    expect(quoteJars(15).totalCents).toBe(10500)
  })

  it('never charges more than list price and is free at zero', () => {
    for (let n = 0; n <= 30; n++) {
      const q = quoteJars(n)
      expect(q.totalCents).toBeLessThanOrEqual(q.listCents)
      expect(q.savingsCents).toBe(q.listCents - q.totalCents)
    }
    expect(quoteJars(0)).toMatchObject({ totalCents: 0, deals: [] })
  })

  it('rejects nonsense counts', () => {
    expect(() => quoteJars(-1)).toThrow()
    expect(() => quoteJars(1.5)).toThrow()
  })
})

describe('labels and hints', () => {
  it('describes the deals applied', () => {
    expect(dealLabel(quoteJars(8).deals)).toBe('2 × 4-jar deal')
    expect(dealLabel(quoteJars(7).deals)).toBe('4-jar deal + 3-jar deal')
  })

  it('nudges when one more jar is a bargain', () => {
    expect(nextJarHint(0)).toBeNull()
    expect(nextJarHint(1)).toBeNull()
    expect(nextJarHint(2)).toBe('Add 1 more jar for just $5.00')
    expect(nextJarHint(4)).toBe('Add 1 more jar for just $8.00 and get a FREE bag of chips')
    expect(nextJarHint(11)).toBe('Add 1 more jar to make a case of 12. Your total drops to $80.00!')
  })

  it('formats cents', () => {
    expect(formatCents(2500)).toBe('$25.00')
    expect(formatCents(-800)).toBe('-$8.00')
  })
})
