import { describe, expect, it } from 'vitest'

import {
  ANCHOR_GRADES,
  REVENUE_ANCHORS,
  anchorForYear,
  anchoredYears,
  isCompleteYear,
  totalCompleteYearCents,
} from '@/lib/financials/anchors'
import {
  RECONCILIATION_TOLERANCE_CENTS,
  reconcileYears,
  summariseReconciliation,
  type LedgerYearTotal,
} from '@/lib/financials/reconciliation'

describe('revenue anchors', () => {
  it('holds only whole-cent, positive figures', () => {
    for (const anchor of REVENUE_ANCHORS) {
      expect(Number.isInteger(anchor.grossReceiptsCents)).toBe(true)
      expect(anchor.grossReceiptsCents).toBeGreaterThan(0)
    }
  })

  it('has one anchor per year, with no duplicates', () => {
    const years = REVENUE_ANCHORS.map((a) => a.year)
    expect(new Set(years).size).toBe(years.length)
  })

  it('uses only known grades and always cites a source document', () => {
    for (const anchor of REVENUE_ANCHORS) {
      expect(ANCHOR_GRADES).toContain(anchor.grade)
      expect(anchor.sourceDocument.trim().length).toBeGreaterThan(0)
      expect(anchor.basis.trim().length).toBeGreaterThan(0)
    }
  })

  it('carries the figures read off the filed returns', () => {
    // Guards against a careless edit to numbers that came off signed tax documents.
    expect(anchorForYear(2022)?.grossReceiptsCents).toBe(65_972_100)
    expect(anchorForYear(2023)?.grossReceiptsCents).toBe(63_983_700)
    expect(anchorForYear(2024)?.grossReceiptsCents).toBe(65_470_300)
    expect(anchorForYear(2025)?.grossReceiptsCents).toBe(61_725_400)
  })

  it('qualifies every partial and floor year with a coverage note', () => {
    for (const anchor of REVENUE_ANCHORS) {
      if (!isCompleteYear(anchor.grade)) {
        expect(anchor.coverageNote, `${anchor.year} needs a coverage note`).toBeTruthy()
      }
    }
  })

  it('omits the years with no usable records rather than recording them as zero', () => {
    expect(anchorForYear(2011)).toBeNull()
    expect(anchorForYear(2012)).toBeNull()
    expect(anchoredYears()).not.toContain(2011)
  })

  it('totals only the complete years', () => {
    // 2013, 2014, 2018 (P&L) and 2022-2025 (filed) — not the floors, not the half of 2026.
    expect(totalCompleteYearCents()).toBe(337_251_926)
  })
})

describe('reconcileYears', () => {
  it('marks a year reconciled when the ledger matches the anchor', () => {
    const rows = reconcileYears([{ year: 2024, incomeCents: 65_470_300 }])
    const y2024 = rows.find((r) => r.year === 2024)

    expect(y2024?.status).toBe('RECONCILED')
    expect(y2024?.varianceCents).toBe(0)
    expect(y2024?.capturedRatio).toBe(1)
  })

  it('tolerates sub-dollar drift, because anchors are recorded in whole dollars', () => {
    const rows = reconcileYears([
      { year: 2024, incomeCents: 65_470_300 + RECONCILIATION_TOLERANCE_CENTS },
    ])
    expect(rows.find((r) => r.year === 2024)?.status).toBe('RECONCILED')

    const beyond = reconcileYears([
      { year: 2024, incomeCents: 65_470_300 + RECONCILIATION_TOLERANCE_CENTS + 1 },
    ])
    expect(beyond.find((r) => r.year === 2024)?.status).toBe('OVER_CAPTURED')
  })

  it('reports a shortfall against a filed return as under-captured', () => {
    const rows = reconcileYears([{ year: 2025, incomeCents: 24_392_200 }])
    const y2025 = rows.find((r) => r.year === 2025)

    expect(y2025?.status).toBe('UNDER_CAPTURED')
    expect(y2025?.varianceCents).toBe(24_392_200 - 61_725_400)
    expect(y2025?.capturedRatio).toBeCloseTo(0.395, 3)
  })

  it('treats beating a floor as success, not as a discrepancy', () => {
    // 2017's anchor is show sales alone; real revenue was certainly higher.
    const rows = reconcileYears([{ year: 2017, incomeCents: 40_000_000 }])
    const y2017 = rows.find((r) => r.year === 2017)

    expect(y2017?.status).toBe('ABOVE_FLOOR')
    expect(y2017?.capturedRatio).toBeGreaterThan(1)
  })

  it('distinguishes a year with no ledger rows from one with no anchor', () => {
    const rows = reconcileYears([{ year: 2012, incomeCents: 500 }])

    expect(rows.find((r) => r.year === 2012)?.status).toBe('NO_ANCHOR')
    expect(rows.find((r) => r.year === 2023)?.status).toBe('NO_LEDGER_DATA')
  })

  it('emits every anchored year even when the ledger is empty', () => {
    const rows = reconcileYears([])
    expect(rows.map((r) => r.year)).toEqual(anchoredYears())
    expect(rows.every((r) => r.status === 'NO_LEDGER_DATA')).toBe(true)
  })

  it('keeps ledger years the anchors do not cover', () => {
    const rows = reconcileYears([{ year: 2031, incomeCents: 1_000 }])
    const y2031 = rows.find((r) => r.year === 2031)

    expect(y2031?.status).toBe('NO_ANCHOR')
    expect(y2031?.anchorCents).toBeNull()
    expect(y2031?.varianceCents).toBeNull()
  })

  it('returns years in ascending order', () => {
    const rows = reconcileYears([{ year: 2026, incomeCents: 1 }, { year: 2013, incomeCents: 1 }])
    const years = rows.map((r) => r.year)
    expect([...years].sort((a, b) => a - b)).toEqual(years)
  })
})

describe('summariseReconciliation', () => {
  const fullyCaptured: LedgerYearTotal[] = REVENUE_ANCHORS.filter((a) => isCompleteYear(a.grade)).map(
    (a) => ({ year: a.year, incomeCents: a.grossReceiptsCents }),
  )

  it('reports full capture when every complete year matches', () => {
    const summary = summariseReconciliation(reconcileYears(fullyCaptured))

    expect(summary.completeYears).toBe(7)
    expect(summary.reconciledYears).toBe(7)
    expect(summary.capturedRatio).toBe(1)
    expect(summary.missingCents).toBe(0)
    expect(summary.largestGaps).toHaveLength(0)
  })

  it('excludes floors and partial years from the ratio', () => {
    // A wildly overstated floor year must not flatter the headline number.
    const summary = summariseReconciliation(
      reconcileYears([...fullyCaptured, { year: 2017, incomeCents: 999_999_999 }]),
    )

    expect(summary.completeYears).toBe(7)
    expect(summary.capturedRatio).toBe(1)
    expect(summary.anchorCents).toBe(totalCompleteYearCents())
  })

  it('measures the shortfall across complete years only', () => {
    const summary = summariseReconciliation(reconcileYears([{ year: 2025, incomeCents: 24_392_200 }]))

    expect(summary.ledgerIncomeCents).toBe(24_392_200)
    expect(summary.anchorCents).toBe(totalCompleteYearCents())
    expect(summary.missingCents).toBe(totalCompleteYearCents() - 24_392_200)
    expect(summary.capturedRatio).toBeLessThan(0.1)
  })

  it('ranks the gaps worst-first so the next job is obvious', () => {
    const summary = summariseReconciliation(
      reconcileYears([
        { year: 2022, incomeCents: 65_972_100 },
        { year: 2023, incomeCents: 60_000_000 },
        { year: 2024, incomeCents: 10_000_000 },
      ]),
    )

    // 2013/2014/2018/2025 have no rows at all and rank by their full anchor value.
    expect(summary.largestGaps[0]?.year).toBe(2025)
    expect(summary.largestGaps.map((g) => g.year)).not.toContain(2022)

    const variances = summary.largestGaps.map((g) => g.varianceCents ?? 0)
    expect([...variances].sort((a, b) => a - b)).toEqual(variances)
  })

  it('never reports negative missing money when the ledger runs ahead', () => {
    const summary = summariseReconciliation(
      reconcileYears(fullyCaptured.map((t) => ({ ...t, incomeCents: t.incomeCents * 2 }))),
    )
    expect(summary.missingCents).toBe(0)
  })
})
