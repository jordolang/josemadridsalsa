import { describe, it, expect } from 'vitest'
import {
  parseProfitAndLoss,
  parseReportAmount,
  toReportDate,
} from '@/lib/quickbooks/reports'

/**
 * Shaped after a real QuickBooks ProfitAndLoss response: sections carry a
 * `group`, detail rows live under `Rows.Row` with `ColData`, and summary-only
 * rows like GrossProfit have a total but no children.
 */
const REPORT = {
  Header: {
    ReportName: 'ProfitAndLoss',
    StartPeriod: '2026-01-01',
    EndPeriod: '2026-07-22',
    Currency: 'USD',
  },
  Columns: {
    Column: [
      { ColTitle: '', ColType: 'Account' },
      { ColTitle: 'Total', ColType: 'Money' },
    ],
  },
  Rows: {
    Row: [
      {
        type: 'Section',
        group: 'Income',
        Header: { ColData: [{ value: 'Income' }, { value: '' }] },
        Rows: {
          Row: [
            {
              type: 'Data',
              ColData: [
                { value: 'Sales of Product Income', id: '79' },
                { value: '48250.75' },
              ],
            },
            {
              type: 'Data',
              ColData: [{ value: 'Shipping Income', id: '84' }, { value: '3120.00' }],
            },
          ],
        },
        Summary: { ColData: [{ value: 'Total Income' }, { value: '51370.75' }] },
      },
      {
        type: 'Section',
        group: 'COGS',
        Header: { ColData: [{ value: 'Cost of Goods Sold' }, { value: '' }] },
        Rows: {
          Row: [
            {
              type: 'Data',
              ColData: [{ value: 'Cost of Goods Sold', id: '80' }, { value: '19840.20' }],
            },
          ],
        },
        Summary: { ColData: [{ value: 'Total Cost of Goods Sold' }, { value: '19840.20' }] },
      },
      {
        type: 'Section',
        group: 'GrossProfit',
        Summary: { ColData: [{ value: 'Gross Profit' }, { value: '31530.55' }] },
      },
      {
        type: 'Section',
        group: 'Expenses',
        Header: { ColData: [{ value: 'Expenses' }, { value: '' }] },
        Rows: {
          Row: [
            {
              type: 'Data',
              ColData: [{ value: 'Advertising', id: '91' }, { value: '1250.00' }],
            },
            {
              // Nested subsection: children must flatten into the same section.
              type: 'Section',
              Header: { ColData: [{ value: 'Vehicle Expenses' }, { value: '' }] },
              Rows: {
                Row: [
                  {
                    type: 'Data',
                    ColData: [{ value: 'Fuel', id: '95' }, { value: '820.40' }],
                  },
                ],
              },
              Summary: { ColData: [{ value: 'Total Vehicle Expenses' }, { value: '820.40' }] },
            },
          ],
        },
        Summary: { ColData: [{ value: 'Total Expenses' }, { value: '2070.40' }] },
      },
      {
        type: 'Section',
        group: 'NetIncome',
        Summary: { ColData: [{ value: 'Net Income' }, { value: '29460.15' }] },
      },
    ],
  },
}

describe('parseReportAmount', () => {
  it('parses plain numeric strings', () => {
    expect(parseReportAmount('48250.75')).toBe(48250.75)
  })

  it('treats a blank value as zero', () => {
    expect(parseReportAmount('')).toBe(0)
    expect(parseReportAmount('   ')).toBe(0)
  })

  it('handles negatives and currency formatting', () => {
    expect(parseReportAmount('-500.00')).toBe(-500)
    expect(parseReportAmount('$1,250.00')).toBe(1250)
  })

  it('falls back to zero for junk rather than NaN', () => {
    expect(parseReportAmount('n/a')).toBe(0)
    expect(parseReportAmount(undefined)).toBe(0)
    expect(parseReportAmount(null)).toBe(0)
  })

  it('accepts a number directly', () => {
    expect(parseReportAmount(42.5)).toBe(42.5)
  })
})

describe('toReportDate', () => {
  it('formats a date-only string in local time', () => {
    expect(toReportDate(new Date(2026, 0, 5))).toBe('2026-01-05')
  })

  it('does not roll a late-evening date back a day', () => {
    expect(toReportDate(new Date(2026, 6, 22, 23, 30))).toBe('2026-07-22')
  })
})

describe('parseProfitAndLoss', () => {
  const parsed = parseProfitAndLoss(REPORT)

  it('reads the reporting period and currency from the header', () => {
    expect(parsed.startDate).toBe('2026-01-01')
    expect(parsed.endDate).toBe('2026-07-22')
    expect(parsed.currency).toBe('USD')
  })

  it('captures headline totals including summary-only rows', () => {
    expect(parsed.totals.Income).toBe(51370.75)
    expect(parsed.totals.COGS).toBe(19840.2)
    expect(parsed.totals.GrossProfit).toBe(31530.55)
    expect(parsed.totals.Expenses).toBe(2070.4)
    expect(parsed.totals.NetIncome).toBe(29460.15)
  })

  it('builds a section per detail group', () => {
    expect(parsed.sections.map((s) => s.group)).toEqual(['Income', 'COGS', 'Expenses'])
  })

  it('omits summary-only groups from sections while keeping their totals', () => {
    expect(parsed.sections.find((s) => s.group === 'GrossProfit')).toBeUndefined()
    expect(parsed.totals.GrossProfit).toBe(31530.55)
  })

  it('extracts line items with their account ids', () => {
    const income = parsed.sections.find((s) => s.group === 'Income')!
    expect(income.lines).toHaveLength(2)
    expect(income.lines[0]).toEqual({
      name: 'Sales of Product Income',
      accountId: '79',
      amount: 48250.75,
    })
  })

  it('flattens nested subsections into their parent section', () => {
    const expenses = parsed.sections.find((s) => s.group === 'Expenses')!
    const names = expenses.lines.map((l) => l.name)
    expect(names).toContain('Advertising')
    expect(names).toContain('Fuel')
  })

  it('survives an empty or unfamiliar report instead of throwing', () => {
    expect(parseProfitAndLoss({}).sections).toEqual([])
    expect(parseProfitAndLoss(null).totals).toEqual({})
    expect(parseProfitAndLoss({ Rows: { Row: [{ type: 'Data' }] } }).sections).toEqual([])
  })
})
