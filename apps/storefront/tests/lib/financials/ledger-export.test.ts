import { describe, expect, it } from 'vitest'

import {
  DEFAULT_ACCOUNT_MAP,
  IS_CASH_MOVEMENT,
  centsToAmountString,
  exportFilename,
  nonCashCategories,
  renderLedgerExport,
  resolveAccountMap,
  toDetailCsv,
  toExportDate,
  toQboBankCsv,
  toQboJournalCsv,
  type ExportableEntry,
} from '@/lib/financials/ledger-export'
import { CATEGORY_DIRECTION, LEDGER_CATEGORY_VALUES } from '@/lib/financials/ledger'

import type { LedgerCategory } from '@prisma/client'

function entry(over: Partial<ExportableEntry> = {}): ExportableEntry {
  return {
    id: 'led_1',
    date: new Date('2026-08-13T00:00:00.000Z'),
    direction: 'INCOME',
    amountCents: 5400,
    category: 'PRODUCT_SALES',
    source: 'ORDER',
    sourceId: 'ord_1',
    description: 'Order JMS-1001 — product sales',
    counterparty: 'Jane Buyer',
    channel: 'WEBSITE',
    paymentMethod: 'card',
    memo: null,
    isManual: false,
    exportedAt: null,
    ...over,
  }
}

/** Split CSV text into rows of cells, undoing the doubled-quote escaping `toCsv` applies. */
function rows(csv: string): string[][] {
  return csv.split('\r\n').map((line) => {
    const cells: string[] = []
    let cell = ''
    let inQuotes = false
    for (let i = 0; i < line.length; i++) {
      const char = line[i]
      if (char === '"') {
        if (inQuotes && line[i + 1] === '"') {
          cell += '"'
          i++
        } else {
          inQuotes = !inQuotes
        }
      } else if (char === ',' && !inQuotes) {
        cells.push(cell)
        cell = ''
      } else {
        cell += char
      }
    }
    cells.push(cell)
    return cells
  })
}

describe('centsToAmountString', () => {
  it('renders whole cents with two decimals and no separators', () => {
    expect(centsToAmountString(5400)).toBe('54.00')
    expect(centsToAmountString(7)).toBe('0.07')
    expect(centsToAmountString(123456789)).toBe('1234567.89')
  })

  it('treats a non-finite amount as zero rather than emitting NaN into a books import', () => {
    expect(centsToAmountString(Number.NaN)).toBe('0.00')
  })
})

describe('toExportDate', () => {
  it('formats US-style from UTC', () => {
    expect(toExportDate(new Date('2026-01-05T00:00:00.000Z'))).toBe('01/05/2026')
  })

  it('does not shift a midnight-UTC date backwards', () => {
    // The ledger writes accounting dates at UTC midnight. Reading one back with local getters
    // moves a 1 January sale into December — and so into the previous tax year — anywhere west
    // of Greenwich. This assertion catches that whenever the suite runs in a negative-offset
    // zone, which covers every machine and CI runner this project uses.
    expect(toExportDate(new Date('2026-01-01T00:00:00.000Z'))).toBe('01/01/2026')
  })
})

describe('resolveAccountMap', () => {
  it('returns the defaults when nothing is overridden', () => {
    expect(resolveAccountMap(null)).toEqual(DEFAULT_ACCOUNT_MAP)
  })

  it('applies a partial override without disturbing the other side or other categories', () => {
    const map = resolveAccountMap({ PRODUCT_SALES: { account: 'Salsa Sales' } })
    expect(map.PRODUCT_SALES.account).toBe('Salsa Sales')
    expect(map.PRODUCT_SALES.offset).toBe(DEFAULT_ACCOUNT_MAP.PRODUCT_SALES.offset)
    expect(map.COGS).toEqual(DEFAULT_ACCOUNT_MAP.COGS)
  })

  it('falls back to the default for a blank override rather than emitting a nameless account', () => {
    const map = resolveAccountMap({ TRAVEL: { account: '   ' } })
    expect(map.TRAVEL.account).toBe(DEFAULT_ACCOUNT_MAP.TRAVEL.account)
  })

  it('covers every category, so no ledger row can reach an export unmapped', () => {
    const map = resolveAccountMap()
    for (const category of LEDGER_CATEGORY_VALUES) {
      expect(map[category].account.length).toBeGreaterThan(0)
      expect(map[category].offset.length).toBeGreaterThan(0)
    }
  })
})

describe('account defaults', () => {
  it('books collected sales tax to a liability, not to income', () => {
    // Sales tax arrives as cash, so the ledger files it INCOME — but it is owed to the state.
    // Crediting a revenue account would overstate revenue by every dollar of tax ever collected.
    expect(CATEGORY_DIRECTION.SALES_TAX_COLLECTED).toBe('INCOME')
    expect(DEFAULT_ACCOUNT_MAP.SALES_TAX_COLLECTED.account).toBe('Sales Tax Payable')
  })

  it('offsets cost of goods against inventory rather than cash', () => {
    // The cash for that stock left when the ingredients were bought. Crediting cash here would
    // count the same payment twice.
    expect(DEFAULT_ACCOUNT_MAP.COGS.offset).toBe('Inventory Asset')
  })
})

describe('toDetailCsv', () => {
  it('emits a header and one row per entry', () => {
    const csv = rows(toDetailCsv([entry(), entry({ id: 'led_2', category: 'COGS', direction: 'EXPENSE' })]))
    expect(csv[0][0]).toBe('Date')
    expect(csv).toHaveLength(3)
    expect(csv[1][0]).toBe('2026-08-13')
    expect(csv[1][3]).toBe('54.00')
  })

  it('escapes a value containing a comma or a quote so the file still parses', () => {
    const csv = toDetailCsv([entry({ description: 'Order "1001", partial', counterparty: null })])
    expect(rows(csv)[1][4]).toBe('Order "1001", partial')
  })
})

describe('toQboBankCsv', () => {
  it('puts money in under Credit and money out under Debit', () => {
    const csv = rows(
      toQboBankCsv([
        entry({ category: 'PRODUCT_SALES', amountCents: 5400 }),
        entry({ id: 'led_2', category: 'REFUNDS', direction: 'EXPENSE', amountCents: 1200 }),
      ])
    )
    expect(csv[0]).toEqual(['Date', 'Description', 'Credit', 'Debit'])
    expect(csv[1][2]).toBe('54.00')
    expect(csv[1][3]).toBe('')
    expect(csv[2][2]).toBe('')
    expect(csv[2][3]).toBe('12.00')
  })

  it('omits rows that moved no cash, so an upload cannot invent bank transactions', () => {
    const csv = rows(
      toQboBankCsv([
        entry({ category: 'COGS', direction: 'EXPENSE', amountCents: 2000 }),
        entry({ id: 'led_2', category: 'DISCOUNTS', direction: 'EXPENSE', amountCents: 500 }),
        entry({ id: 'led_3', category: 'PRODUCT_SALES', amountCents: 5400 }),
      ])
    )
    expect(csv).toHaveLength(2)
    expect(csv[1][2]).toBe('54.00')
  })

  it('classifies every category as cash-moving or not, so a new one cannot slip through undecided', () => {
    for (const category of LEDGER_CATEGORY_VALUES) {
      expect(typeof IS_CASH_MOVEMENT[category as LedgerCategory]).toBe('boolean')
    }
  })
})

describe('toQboJournalCsv', () => {
  it('writes a balanced debit and credit pair per entry, sharing one journal number', () => {
    const csv = rows(toQboJournalCsv([entry({ amountCents: 5400 })]))
    expect(csv[0][0]).toBe('Journal No')
    expect(csv).toHaveLength(3)

    const [debit, credit] = [csv[1], csv[2]]
    expect(debit[0]).toBe('led_1')
    expect(credit[0]).toBe('led_1')
    // Money in: cash is debited, the revenue account credited.
    expect(debit[3]).toBe('Undeposited Funds')
    expect(debit[4]).toBe('54.00')
    expect(debit[5]).toBe('')
    expect(credit[3]).toBe('Sales of Product Income')
    expect(credit[4]).toBe('')
    expect(credit[5]).toBe('54.00')
  })

  it('reverses the sides for money out', () => {
    const csv = rows(
      toQboJournalCsv([entry({ category: 'SUPPLIES', direction: 'EXPENSE', amountCents: 3125 })])
    )
    expect(csv[1][3]).toBe('Office Supplies & Software')
    expect(csv[1][4]).toBe('31.25')
    expect(csv[2][3]).toBe('Undeposited Funds')
    expect(csv[2][5]).toBe('31.25')
  })

  it('balances: total debits equal total credits across a mixed set', () => {
    const mixed = LEDGER_CATEGORY_VALUES.map((category, i) =>
      entry({
        id: `led_${i}`,
        category: category as LedgerCategory,
        direction: CATEGORY_DIRECTION[category as LedgerCategory],
        amountCents: 100 * (i + 1),
      })
    )
    const parsed = rows(toQboJournalCsv(mixed)).slice(1)
    const sum = (index: number) =>
      parsed.reduce((total, row) => total + Number(row[index] || 0), 0)
    expect(sum(4)).toBeCloseTo(sum(5), 2)
  })

  it('uses the supplied account map over the defaults', () => {
    const csv = rows(
      toQboJournalCsv([entry()], { accounts: resolveAccountMap({ PRODUCT_SALES: { account: 'Salsa Sales' } }) })
    )
    expect(csv[2][3]).toBe('Salsa Sales')
  })
})

describe('nonCashCategories', () => {
  it('reports the categories a bank upload would drop, deduplicated', () => {
    const found = nonCashCategories([
      entry({ category: 'COGS' }),
      entry({ id: 'led_2', category: 'COGS' }),
      entry({ id: 'led_3', category: 'PRODUCT_SALES' }),
    ])
    expect(found).toEqual(['COGS'])
  })
})

describe('renderLedgerExport', () => {
  it('dispatches on the format', () => {
    const one = [entry()]
    expect(renderLedgerExport('detail', one)).toBe(toDetailCsv(one))
    expect(renderLedgerExport('qbo-bank', one)).toBe(toQboBankCsv(one))
    expect(renderLedgerExport('qbo-journal', one)).toBe(toQboJournalCsv(one))
  })
})

describe('exportFilename', () => {
  it('names the file after the format and the day', () => {
    expect(exportFilename('qbo-journal', new Date('2026-08-15T09:00:00.000Z'))).toBe(
      'jose-madrid-ledger-qbo-journal-2026-08-15.csv'
    )
  })
})
