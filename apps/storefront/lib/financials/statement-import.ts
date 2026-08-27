/**
 * Reading a bank or card statement into the bookkeeping ledger.
 *
 * ## The problem this has to solve first
 *
 * A bank statement is not a list of new facts. Most of what is on it — every card deposit — is
 * money the ledger **already knows about**, recorded from the orders that produced it. Importing a
 * statement wholesale would book the same revenue a second time and silently double every figure
 * the ledger reports.
 *
 * So the importer is built around detection rather than ingestion. Every parsed row is matched
 * against what the ledger already holds and against the deposits a payment processor pays out in
 * batches, and anything that looks like money already recorded is **excluded by default**. The
 * person importing has to opt a suspected duplicate back in, not remember to opt it out.
 *
 * What is genuinely new on a statement — the fuel stop, the booth fee, the supplier payment, the
 * bank charge — is what this is for.
 *
 * ## What it deliberately does not do
 *
 * It does not reconcile batched deposits. When Stripe pays out eleven orders as one $612.40
 * deposit, no rule here can split that back into eleven ledger rows and claim it matched. Such a
 * row is flagged as a probable processor payout and excluded, with the reason stated, rather than
 * matched approximately and reported as reconciled.
 *
 * Kept pure — no Prisma, no `fetch` — so the matching rules can be tested exhaustively.
 */
import { createHash } from 'crypto'

import type { LedgerCategory } from '@prisma/client'

import { detectMapping, mappedCell } from '@/lib/csv'

import { CATEGORY_DIRECTION } from './ledger'

/** The columns a statement row can be read from. */
export type StatementField = 'date' | 'description' | 'amount' | 'debit' | 'credit'

/**
 * Header aliases across the statement formats a small business actually meets: bank exports,
 * card exports, and the CSV a processor hands you. Ordered most specific first, because
 * `detectMapping` claims a header for at most one field and resolves exact matches before loose
 * ones — otherwise "Transaction Amount" would be claimed by `date` via "transaction".
 */
export const STATEMENT_ALIASES: Record<StatementField, string[]> = {
  date: ['transactiondate', 'postingdate', 'posteddate', 'date', 'postdate', 'effectivedate'],
  description: ['description', 'payee', 'merchant', 'name', 'memo', 'details', 'transaction'],
  amount: ['amount', 'transactionamount', 'value'],
  debit: ['debit', 'withdrawal', 'withdrawals', 'moneyout', 'paymentsandcredits', 'charges'],
  credit: ['credit', 'deposit', 'deposits', 'moneyin'],
}

export type StatementMapping = Partial<Record<StatementField, string>>

/** Best guess at which column is which, for the mapping step to show pre-filled. */
export function detectStatementMapping(headers: string[]): StatementMapping {
  return detectMapping<StatementField>(headers, STATEMENT_ALIASES)
}

/**
 * A statement is usable when it has a date, a description, and *some* way to read an amount —
 * either one signed column or a debit/credit pair.
 */
export function mappingProblems(mapping: StatementMapping): string[] {
  const problems: string[] = []
  if (!mapping.date) problems.push('No date column')
  if (!mapping.description) problems.push('No description column')
  if (!mapping.amount && !mapping.debit && !mapping.credit) {
    problems.push('No amount column, and no debit/credit pair')
  }
  return problems
}

/**
 * Parse a money cell to cents.
 *
 * Statements are inconsistent in ways that all mean the same thing, and each of these has a
 * failure mode worse than rejecting the row:
 *
 * - `$1,234.56` — currency symbols and thousands separators, which `Number()` reads as `NaN`.
 * - `(12.34)` — accounting notation for a negative. Read naively this becomes `NaN`, or worse,
 *   `12.34`, turning a withdrawal into a deposit.
 * - `1.234,56` is **not** handled: European decimal notation is ambiguous against US thousands
 *   separators, and guessing would silently mis-scale an amount by a thousand.
 */
export function parseMoneyCents(raw: string | null): number | null {
  if (!raw) return null
  const trimmed = raw.trim()
  if (!trimmed) return null

  const parenthesised = /^\((.*)\)$/.test(trimmed)
  const bare = trimmed.replace(/^\(|\)$/g, '').replace(/[$£€\s]/g, '')

  // Validated *before* the commas are stripped, and only in the two shapes US statements use:
  // plain `1234.56`, or grouped `1,234.56`. Stripping first and validating after is what lets
  // `1.234,56` through as `1.23456` — mis-scaling a European amount by a thousand without ever
  // failing. Rejecting is the only safe answer, since `1.234` is genuinely ambiguous.
  const grouped = /^[+-]?\d{1,3}(,\d{3})+(\.\d+)?$/.test(bare)
  const plain = /^[+-]?\d*\.?\d+$/.test(bare)
  if (!grouped && !plain) return null

  const value = Number(bare.replace(/,/g, ''))
  if (!Number.isFinite(value)) return null

  const cents = Math.round(value * 100)
  return parenthesised ? -Math.abs(cents) : cents
}

/**
 * Parse a date cell.
 *
 * `MM/DD/YYYY` and `YYYY-MM-DD` are read explicitly and anchored at UTC midnight, matching how the
 * rest of the ledger stores an accounting date. Anything else is rejected rather than handed to
 * `new Date()`, which accepts almost any string and quietly invents a date from it — and which
 * reads `03/04/2026` as March either way, so a genuinely European statement would be misfiled
 * without ever failing.
 */
export function parseStatementDate(raw: string | null): Date | null {
  if (!raw) return null
  const trimmed = raw.trim()

  const iso = /^(\d{4})-(\d{2})-(\d{2})/.exec(trimmed)
  if (iso) return utcDate(Number(iso[1]), Number(iso[2]), Number(iso[3]))

  const us = /^(\d{1,2})[/-](\d{1,2})[/-](\d{2,4})$/.exec(trimmed)
  if (us) {
    const year = Number(us[3])
    return utcDate(year < 100 ? 2000 + year : year, Number(us[1]), Number(us[2]))
  }

  return null
}

function utcDate(year: number, month: number, day: number): Date | null {
  if (month < 1 || month > 12 || day < 1 || day > 31) return null
  const date = new Date(Date.UTC(year, month - 1, day))
  // Round-trip check, so 31 February is rejected rather than rolled into March.
  if (date.getUTCMonth() !== month - 1 || date.getUTCDate() !== day) return null
  return date
}

/** A statement line, normalised. `amountCents` is signed: positive in, negative out. */
export interface ParsedStatementRow {
  /** 1-based line number in the uploaded file, so an error names a row the user can find. */
  lineNumber: number
  date: Date
  description: string
  amountCents: number
}

export interface ParseStatementResult {
  rows: ParsedStatementRow[]
  /** Rows that could not be read, with the reason, rather than silently dropped. */
  errors: Array<{ lineNumber: number; reason: string }>
}

/**
 * Read raw CSV rows into normalised statement lines.
 *
 * A debit/credit pair is combined into one signed amount. Where both a signed `amount` column and
 * a debit/credit pair are mapped, the pair wins: it is unambiguous, whereas the sign convention of
 * a lone `amount` column varies by bank.
 */
export function parseStatementRows(
  rawRows: Record<string, string>[],
  mapping: StatementMapping
): ParseStatementResult {
  const rows: ParsedStatementRow[] = []
  const errors: Array<{ lineNumber: number; reason: string }> = []

  rawRows.forEach((raw, index) => {
    // +2: one for the header line, one because humans count from 1.
    const lineNumber = index + 2

    const date = parseStatementDate(mappedCell(raw, mapping.date))
    if (!date) {
      errors.push({ lineNumber, reason: 'Could not read the date' })
      return
    }

    const description = mappedCell(raw, mapping.description)
    if (!description) {
      errors.push({ lineNumber, reason: 'No description' })
      return
    }

    const amountCents = readAmount(raw, mapping)
    if (amountCents === null) {
      errors.push({ lineNumber, reason: 'Could not read the amount' })
      return
    }
    if (amountCents === 0) {
      errors.push({ lineNumber, reason: 'Amount is zero' })
      return
    }

    rows.push({ lineNumber, date, description, amountCents })
  })

  return { rows, errors }
}

function readAmount(raw: Record<string, string>, mapping: StatementMapping): number | null {
  const debit = mapping.debit ? parseMoneyCents(mappedCell(raw, mapping.debit)) : null
  const credit = mapping.credit ? parseMoneyCents(mappedCell(raw, mapping.credit)) : null

  if (debit !== null || credit !== null) {
    // A debit column carries a positive number meaning money out; normalise to a signed amount.
    return (credit ?? 0) - Math.abs(debit ?? 0)
  }

  return mapping.amount ? parseMoneyCents(mappedCell(raw, mapping.amount)) : null
}

/**
 * A stable content hash for a statement line.
 *
 * Statements overlap: exporting "last 90 days" twice covers the same transactions, and a
 * re-download after a correction repeats most of the file. Keying on the content means a repeated
 * line lands on the row it already created rather than beside it. The account label is part of the
 * hash because the same amount on the same day is a genuinely different transaction on a different
 * account.
 */
export function statementRowHash(row: ParsedStatementRow, accountLabel: string): string {
  const parts = [
    accountLabel.trim().toLowerCase(),
    row.date.toISOString().slice(0, 10),
    String(row.amountCents),
    // Whitespace and case vary between exports of the same transaction; the words do not.
    row.description.trim().toLowerCase().replace(/\s+/g, ' '),
  ]
  return createHash('sha256').update(parts.join('|')).digest('hex').slice(0, 32)
}

/**
 * Keyword rules for suggesting a category.
 *
 * Suggestions only — every row is shown to a person before anything is written. Deliberately
 * conservative: a wrong guess a reviewer waves through is worse than no guess at all, so anything
 * unmatched falls to a plain other-income/other-expense bucket rather than to a plausible-looking
 * category.
 */
const CATEGORY_RULES: Array<{ category: LedgerCategory; patterns: RegExp[] }> = [
  { category: 'PROCESSOR_FEES', patterns: [/stripe.*fee/i, /paypal.*fee/i, /square.*fee/i, /merchant fee/i, /card fee/i] },
  { category: 'SHIPPING_COST', patterns: [/usps/i, /\bups\b/i, /fedex/i, /pirate ?ship/i, /easypost/i, /postage/i, /shipstation/i] },
  { category: 'TRAVEL', patterns: [/fuel/i, /gas station/i, /shell/i, /marathon/i, /speedway/i, /hotel/i, /motel/i, /airline/i, /\bhertz\b/i] },
  { category: 'MEALS', patterns: [/restaurant/i, /\bcafe\b/i, /coffee/i, /diner/i, /pizza/i, /mcdonald/i, /subway/i] },
  { category: 'SUPPLIES', patterns: [/office ?(depot|max)/i, /staples/i, /amazon/i, /uline/i, /costco/i, /sam'?s club/i, /walmart/i] },
  { category: 'BOOTH_FEE', patterns: [/booth/i, /vendor fee/i, /festival/i, /market fee/i, /\bfair\b/i] },
  { category: 'PAYROLL', patterns: [/payroll/i, /\bgusto\b/i, /\badp\b/i, /wages/i, /salary/i] },
  { category: 'SALES_TAX_COLLECTED', patterns: [/sales tax/i, /dept.*taxation/i, /department of revenue/i] },
]

/** Descriptions that mean "this is a processor paying out money the ledger already recorded". */
const PROCESSOR_PAYOUT = [/stripe/i, /paypal/i, /square/i, /merchant deposit/i]

/**
 * A conservative category suggestion for a statement line.
 *
 * A keyword rule only fires when its category sits on the same side as the money actually moved.
 * Without that check a *deposit* described "SHELL OIL" — a refund from the fuel card, say — would
 * be suggested as `TRAVEL`, an expense, and filing money-in under an expense category flips the
 * sign of a figure in every report the ledger feeds.
 */
export function suggestCategory(description: string, amountCents: number): LedgerCategory {
  const side = amountCents >= 0 ? 'INCOME' : 'EXPENSE'
  for (const rule of CATEGORY_RULES) {
    if (CATEGORY_DIRECTION[rule.category] !== side) continue
    if (rule.patterns.some((p) => p.test(description))) return rule.category
  }
  return amountCents >= 0 ? 'OTHER_INCOME' : 'OTHER_EXPENSE'
}

/** Why a row is being held back from import. */
export type ExclusionReason = 'ledger-match' | 'processor-payout'

export interface LedgerAmountIndexEntry {
  date: Date
  amountCents: number
}

export interface ReviewRow extends ParsedStatementRow {
  contentHash: string
  suggestedCategory: LedgerCategory
  /** Set when the row looks like money the ledger already holds. */
  excludedReason: ExclusionReason | null
  /** Plain-language explanation shown next to the row. */
  excludedNote: string | null
  /** True when this exact line has been imported before. */
  alreadyImported: boolean
}

/** How many days either side of a statement date a matching ledger row still counts as the same
 *  money. Card settlement typically lands one to three days after the sale. */
export const MATCH_WINDOW_DAYS = 3

const DAY_MS = 24 * 60 * 60 * 1000

/**
 * Decide, for each parsed row, whether it is safe to import.
 *
 * Two exclusions, both defaulting to "leave it out":
 *
 * 1. **A ledger row already holds this money.** Same absolute amount, within a few days. Card
 *    settlement lags the sale, so an exact date match would miss almost every real duplicate.
 * 2. **It looks like a processor payout.** A deposit from Stripe, PayPal or Square is the
 *    aggregate of orders already recorded individually. It cannot be matched by amount — the
 *    payout is many orders net of fees — so it is excluded on the strength of its description and
 *    the reason is said out loud, rather than passed through because no single row matched it.
 *
 * Both can be overridden per row by the person reviewing, which is the point: the tool holds an
 * opinion, the bookkeeper decides.
 */
export function reviewStatementRows(input: {
  rows: ParsedStatementRow[]
  accountLabel: string
  /** Existing ledger amounts to match against, from the window the statement covers. */
  existingLedger: LedgerAmountIndexEntry[]
  /** Content hashes already imported, so a re-uploaded overlap is visible. */
  importedHashes?: Set<string>
}): ReviewRow[] {
  const { rows, accountLabel, existingLedger, importedHashes } = input

  // Bucketed by absolute amount so matching is a lookup rather than a scan per row.
  const byAmount = new Map<number, Date[]>()
  for (const entry of existingLedger) {
    const key = Math.abs(entry.amountCents)
    const list = byAmount.get(key)
    if (list) list.push(entry.date)
    else byAmount.set(key, [entry.date])
  }

  return rows.map((row) => {
    const contentHash = statementRowHash(row, accountLabel)
    const alreadyImported = importedHashes?.has(contentHash) ?? false

    let excludedReason: ExclusionReason | null = null
    let excludedNote: string | null = null

    if (PROCESSOR_PAYOUT.some((p) => p.test(row.description)) && row.amountCents > 0) {
      excludedReason = 'processor-payout'
      excludedNote =
        'Looks like a payment-processor payout. That deposit is orders the ledger already records one by one, net of fees — importing it would count the same sales twice.'
    } else {
      const candidates = byAmount.get(Math.abs(row.amountCents)) ?? []
      const near = candidates.find(
        (d) => Math.abs(d.getTime() - row.date.getTime()) <= MATCH_WINDOW_DAYS * DAY_MS
      )
      if (near) {
        excludedReason = 'ledger-match'
        excludedNote = `The ledger already has ${formatCents(row.amountCents)} on ${near
          .toISOString()
          .slice(0, 10)}, within ${MATCH_WINDOW_DAYS} days of this line.`
      }
    }

    return {
      ...row,
      contentHash,
      suggestedCategory: suggestCategory(row.description, row.amountCents),
      excludedReason,
      excludedNote,
      alreadyImported,
    }
  })
}

function formatCents(cents: number): string {
  return `$${(Math.abs(cents) / 100).toFixed(2)}`
}

/**
 * Check that a chosen category agrees with the direction the money actually moved.
 *
 * A withdrawal filed under an income category (or the reverse) would flip the sign of a figure in
 * every report the ledger feeds, so it is refused rather than accepted and quietly corrected —
 * correcting it would hide a mis-click that probably means the wrong category was picked.
 */
export function categoryMatchesDirection(category: LedgerCategory, amountCents: number): boolean {
  const wanted = amountCents >= 0 ? 'INCOME' : 'EXPENSE'
  return CATEGORY_DIRECTION[category] === wanted
}
