import { describe, it, expect, vi, beforeEach } from 'vitest'

const { quickBooksFetch } = vi.hoisted(() => ({ quickBooksFetch: vi.fn() }))

vi.mock('@/lib/quickbooks/client', () => ({ quickBooksFetch }))

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

describe('expenses and vendors', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  it('maps purchases and bills, marking bills with a balance unpaid', async () => {
    quickBooksFetch
      .mockResolvedValueOnce({
        QueryResponse: {
          Purchase: [
            {
              Id: '10',
              TxnDate: '2026-07-10',
              TotalAmt: '240.00',
              PaymentType: 'CreditCard',
              EntityRef: { name: 'Restaurant Depot' },
              AccountRef: { name: 'Supplies' },
            },
          ],
        },
      })
      .mockResolvedValueOnce({
        QueryResponse: {
          Bill: [
            {
              Id: '20',
              TxnDate: '2026-07-18',
              DueDate: '2026-08-17',
              TotalAmt: '1250.00',
              Balance: '1250.00',
              VendorRef: { name: 'Glass Supplier' },
            },
            {
              Id: '21',
              TxnDate: '2026-07-05',
              TotalAmt: '400.00',
              Balance: '0',
              VendorRef: { name: 'Label Printer' },
            },
          ],
        },
      })

    const { listAllExpenses } = await import('@/lib/quickbooks/reports')
    const rows = await listAllExpenses(25)

    // Newest first, purchases and bills interleaved by date.
    expect(rows.map((r) => r.id)).toEqual(['20', '10', '21'])

    const unpaidBill = rows.find((r) => r.id === '20')!
    expect(unpaidBill.kind).toBe('bill')
    expect(unpaidBill.paymentType).toBe('Unpaid')
    expect(unpaidBill.balance).toBe(1250)
    expect(unpaidBill.dueDate).toBe('2026-08-17')

    const settledBill = rows.find((r) => r.id === '21')!
    expect(settledBill.paymentType).toBe('Paid')

    const purchase = rows.find((r) => r.id === '10')!
    expect(purchase.kind).toBe('purchase')
    expect(purchase.vendor).toBe('Restaurant Depot')
    expect(purchase.total).toBe(240)
  })

  it('still returns purchases when the bill query fails', async () => {
    quickBooksFetch
      .mockResolvedValueOnce({
        QueryResponse: { Purchase: [{ Id: '10', TxnDate: '2026-07-10', TotalAmt: '240.00' }] },
      })
      .mockRejectedValueOnce(new Error('Bill entity unavailable'))

    const { listAllExpenses } = await import('@/lib/quickbooks/reports')
    const rows = await listAllExpenses(25)

    expect(rows).toHaveLength(1)
    expect(rows[0].id).toBe('10')
  })

  it('sums vendor balances and tolerates missing fields', async () => {
    quickBooksFetch.mockResolvedValueOnce({
      QueryResponse: {
        Vendor: [
          { Id: '1', DisplayName: 'Glass Supplier', Balance: '1250.00' },
          { Id: '2', Balance: '' },
        ],
      },
    })

    const { listVendors } = await import('@/lib/quickbooks/reports')
    const vendors = await listVendors()

    expect(vendors[0]).toEqual({
      id: '1',
      name: 'Glass Supplier',
      email: null,
      balance: 1250,
    })
    expect(vendors[1].name).toBe('Unnamed vendor')
    expect(vendors[1].balance).toBe(0)
  })
})
