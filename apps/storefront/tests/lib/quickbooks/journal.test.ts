import { describe, expect, it } from 'vitest'

import {
  JOURNAL_SYNC_SOURCES,
  buildJournalEntry,
  isJournalSyncable,
  journalDocNumber,
  toJournalDate,
  type LedgerRowForJournal,
} from '@/lib/quickbooks/journal'
import type { LedgerAccountMapSetting } from '@/lib/quickbooks/ledger-accounts'
import { LEDGER_CATEGORY_VALUES } from '@/lib/financials/ledger'

import type { LedgerCategory } from '@prisma/client'

const accounts: LedgerAccountMapSetting = {
  SHOW_SALES: { accountId: '41', accountName: 'Sales of Product Income', offsetId: '4', offsetName: 'Cash on hand' },
  SUPPLIES: { accountId: '63', accountName: 'Office Supplies', offsetId: '35', offsetName: 'Checking' },
  SALES_TAX_COLLECTED: { accountId: '90', accountName: 'Sales Tax Payable', offsetId: '4', offsetName: 'Cash on hand' },
}

function row(over: Partial<LedgerRowForJournal> = {}): LedgerRowForJournal {
  return {
    id: 'clx9a8b7c6d5e4f3g2h1i0jkl',
    date: new Date('2026-08-13T00:00:00.000Z'),
    amountCents: 24500,
    category: 'SHOW_SALES',
    source: 'SHOW_ARCHIVE',
    description: 'Zanesville Festival — show sales',
    counterparty: 'Mike',
    memo: null,
    ...over,
  }
}

describe('isJournalSyncable', () => {
  it('accepts money that never became an order', () => {
    expect(isJournalSyncable('SHOW_ARCHIVE')).toBe(true)
    expect(isJournalSyncable('MANUAL')).toBe(true)
    expect(isJournalSyncable('IMPORT')).toBe(true)
    expect(isJournalSyncable('FUNDRAISER')).toBe(true)
  })

  it('refuses orders and refunds, which already reach QuickBooks as receipts', () => {
    expect(isJournalSyncable('ORDER')).toBe(false)
    expect(isJournalSyncable('REFUND')).toBe(false)
  })

  it('keeps the allowlist frozen so a stray push cannot widen it at runtime', () => {
    expect(Object.isFrozen(JOURNAL_SYNC_SOURCES)).toBe(true)
  })
})

describe('journalDocNumber', () => {
  it('fits QuickBooks’ 21-character limit', () => {
    expect(journalDocNumber('clx9a8b7c6d5e4f3g2h1i0jkl').length).toBeLessThanOrEqual(21)
  })

  it('keeps the distinguishing tail of a cuid, not the shared timestamp head', () => {
    // Two rows created in the same millisecond share a cuid prefix. Truncating from the front
    // would give them the same document number and make the duplicate guard adopt the wrong entry.
    const a = journalDocNumber('clx9a8b7c000000000aaaaaaa')
    const b = journalDocNumber('clx9a8b7c000000000bbbbbbb')
    expect(a).not.toBe(b)
  })

  it('is stable for the same id, which is what makes the duplicate guard work', () => {
    expect(journalDocNumber('clx9a8b7c6d5e4f3g2h1i0jkl')).toBe(
      journalDocNumber('clx9a8b7c6d5e4f3g2h1i0jkl')
    )
  })
})

describe('toJournalDate', () => {
  it('reads the calendar date in UTC', () => {
    expect(toJournalDate(new Date('2026-01-01T00:00:00.000Z'))).toBe('2026-01-01')
  })
})

describe('buildJournalEntry', () => {
  it('debits cash and credits revenue for money in', () => {
    const result = buildJournalEntry({ entry: row(), accounts })
    expect(result.ok).toBe(true)
    if (!result.ok) return

    expect(result.payload.TxnDate).toBe('2026-08-13')
    expect(result.payload.Line).toHaveLength(2)

    const [debit, credit] = result.payload.Line
    expect(debit.JournalEntryLineDetail.PostingType).toBe('Debit')
    expect(debit.JournalEntryLineDetail.AccountRef.value).toBe('4') // cash on hand
    expect(debit.Amount).toBe(245)
    expect(credit.JournalEntryLineDetail.PostingType).toBe('Credit')
    expect(credit.JournalEntryLineDetail.AccountRef.value).toBe('41') // income
    expect(credit.Amount).toBe(245)
  })

  it('debits the expense and credits cash for money out', () => {
    const result = buildJournalEntry({
      entry: row({ category: 'SUPPLIES', source: 'MANUAL', amountCents: 3125 }),
      accounts,
    })
    expect(result.ok).toBe(true)
    if (!result.ok) return

    const [debit, credit] = result.payload.Line
    expect(debit.JournalEntryLineDetail.AccountRef.value).toBe('63')
    expect(credit.JournalEntryLineDetail.AccountRef.value).toBe('35')
    expect(debit.Amount).toBe(31.25)
  })

  it('credits collected sales tax to the mapped liability, not to income', () => {
    const result = buildJournalEntry({
      entry: row({ category: 'SALES_TAX_COLLECTED', source: 'MANUAL', amountCents: 432 }),
      accounts,
    })
    expect(result.ok).toBe(true)
    if (!result.ok) return
    expect(result.payload.Line[1].JournalEntryLineDetail.AccountRef.value).toBe('90')
  })

  it('always balances — the two lines carry the same amount on opposite sides', () => {
    const result = buildJournalEntry({ entry: row({ amountCents: 99 }), accounts })
    expect(result.ok).toBe(true)
    if (!result.ok) return
    const [debit, credit] = result.payload.Line
    expect(debit.Amount).toBe(credit.Amount)
    expect(debit.JournalEntryLineDetail.PostingType).not.toBe(
      credit.JournalEntryLineDetail.PostingType
    )
  })

  it('refuses an order row rather than booking the sale a second time', () => {
    const result = buildJournalEntry({ entry: row({ source: 'ORDER' }), accounts })
    expect(result.ok).toBe(false)
    if (result.ok) return
    expect(result.reason).toMatch(/double-count/i)
  })

  it('refuses a refund row for the same reason', () => {
    const result = buildJournalEntry({ entry: row({ source: 'REFUND' }), accounts })
    expect(result.ok).toBe(false)
  })

  it('blocks rather than guessing when the category has no account mapped', () => {
    const result = buildJournalEntry({ entry: row({ category: 'TRAVEL', source: 'MANUAL' }), accounts })
    expect(result.ok).toBe(false)
    if (result.ok) return
    expect(result.reason).toMatch(/no quickbooks account mapped for travel/i)
  })

  it('blocks when only the offset side is missing, and says which side', () => {
    const result = buildJournalEntry({
      entry: row({ category: 'MEALS', source: 'MANUAL' }),
      accounts: { ...accounts, MEALS: { accountId: '70' } },
    })
    expect(result.ok).toBe(false)
    if (result.ok) return
    expect(result.reason).toMatch(/offset account/i)
  })

  it('refuses a zero or negative amount', () => {
    expect(buildJournalEntry({ entry: row({ amountCents: 0 }), accounts }).ok).toBe(false)
    expect(buildJournalEntry({ entry: row({ amountCents: -100 }), accounts }).ok).toBe(false)
  })

  it('carries the ledger id in the private note so a line can be traced back', () => {
    const result = buildJournalEntry({ entry: row(), accounts })
    expect(result.ok).toBe(true)
    if (!result.ok) return
    expect(result.payload.PrivateNote).toContain('clx9a8b7c6d5e4f3g2h1i0jkl')
  })

  it('handles every category once mapped, so no category is structurally unpostable', () => {
    const full: LedgerAccountMapSetting = {}
    for (const category of LEDGER_CATEGORY_VALUES) {
      full[category as LedgerCategory] = { accountId: '1', offsetId: '2' }
    }
    for (const category of LEDGER_CATEGORY_VALUES) {
      const result = buildJournalEntry({
        entry: row({ category: category as LedgerCategory, source: 'MANUAL' }),
        accounts: full,
      })
      expect(result.ok, `${category} should map`).toBe(true)
    }
  })
})
