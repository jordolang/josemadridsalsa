import { describe, it, expect } from 'vitest'
import {
  AUTO_APPROVE_MIN_CONFIDENCE,
  decideStatus,
  lowestConfidence,
  parseFormDate,
  parseMoneyToCents,
  parseQuantity,
  reconcile,
} from '@/lib/form-capture/parse'
import type { ClassifiedLine } from '@/lib/form-capture/types'

function line(overrides: Partial<ClassifiedLine> = {}): ClassifiedLine {
  return {
    label: 'Cash',
    amountCents: 10_000,
    quantity: null,
    confidence: 0.99,
    rawValue: '$100.00',
    direction: 'INCOME',
    category: 'SHOW_SALES',
    ...overrides,
  }
}

describe('parseMoneyToCents', () => {
  it.each([
    ['$1,234.50', 123_450],
    ['1234.50', 123_450],
    ['1,234', 123_400],
    ['$ 87.00', 8_700],
    ['87', 8_700],
    ['$1,234.-', 123_400],
    ['  $42.75  ', 4_275],
    ['4100.45 gross', 410_045],
  ])('reads %s as %d cents', (input, expected) => {
    expect(parseMoneyToCents(input)).toBe(expected)
  })

  it('treats a lone dash as an explicit zero, the way a bookkeeper means it', () => {
    expect(parseMoneyToCents('-')).toBe(0)
    expect(parseMoneyToCents('—')).toBe(0)
  })

  it('returns null for an unreadable figure rather than defaulting to zero', () => {
    // This is the important one: a null forces the form into review, a zero would silently
    // post a day of sales as nothing.
    expect(parseMoneyToCents('')).toBeNull()
    expect(parseMoneyToCents('   ')).toBeNull()
    expect(parseMoneyToCents('illegible')).toBeNull()
    expect(parseMoneyToCents(null)).toBeNull()
    expect(parseMoneyToCents(undefined)).toBeNull()
  })

  it('reads parenthesised and signed figures as negative', () => {
    expect(parseMoneyToCents('(50.00)')).toBe(-5_000)
    expect(parseMoneyToCents('-50.00')).toBe(-5_000)
  })

  it('accepts a number without losing cents to float error', () => {
    expect(parseMoneyToCents(1234.56)).toBe(123_456)
    expect(parseMoneyToCents(0.29)).toBe(29)
    expect(parseMoneyToCents(Number.NaN)).toBeNull()
  })
})

describe('parseQuantity', () => {
  it('reads whole units', () => {
    expect(parseQuantity('144')).toBe(144)
    expect(parseQuantity('1,919')).toBe(1_919)
    expect(parseQuantity('12 jars')).toBe(12)
  })

  it('returns null when there is no number', () => {
    expect(parseQuantity('')).toBeNull()
    expect(parseQuantity('n/a')).toBeNull()
  })
})

describe('parseFormDate', () => {
  const now = new Date(Date.UTC(2026, 7, 19))

  it('reads US-order slash dates, which is how every form in the archive is written', () => {
    expect(parseFormDate('4/13/26', now)?.toISOString()).toBe('2026-04-13T00:00:00.000Z')
    expect(parseFormDate('12/1/2025', now)?.toISOString()).toBe('2025-12-01T00:00:00.000Z')
  })

  it('reads ISO dates without applying US ordering', () => {
    expect(parseFormDate('2026-04-13', now)?.toISOString()).toBe('2026-04-13T00:00:00.000Z')
  })

  it('never resolves a two-digit year into the future', () => {
    // "99" on a form photographed in 2026 is 1999, not 2099.
    expect(parseFormDate('7/4/99', now)?.getUTCFullYear()).toBe(1999)
    expect(parseFormDate('7/4/26', now)?.getUTCFullYear()).toBe(2026)
  })

  it('rejects an impossible date instead of rolling it forward', () => {
    // JS would happily turn 2/30 into March 2nd, which would silently misdate a day's takings.
    expect(parseFormDate('2/30/26', now)).toBeNull()
    expect(parseFormDate('13/1/26', now)).toBeNull()
  })

  it('returns null for prose', () => {
    expect(parseFormDate('sometime in April', now)).toBeNull()
    expect(parseFormDate(null, now)).toBeNull()
  })
})

describe('reconcile', () => {
  it('agrees when the stated total matches the income lines', () => {
    const lines = [line({ amountCents: 30_000 }), line({ label: 'Credit', amountCents: 20_000 })]
    expect(reconcile(lines, 50_000)).toEqual({ reconciled: true, deltaCents: 0 })
  })

  it('reports the gap when the hand-added total disagrees', () => {
    const lines = [line({ amountCents: 30_000 }), line({ label: 'Credit', amountCents: 20_000 })]
    expect(reconcile(lines, 52_000)).toEqual({ reconciled: false, deltaCents: 2_000 })
  })

  it('excludes expense lines from the total it checks against', () => {
    // A booth fee written on a show sheet was never part of the day's takings; counting it
    // would manufacture a mismatch on a form that is actually correct.
    const lines = [
      line({ amountCents: 50_000 }),
      line({ label: 'Booth fee', amountCents: 7_500, direction: 'EXPENSE', category: 'BOOTH_FEE' }),
    ]
    expect(reconcile(lines, 50_000)).toEqual({ reconciled: true, deltaCents: 0 })
  })

  it('reports null when the form states no total', () => {
    expect(reconcile([line()], null)).toEqual({ reconciled: null, deltaCents: 0 })
  })
})

describe('decideStatus', () => {
  it('auto-approves a confident, reconciling form', () => {
    expect(decideStatus({ lines: [line()], reconciled: true })).toBe('APPROVED')
  })

  it('auto-approves when the form simply stated no total', () => {
    expect(decideStatus({ lines: [line()], reconciled: null })).toBe('APPROVED')
  })

  it('sends a form to review when any single line is below the confidence bar', () => {
    const lines = [line(), line({ label: 'Credit', confidence: 0.62 })]
    expect(decideStatus({ lines, reconciled: true })).toBe('NEEDS_REVIEW')
  })

  it('sends a form to review when the arithmetic on the page disagrees', () => {
    expect(decideStatus({ lines: [line()], reconciled: false })).toBe('NEEDS_REVIEW')
  })

  it('sends an empty extraction to review rather than posting nothing', () => {
    expect(decideStatus({ lines: [], reconciled: null })).toBe('NEEDS_REVIEW')
  })

  it('treats the threshold as inclusive', () => {
    const lines = [line({ confidence: AUTO_APPROVE_MIN_CONFIDENCE })]
    expect(decideStatus({ lines, reconciled: true })).toBe('APPROVED')
  })
})

describe('lowestConfidence', () => {
  it('reports the weakest line on the form', () => {
    expect(lowestConfidence([line({ confidence: 0.99 }), line({ confidence: 0.71 })])).toBe(0.71)
  })

  it('is null when there are no lines', () => {
    expect(lowestConfidence([])).toBeNull()
  })
})
