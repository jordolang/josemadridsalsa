import { describe, expect, it } from 'vitest'
import {
  canonicalizePerson,
  normalizeShowSaleRow,
  normalizeShowSales,
  parseMoney,
  parseShowDate,
  type RawShowSale,
} from '@/lib/archive/show-sales-normalize'

function raw(o: Partial<RawShowSale> = {}): RawShowSale {
  return {
    sourceFile: '04 Shows & Events/2025/2025 Show Sales.xlsx',
    sourceMd5: 'm',
    sourceRow: 3,
    year: 2025,
    eventType: 'SHOW',
    showName: 'Novi',
    dateText: null,
    dateIso: null,
    sales: 1991,
    person: 'Mike',
    ...o,
  }
}

describe('parseShowDate', () => {
  it('prefers a real date cell', () => {
    expect(parseShowDate('2021-01-16T00:00:00', null)).toBe('2021-01-16')
  })
  it('takes the start day of a range', () => {
    expect(parseShowDate(null, '1/3-5/2025')).toBe('2025-01-03')
    expect(parseShowDate(null, '1/25-27/2025')).toBe('2025-01-25')
  })
  it('handles a single text date', () => {
    expect(parseShowDate(null, '1/12/2025')).toBe('2025-01-12')
  })
  it('returns null for an unparseable cell', () => {
    expect(parseShowDate(null, 'TBD')).toBeNull()
    expect(parseShowDate(null, null)).toBeNull()
  })
})

describe('parseMoney', () => {
  it('parses numbers and currency strings', () => {
    expect(parseMoney(1053)).toBe(1053)
    expect(parseMoney('$3,263')).toBe(3263)
    expect(parseMoney('')).toBeNull()
  })
})

describe('canonicalizePerson', () => {
  it('canonicalizes single names and drops a trailing initial', () => {
    expect(canonicalizePerson('Deb')).toBe('Debbie')
    expect(canonicalizePerson('Stan L ')).toBe('Stan')
    expect(canonicalizePerson('mike')).toBe('Mike')
  })
  it('keeps a compound crew name', () => {
    expect(canonicalizePerson('Matt/Stan')).toBe('Matt/Stan')
  })
})

describe('normalizeShowSaleRow', () => {
  it('normalizes a show row', () => {
    const n = normalizeShowSaleRow(raw({ dateText: '1/17-19/2025', sales: 1991 }))!
    expect(n.showName).toBe('Novi')
    expect(n.showDate).toBe('2025-01-17')
    expect(n.eventType).toBe('SHOW')
    expect(n.sales).toBe(1991)
    expect(n.dateText).toBe('1/17-19/2025')
  })

  it('normalizes a farmers-market row with paid/expenses', () => {
    const n = normalizeShowSaleRow(
      raw({
        eventType: 'FARMERS_MARKET',
        showName: 'Newark',
        dateIso: '2025-05-02T00:00:00',
        sales: 263,
        amountPaid: 325,
        expenses: 340,
        person: 'Deb',
      })
    )!
    expect(n.eventType).toBe('FARMERS_MARKET')
    expect(n.showDate).toBe('2025-05-02')
    expect(n.amountPaid).toBe(325)
    expect(n.expenses).toBe(340)
    expect(n.salesPerson).toBe('Debbie')
    expect(n.dateText).toBeNull() // real date -> no raw text kept
  })

  it('drops a row with no show name', () => {
    expect(normalizeShowSaleRow(raw({ showName: '   ' }))).toBeNull()
  })
})

describe('normalizeShowSales', () => {
  it('dedupes the same event across the two 2021 sheets', () => {
    const a = raw({
      sourceFile: '04 Shows & Events/2021/2021 Show sales.xlsx',
      year: 2021,
      showName: 'Toledo Art Show',
      dateIso: '2021-03-20T00:00:00',
      sales: 999,
    })
    const b = { ...a, sourceFile: '04 Shows & Events/2021/Show sales.xlsx', sourceRow: 9 }
    const { entries, duplicatesDropped } = normalizeShowSales([a, b])
    expect(entries).toHaveLength(1)
    expect(duplicatesDropped).toBe(1)
  })

  it('keeps two genuinely different shows on the same day', () => {
    const a = raw({ showName: 'Novi', sales: 1991 })
    const b = raw({ showName: 'Sharonville', sales: 3263 })
    expect(normalizeShowSales([a, b]).entries).toHaveLength(2)
  })
})
