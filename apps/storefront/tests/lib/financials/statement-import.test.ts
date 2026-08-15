import { describe, expect, it } from 'vitest'

import {
  MATCH_WINDOW_DAYS,
  categoryMatchesDirection,
  detectStatementMapping,
  mappingProblems,
  parseMoneyCents,
  parseStatementDate,
  parseStatementRows,
  reviewStatementRows,
  statementRowHash,
  suggestCategory,
  type ParsedStatementRow,
} from '@/lib/financials/statement-import'

const day = (iso: string) => new Date(`${iso}T00:00:00.000Z`)

function parsedRow(over: Partial<ParsedStatementRow> = {}): ParsedStatementRow {
  return {
    lineNumber: 2,
    date: day('2026-08-13'),
    description: 'SHELL OIL 574123',
    amountCents: -4210,
    ...over,
  }
}

describe('parseMoneyCents', () => {
  it('reads plain and decorated amounts', () => {
    expect(parseMoneyCents('54.00')).toBe(5400)
    expect(parseMoneyCents('$1,234.56')).toBe(123456)
    expect(parseMoneyCents(' -12.34 ')).toBe(-1234)
    expect(parseMoneyCents('0.07')).toBe(7)
  })

  it('reads accounting parentheses as negative', () => {
    // Read naively this is NaN, or worse `12.34` — turning a withdrawal into a deposit.
    expect(parseMoneyCents('(12.34)')).toBe(-1234)
    expect(parseMoneyCents('($1,000.00)')).toBe(-100000)
  })

  it('rejects rather than guesses at anything it does not recognise', () => {
    expect(parseMoneyCents('1.234,56')).toBeNull() // European notation is ambiguous here
    expect(parseMoneyCents('n/a')).toBeNull()
    expect(parseMoneyCents('')).toBeNull()
    expect(parseMoneyCents(null)).toBeNull()
    expect(parseMoneyCents('12.34.56')).toBeNull()
  })
})

describe('parseStatementDate', () => {
  it('reads ISO and US formats at UTC midnight', () => {
    expect(parseStatementDate('2026-08-13')).toEqual(day('2026-08-13'))
    expect(parseStatementDate('08/13/2026')).toEqual(day('2026-08-13'))
    expect(parseStatementDate('8/3/26')).toEqual(day('2026-08-03'))
  })

  it('rejects an impossible date instead of rolling it into the next month', () => {
    expect(parseStatementDate('02/31/2026')).toBeNull()
    expect(parseStatementDate('13/01/2026')).toBeNull()
  })

  it('rejects free-form dates rather than handing them to the Date parser', () => {
    // `new Date()` accepts almost anything and invents a date from it.
    expect(parseStatementDate('13 August 2026')).toBeNull()
    expect(parseStatementDate('yesterday')).toBeNull()
    expect(parseStatementDate(null)).toBeNull()
  })
})

describe('detectStatementMapping', () => {
  it('recognises a typical bank export', () => {
    const mapping = detectStatementMapping(['Posting Date', 'Description', 'Amount', 'Balance'])
    expect(mapping.date).toBe('Posting Date')
    expect(mapping.description).toBe('Description')
    expect(mapping.amount).toBe('Amount')
  })

  it('recognises a debit/credit pair', () => {
    const mapping = detectStatementMapping(['Date', 'Details', 'Withdrawals', 'Deposits'])
    expect(mapping.debit).toBe('Withdrawals')
    expect(mapping.credit).toBe('Deposits')
  })

  it('does not let one header serve two fields', () => {
    const mapping = detectStatementMapping(['Transaction Date', 'Transaction Amount', 'Payee'])
    expect(mapping.date).toBe('Transaction Date')
    expect(mapping.amount).toBe('Transaction Amount')
    expect(mapping.description).toBe('Payee')
  })
})

describe('mappingProblems', () => {
  it('accepts either a signed amount or a debit/credit pair', () => {
    expect(mappingProblems({ date: 'D', description: 'X', amount: 'A' })).toEqual([])
    expect(mappingProblems({ date: 'D', description: 'X', debit: 'W', credit: 'C' })).toEqual([])
  })

  it('names what is missing', () => {
    expect(mappingProblems({})).toEqual([
      'No date column',
      'No description column',
      'No amount column, and no debit/credit pair',
    ])
  })
})

describe('parseStatementRows', () => {
  const mapping = { date: 'Date', description: 'Description', amount: 'Amount' }

  it('normalises rows and numbers them by file line', () => {
    const { rows, errors } = parseStatementRows(
      [
        { Date: '08/13/2026', Description: 'SHELL OIL', Amount: '-42.10' },
        { Date: '2026-08-14', Description: 'Booth fee', Amount: '(150.00)' },
      ],
      mapping
    )
    expect(errors).toEqual([])
    expect(rows).toHaveLength(2)
    expect(rows[0]).toMatchObject({ lineNumber: 2, amountCents: -4210 })
    expect(rows[1]).toMatchObject({ lineNumber: 3, amountCents: -15000 })
  })

  it('reports unreadable rows instead of dropping them silently', () => {
    const { rows, errors } = parseStatementRows(
      [
        { Date: 'sometime', Description: 'X', Amount: '1.00' },
        { Date: '2026-08-13', Description: '', Amount: '1.00' },
        { Date: '2026-08-13', Description: 'Y', Amount: 'n/a' },
        { Date: '2026-08-13', Description: 'Z', Amount: '0.00' },
      ],
      mapping
    )
    expect(rows).toHaveLength(0)
    expect(errors.map((e) => e.reason)).toEqual([
      'Could not read the date',
      'No description',
      'Could not read the amount',
      'Amount is zero',
    ])
    expect(errors[0].lineNumber).toBe(2)
  })

  it('combines a debit/credit pair into one signed amount', () => {
    const { rows } = parseStatementRows(
      [
        { Date: '2026-08-13', Description: 'Deposit', Withdrawals: '', Deposits: '500.00' },
        { Date: '2026-08-14', Description: 'Fuel', Withdrawals: '42.10', Deposits: '' },
      ],
      { date: 'Date', description: 'Description', debit: 'Withdrawals', credit: 'Deposits' }
    )
    expect(rows[0].amountCents).toBe(50000)
    expect(rows[1].amountCents).toBe(-4210)
  })

  it('treats a debit as money out even when the bank exports it unsigned', () => {
    const { rows } = parseStatementRows(
      [{ Date: '2026-08-13', Description: 'Fuel', Withdrawals: '42.10' }],
      { date: 'Date', description: 'Description', debit: 'Withdrawals' }
    )
    expect(rows[0].amountCents).toBe(-4210)
  })

  it('prefers an unambiguous debit/credit pair over a lone signed column', () => {
    // A bare `Amount` column's sign convention varies by bank; a pair does not.
    const { rows } = parseStatementRows(
      [{ Date: '2026-08-13', Description: 'Fuel', Amount: '42.10', Withdrawals: '42.10' }],
      { date: 'Date', description: 'Description', amount: 'Amount', debit: 'Withdrawals' }
    )
    expect(rows[0].amountCents).toBe(-4210)
  })
})

describe('statementRowHash', () => {
  it('is stable for the same line, so a re-uploaded overlap is recognised', () => {
    expect(statementRowHash(parsedRow(), 'Chase')).toBe(statementRowHash(parsedRow(), 'Chase'))
  })

  it('ignores whitespace and case differences between exports of the same transaction', () => {
    expect(statementRowHash(parsedRow({ description: '  shell   oil 574123 ' }), 'Chase')).toBe(
      statementRowHash(parsedRow({ description: 'SHELL OIL 574123' }), 'Chase')
    )
  })

  it('distinguishes the same amount on the same day on two different accounts', () => {
    expect(statementRowHash(parsedRow(), 'Chase')).not.toBe(
      statementRowHash(parsedRow(), 'Amex')
    )
  })

  it('changes with the amount and the date', () => {
    expect(statementRowHash(parsedRow({ amountCents: -4211 }), 'Chase')).not.toBe(
      statementRowHash(parsedRow(), 'Chase')
    )
    expect(statementRowHash(parsedRow({ date: day('2026-08-14') }), 'Chase')).not.toBe(
      statementRowHash(parsedRow(), 'Chase')
    )
  })
})

describe('suggestCategory', () => {
  it('recognises common vendors', () => {
    expect(suggestCategory('SHELL OIL 574123', -4210)).toBe('TRAVEL')
    expect(suggestCategory('USPS PO 4312', -1875)).toBe('SHIPPING_COST')
    expect(suggestCategory('STRIPE PROCESSING FEE', -320)).toBe('PROCESSOR_FEES')
    expect(suggestCategory('OFFICE DEPOT #22', -6499)).toBe('SUPPLIES')
    expect(suggestCategory('GUSTO PAYROLL', -240000)).toBe('PAYROLL')
    expect(suggestCategory('MUSKINGUM COUNTY FAIR BOOTH', -15000)).toBe('BOOTH_FEE')
  })

  it('falls back to a plain bucket rather than a plausible-looking guess', () => {
    expect(suggestCategory('ACH DEBIT 8829301', -5000)).toBe('OTHER_EXPENSE')
    expect(suggestCategory('DEPOSIT', 5000)).toBe('OTHER_INCOME')
  })

  it('always suggests a category on the side the money actually moved', () => {
    for (const description of ['SHELL OIL', 'random thing', 'USPS', 'DEPOSIT']) {
      expect(categoryMatchesDirection(suggestCategory(description, 1000), 1000)).toBe(true)
      expect(categoryMatchesDirection(suggestCategory(description, -1000), -1000)).toBe(true)
    }
  })
})

describe('reviewStatementRows', () => {
  const base = { accountLabel: 'Chase', existingLedger: [] }

  it('lets through a genuine new expense', () => {
    const [row] = reviewStatementRows({ ...base, rows: [parsedRow()] })
    expect(row.excludedReason).toBeNull()
    expect(row.suggestedCategory).toBe('TRAVEL')
  })

  it('excludes a line whose money the ledger already holds', () => {
    // The whole point of Stage 3: a statement is mostly money already recorded from orders.
    const [row] = reviewStatementRows({
      ...base,
      rows: [parsedRow({ description: 'CARD DEPOSIT', amountCents: 5400 })],
      existingLedger: [{ date: day('2026-08-13'), amountCents: 5400 }],
    })
    expect(row.excludedReason).toBe('ledger-match')
    expect(row.excludedNote).toContain('$54.00')
  })

  it('matches across the settlement lag, since a deposit lands days after the sale', () => {
    const [row] = reviewStatementRows({
      ...base,
      rows: [parsedRow({ description: 'CARD DEPOSIT', amountCents: 5400, date: day('2026-08-16') })],
      existingLedger: [{ date: day('2026-08-13'), amountCents: 5400 }],
    })
    expect(row.excludedReason).toBe('ledger-match')
  })

  it('does not match beyond the window, where a same-amount row is probably a different sale', () => {
    const outside = new Date(day('2026-08-13').getTime() + (MATCH_WINDOW_DAYS + 1) * 86_400_000)
    const [row] = reviewStatementRows({
      ...base,
      rows: [parsedRow({ description: 'CARD DEPOSIT', amountCents: 5400, date: outside })],
      existingLedger: [{ date: day('2026-08-13'), amountCents: 5400 }],
    })
    expect(row.excludedReason).toBeNull()
  })

  it('matches a ledger row regardless of which sign each side carries', () => {
    const [row] = reviewStatementRows({
      ...base,
      rows: [parsedRow({ description: 'REFUND ISSUED', amountCents: -1200 })],
      existingLedger: [{ date: day('2026-08-13'), amountCents: 1200 }],
    })
    expect(row.excludedReason).toBe('ledger-match')
  })

  it('excludes a processor payout on its description, since no single row can match it', () => {
    // A Stripe payout is many orders netted together; matching it by amount is impossible, so
    // passing it through because nothing matched would double every online sale it contains.
    const [row] = reviewStatementRows({
      ...base,
      rows: [parsedRow({ description: 'STRIPE TRANSFER ST-9931', amountCents: 61240 })],
    })
    expect(row.excludedReason).toBe('processor-payout')
    expect(row.excludedNote).toContain('twice')
  })

  it('does not treat a processor fee going out as a payout coming in', () => {
    const [row] = reviewStatementRows({
      ...base,
      rows: [parsedRow({ description: 'STRIPE FEE', amountCents: -320 })],
    })
    expect(row.excludedReason).toBeNull()
    expect(row.suggestedCategory).toBe('PROCESSOR_FEES')
  })

  it('flags a line imported before, so a re-uploaded overlap is visible', () => {
    const hash = statementRowHash(parsedRow(), 'Chase')
    const [row] = reviewStatementRows({
      ...base,
      rows: [parsedRow()],
      importedHashes: new Set([hash]),
    })
    expect(row.alreadyImported).toBe(true)
  })
})

describe('categoryMatchesDirection', () => {
  it('refuses a withdrawal filed under an income category', () => {
    expect(categoryMatchesDirection('PRODUCT_SALES', -5000)).toBe(false)
    expect(categoryMatchesDirection('SUPPLIES', 5000)).toBe(false)
  })

  it('accepts a correctly-sided category', () => {
    expect(categoryMatchesDirection('PRODUCT_SALES', 5000)).toBe(true)
    expect(categoryMatchesDirection('SUPPLIES', -5000)).toBe(true)
  })
})
