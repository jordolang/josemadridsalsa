import { describe, it, expect } from 'vitest'
import { FORM_SPECS, classifyLabel, isTotalLabel } from '@/lib/form-capture/form-specs'
import { classifyExtraction } from '@/lib/form-capture/extract'

describe('classifyLabel', () => {
  it('books every tender type on a show sheet as show income', () => {
    for (const label of ['Cash', 'Credit', 'Visa', 'Square', 'Check', 'Venmo']) {
      const result = classifyLabel(label, 'SHOW_SETTLEMENT')
      expect(result).toMatchObject({ direction: 'INCOME', category: 'SHOW_SALES' })
    }
  })

  it('books fees and travel on a show sheet as expenses', () => {
    expect(classifyLabel('Booth fee', 'SHOW_SETTLEMENT')).toMatchObject({
      direction: 'EXPENSE',
      category: 'BOOTH_FEE',
    })
    expect(classifyLabel('Hotel', 'SHOW_SETTLEMENT')).toMatchObject({
      direction: 'EXPENSE',
      category: 'TRAVEL',
    })
    expect(classifyLabel('Lunch', 'SHOW_SETTLEMENT')).toMatchObject({
      direction: 'EXPENSE',
      category: 'MEALS',
    })
  })

  it('resolves a label that reads as both fee and tender to the fee', () => {
    // "Cash show fee" is money going out, not takings. Expense rules are listed first in the
    // spec precisely so this cannot land on the income side.
    expect(classifyLabel('Cash show fee', 'SHOW_SETTLEMENT')).toMatchObject({
      direction: 'EXPENSE',
      category: 'BOOTH_FEE',
    })
  })

  it('marks unit rows as quantities so they never post as dollars', () => {
    expect(classifyLabel('Jars sold', 'SHOW_SETTLEMENT').isQuantity).toBe(true)
    expect(classifyLabel('Miles', 'MILEAGE_LOG').isQuantity).toBe(true)
    expect(classifyLabel('Cash', 'SHOW_SETTLEMENT').isQuantity).toBe(false)
  })

  it('books a fundraiser payment as product sales, not show sales', () => {
    expect(classifyLabel('Amount paid', 'FUNDRAISER_ORDER')).toMatchObject({
      direction: 'INCOME',
      category: 'PRODUCT_SALES',
    })
  })

  it('books receipt lines to cost of goods where the label names an ingredient', () => {
    expect(classifyLabel('Jars and lids', 'EXPENSE_RECEIPT')).toMatchObject({
      direction: 'EXPENSE',
      category: 'COGS',
    })
  })

  it('falls back per form type rather than to a single global default', () => {
    expect(classifyLabel('Zzz unknown', 'SHOW_SETTLEMENT')).toMatchObject({
      direction: 'INCOME',
      category: 'SHOW_SALES',
    })
    expect(classifyLabel('Zzz unknown', 'EXPENSE_RECEIPT')).toMatchObject({
      direction: 'EXPENSE',
      category: 'OTHER_EXPENSE',
    })
  })

  it('has a spec for every form type in the schema', () => {
    const types = Object.keys(FORM_SPECS)
    expect(types).toEqual(
      expect.arrayContaining([
        'SHOW_SETTLEMENT',
        'FARMERS_MARKET',
        'FUNDRAISER_ORDER',
        'MILEAGE_LOG',
        'EXPENSE_RECEIPT',
        'OTHER',
      ])
    )
    for (const spec of Object.values(FORM_SPECS)) {
      expect(spec.expectedFields.length).toBeGreaterThan(0)
      expect(spec.description.length).toBeGreaterThan(0)
    }
  })
})

describe('isTotalLabel', () => {
  it.each(['Total', 'TOTAL SALES', 'Grand Total', 'Subtotal'])('flags %s', (label) => {
    expect(isTotalLabel(label)).toBe(true)
  })

  it('does not flag an ordinary tender row', () => {
    expect(isTotalLabel('Cash')).toBe(false)
    expect(isTotalLabel('Booth fee')).toBe(false)
  })
})

describe('classifyExtraction', () => {
  const now = new Date(Date.UTC(2026, 7, 19))

  it('drops the total row so a day of sales cannot be counted twice', () => {
    // The most dangerous failure mode in this pipeline: a "Total" row posting alongside the
    // rows it summarises would double the day's takings.
    const result = classifyExtraction(
      {
        documentDate: '4/13/26',
        subject: 'Akron Home Show',
        statedTotal: '$500.00',
        lines: [
          { label: 'Cash', value: '$300.00', isQuantity: false, confidence: 0.98 },
          { label: 'Credit', value: '$200.00', isQuantity: false, confidence: 0.97 },
          { label: 'Total', value: '$500.00', isQuantity: false, confidence: 0.99 },
        ],
      },
      'SHOW_SETTLEMENT',
      now
    )

    expect(result.classified).toHaveLength(2)
    expect(result.classified.map((l) => l.label)).toEqual(['Cash', 'Credit'])
    expect(result.statedTotalCents).toBe(50_000)
    expect(result.capturedOn?.toISOString()).toBe('2026-04-13T00:00:00.000Z')
    expect(result.subject).toBe('Akron Home Show')
  })

  it('drops an unreadable money row instead of posting it as zero', () => {
    const result = classifyExtraction(
      {
        documentDate: null,
        subject: null,
        statedTotal: null,
        lines: [
          { label: 'Cash', value: '$300.00', isQuantity: false, confidence: 0.98 },
          { label: 'Credit', value: 'illegible', isQuantity: false, confidence: 0.4 },
        ],
      },
      'SHOW_SETTLEMENT',
      now
    )

    expect(result.classified).toHaveLength(1)
    expect(result.classified[0].label).toBe('Cash')
  })

  it('records a quantity row with no dollar amount', () => {
    const result = classifyExtraction(
      {
        documentDate: null,
        subject: null,
        statedTotal: null,
        lines: [{ label: 'Jars sold', value: '144', isQuantity: true, confidence: 0.95 }],
      },
      'SHOW_SETTLEMENT',
      now
    )

    expect(result.classified[0]).toMatchObject({ quantity: 144, amountCents: 0 })
  })

  it('stores amounts as positive with direction carrying the sign', () => {
    const result = classifyExtraction(
      {
        documentDate: null,
        subject: null,
        statedTotal: null,
        lines: [{ label: 'Booth fee', value: '(75.00)', isQuantity: false, confidence: 0.99 }],
      },
      'SHOW_SETTLEMENT',
      now
    )

    expect(result.classified[0]).toMatchObject({
      amountCents: 7_500,
      direction: 'EXPENSE',
      category: 'BOOTH_FEE',
    })
  })

  it('keeps the raw value alongside the parsed figure for audit', () => {
    const result = classifyExtraction(
      {
        documentDate: null,
        subject: null,
        statedTotal: null,
        lines: [{ label: 'Cash', value: '$1,234.50', isQuantity: false, confidence: 0.93 }],
      },
      'SHOW_SETTLEMENT',
      now
    )

    expect(result.classified[0].rawValue).toBe('$1,234.50')
    expect(result.classified[0].amountCents).toBe(123_450)
  })
})
