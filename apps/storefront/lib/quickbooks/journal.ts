/**
 * Pure mapping from a bookkeeping-ledger row to a QuickBooks Online JournalEntry.
 *
 * **Why a journal entry and not a sales receipt.** `syncOrder` already posts every website order
 * as a SalesReceipt, with a customer and item lines, because an order has all of that. The money
 * this module handles does not: a festival's cash takings from 2019, a hand-entered fuel receipt,
 * a row read off a bank statement. There is no customer and no line detail to invent, and a
 * two-sided journal entry is the honest shape for "this much money moved, between these two
 * accounts".
 *
 * **The rule that keeps the books from double-counting.** Ledger rows derived from an order or a
 * refund are *already* in QuickBooks as receipts. Posting them again here would book every online
 * sale twice. `isJournalSyncable` is that boundary, and it is expressed as an allowlist of sources
 * so a new source has to be considered rather than silently included.
 *
 * Kept free of Prisma and `fetch` so the arithmetic and the debit/credit sides — the parts that
 * misstate a set of books quietly — are testable on their own.
 */
import type { LedgerCategory, LedgerSource } from '@prisma/client'

import { CATEGORY_DIRECTION } from '@/lib/financials/ledger'

import { round2 } from './mappers'
import type { QboRef } from './mappers'
import { resolveAccountIds, type LedgerAccountMapSetting } from './ledger-accounts'

/**
 * Ledger sources this sync is responsible for — everything whose money did **not** arrive through
 * an order or refund, and so is not already in the books as a receipt.
 */
export const JOURNAL_SYNC_SOURCES: readonly LedgerSource[] = Object.freeze([
  'SHOW_ARCHIVE',
  'FUNDRAISER',
  'MANUAL',
  'IMPORT',
] as const)

/** Sources posted by `syncOrder`/`syncRefund` as receipts. Never journalled — see the file note. */
export function isJournalSyncable(source: LedgerSource): boolean {
  return JOURNAL_SYNC_SOURCES.includes(source)
}

export interface JournalEntryLine {
  DetailType: 'JournalEntryLineDetail'
  Amount: number
  Description?: string
  JournalEntryLineDetail: {
    PostingType: 'Debit' | 'Credit'
    AccountRef: QboRef
  }
}

export interface JournalEntryPayload {
  TxnDate: string
  DocNumber?: string
  PrivateNote?: string
  Line: JournalEntryLine[]
}

/** The ledger fields the mapping reads. */
export interface LedgerRowForJournal {
  id: string
  date: Date
  amountCents: number
  category: LedgerCategory
  source: LedgerSource
  description: string
  counterparty: string | null
  memo: string | null
}

export type JournalMappingResult =
  | { ok: true; payload: JournalEntryPayload }
  /** A condition no retry can fix — an unmapped account, a zero amount, a row that belongs to a
   *  receipt. Surfaced as BLOCKED so a person decides, rather than posted at a guess. */
  | { ok: false; reason: string }

/** QBO rejects a DocNumber longer than 21 characters. */
const MAX_DOC_NUMBER = 21

/**
 * A deterministic document number for a ledger row, used to spot an entry that was created in
 * QuickBooks just before the crash that lost our record of it.
 *
 * The id is a cuid (25 characters) so it has to be trimmed. The **tail** is kept rather than the
 * head: a cuid begins with a timestamp that every row created in the same millisecond shares, and
 * ends with the counter and random block that actually distinguish them.
 */
export function journalDocNumber(ledgerEntryId: string): string {
  return `L-${ledgerEntryId.slice(-(MAX_DOC_NUMBER - 2))}`
}

/**
 * Build the JournalEntry for one ledger row.
 *
 * The sides follow the direction of the money, exactly as the journal CSV export does:
 *
 * - money **in** debits the cash/clearing account and credits the category — revenue, or in the
 *   case of collected sales tax, the liability owed to the state;
 * - money **out** debits the category — an expense, or a contra-income account like refunds — and
 *   credits cash.
 *
 * Both accounts must be mapped by id. There is no default: this posts to the live books with
 * nobody reviewing it first.
 */
export function buildJournalEntry(input: {
  entry: LedgerRowForJournal
  accounts: LedgerAccountMapSetting
}): JournalMappingResult {
  const { entry, accounts } = input

  if (!isJournalSyncable(entry.source)) {
    return {
      ok: false,
      reason: `${entry.source} rows reach QuickBooks as a sales or refund receipt; journalling one would double-count it`,
    }
  }

  const amount = round2(entry.amountCents / 100)
  if (!(amount > 0)) {
    return { ok: false, reason: 'Ledger entry amount is zero or negative' }
  }

  const resolved = resolveAccountIds(entry.category, accounts)
  if (!resolved.ok) {
    const side = resolved.missing === 'account' ? 'account' : 'offset account'
    return {
      ok: false,
      reason: `No QuickBooks ${side} mapped for ${entry.category}`,
    }
  }

  const isIn = CATEGORY_DIRECTION[entry.category] === 'INCOME'
  const debitAccountId = isIn ? resolved.offsetId : resolved.accountId
  const creditAccountId = isIn ? resolved.accountId : resolved.offsetId

  const line = (postingType: 'Debit' | 'Credit', accountId: string): JournalEntryLine => ({
    DetailType: 'JournalEntryLineDetail',
    Amount: amount,
    Description: entry.description.slice(0, 4000),
    JournalEntryLineDetail: {
      PostingType: postingType,
      AccountRef: { value: accountId },
    },
  })

  const noteParts = [`Ledger entry ${entry.id}`, entry.counterparty, entry.memo].filter(Boolean)

  return {
    ok: true,
    payload: {
      TxnDate: toJournalDate(entry.date),
      DocNumber: journalDocNumber(entry.id),
      PrivateNote: noteParts.join(' — ').slice(0, 4000),
      Line: [line('Debit', debitAccountId), line('Credit', creditAccountId)],
    },
  }
}

/**
 * `YYYY-MM-DD` read in UTC.
 *
 * Ledger dates are written at UTC midnight throughout the pipeline; formatting with the server's
 * local calendar would post a 1 January entry into the previous year for any server west of
 * Greenwich. `mappers.toTxnDate` uses local getters deliberately — an order's `createdAt` is a real
 * instant, and the receipt should carry the day the shop experienced. A ledger row's date is a
 * calendar date already, so it must not be re-interpreted.
 */
export function toJournalDate(date: Date): string {
  const pad = (n: number) => String(n).padStart(2, '0')
  return `${date.getUTCFullYear()}-${pad(date.getUTCMonth() + 1)}-${pad(date.getUTCDate())}`
}
