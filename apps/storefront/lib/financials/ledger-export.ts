/**
 * Turning ledger rows into files an accountant — or QuickBooks itself — can read.
 *
 * Three formats, because they answer three different questions:
 *
 * - **`detail`** — every column of every row. The backup and the spreadsheet, not an import format.
 * - **`qbo-bank`** — QuickBooks Online's *Banking → Upload from file* four-column CSV. A list of
 *   cash movements, so rows that moved no cash are left out (see `IS_CASH_MOVEMENT`).
 * - **`qbo-journal`** — the journal-entry CSV that QuickBooks Online Advanced imports. Real
 *   double-entry: each ledger row becomes a debit line and a credit line that balance.
 *
 * Kept pure — no Prisma, no `fetch` — because the arithmetic and the account sides are the part
 * that can quietly misstate the books, and they should be testable without a database.
 *
 * **Why a *file* export exists at all when there is a live sync:** the sync posts to the books
 * automatically and refuses whenever it is not certain (see `lib/quickbooks/sync.ts`). A file is
 * the path for everything else — a bookkeeper who wants to review before importing, an accountant
 * on a different system, the historical years, and a plain backup that does not depend on Intuit
 * being reachable.
 */
import type { LedgerCategory, LedgerDirection, LedgerSource, SalesChannel } from '@prisma/client'

import { toCsv } from '@/lib/csv'

import { CATEGORY_DIRECTION, LEDGER_CATEGORY_LABELS } from './ledger'

// The format names and their labels live in `ledger.ts`, which the export dialog can import
// without dragging `lib/csv` — and PapaParse — into a client bundle. Re-exported so server-side
// callers of this module still find everything about an export in one place.
export {
  LEDGER_EXPORT_FORMATS,
  LEDGER_EXPORT_FORMAT_LABELS,
  type LedgerExportFormat,
} from './ledger'
import type { LedgerExportFormat } from './ledger'

/** The fields an export reads. A subset of `LedgerEntry`, so a test can build one by hand. */
export interface ExportableEntry {
  id: string
  date: Date
  direction: LedgerDirection
  amountCents: number
  category: LedgerCategory
  source: LedgerSource
  sourceId: string | null
  description: string
  counterparty: string | null
  channel: SalesChannel | null
  paymentMethod: string | null
  memo: string | null
  isManual: boolean
  exportedAt: Date | null
}

/**
 * Did this row correspond to money actually entering or leaving a bank account?
 *
 * Two do not, and including them in a bank-style upload would invent transactions that never
 * happened:
 *
 * - **`COGS`** is derived from the cost snapshot on each item sold. The cash for that stock left
 *   the bank when the ingredients were bought, not when the jar sold.
 * - **`DISCOUNTS`** is money that never arrived. The sale is recorded gross and the discount
 *   separately so the P&L can show both; the deposit was always the net.
 *
 * Everything else moved real money: a refund leaves, a processor fee is netted out of the deposit,
 * sales tax collected arrives and is later remitted.
 */
export const IS_CASH_MOVEMENT: Record<LedgerCategory, boolean> = {
  PRODUCT_SALES: true,
  SHIPPING_INCOME: true,
  SALES_TAX_COLLECTED: true,
  SHOW_SALES: true,
  OTHER_INCOME: true,
  COGS: false,
  PROCESSOR_FEES: true,
  SHIPPING_COST: true,
  SHOW_EXPENSES: true,
  REFUNDS: true,
  DISCOUNTS: false,
  BOOTH_FEE: true,
  TRAVEL: true,
  MEALS: true,
  SUPPLIES: true,
  PAYROLL: true,
  OTHER_EXPENSE: true,
}

/**
 * The two accounts a category posts to.
 *
 * `account` is where the category itself lands; `offset` is the other side of the entry. For nearly
 * everything the offset is the cash/clearing account — the money came from or went to the bank.
 * Two categories are deliberately different, and getting them wrong is how a journal import
 * misstates a set of books:
 *
 * - **`SALES_TAX_COLLECTED` is a liability, not income.** It arrives as cash but it is owed to the
 *   state. The ledger files it under `INCOME` because that describes the *direction the money
 *   moved*; the books must credit **Sales Tax Payable** or revenue is overstated by every dollar of
 *   tax ever collected.
 * - **`COGS` moves no cash.** Its offset is the inventory asset it was drawn from, not the bank.
 *   Crediting cash here would double-count the payment already made to the supplier.
 */
export interface AccountPair {
  account: string
  offset: string
}

/** The cash/clearing account most entries post against. */
export const DEFAULT_CLEARING_ACCOUNT = 'Undeposited Funds'

/**
 * Suggested QuickBooks account names, using the names QuickBooks Online creates by default for a
 * US product business. They are a **starting point that the admin can override**, not an assertion
 * about this company's chart of accounts — which is why they are only used by the file exports,
 * where a human reviews the file before importing it. The automated sync never falls back to a
 * default: it requires an explicitly mapped account id and blocks without one.
 */
export const DEFAULT_ACCOUNT_MAP: Record<LedgerCategory, AccountPair> = {
  PRODUCT_SALES: { account: 'Sales of Product Income', offset: DEFAULT_CLEARING_ACCOUNT },
  SHIPPING_INCOME: { account: 'Shipping Income', offset: DEFAULT_CLEARING_ACCOUNT },
  SALES_TAX_COLLECTED: { account: 'Sales Tax Payable', offset: DEFAULT_CLEARING_ACCOUNT },
  SHOW_SALES: { account: 'Sales of Product Income', offset: DEFAULT_CLEARING_ACCOUNT },
  OTHER_INCOME: { account: 'Other Income', offset: DEFAULT_CLEARING_ACCOUNT },
  COGS: { account: 'Cost of Goods Sold', offset: 'Inventory Asset' },
  PROCESSOR_FEES: { account: 'Merchant Account Fees', offset: DEFAULT_CLEARING_ACCOUNT },
  SHIPPING_COST: { account: 'Shipping and Delivery', offset: DEFAULT_CLEARING_ACCOUNT },
  SHOW_EXPENSES: { account: 'Other Business Expenses', offset: DEFAULT_CLEARING_ACCOUNT },
  REFUNDS: { account: 'Refunds-Allowances', offset: DEFAULT_CLEARING_ACCOUNT },
  DISCOUNTS: { account: 'Discounts given', offset: DEFAULT_CLEARING_ACCOUNT },
  BOOTH_FEE: { account: 'Advertising & Marketing', offset: DEFAULT_CLEARING_ACCOUNT },
  TRAVEL: { account: 'Travel', offset: DEFAULT_CLEARING_ACCOUNT },
  MEALS: { account: 'Travel Meals', offset: DEFAULT_CLEARING_ACCOUNT },
  SUPPLIES: { account: 'Office Supplies & Software', offset: DEFAULT_CLEARING_ACCOUNT },
  PAYROLL: { account: 'Payroll Expenses', offset: DEFAULT_CLEARING_ACCOUNT },
  OTHER_EXPENSE: { account: 'Other Business Expenses', offset: DEFAULT_CLEARING_ACCOUNT },
}

/** A stored override: any subset of categories, and either side of the pair. */
export type AccountMapOverrides = Partial<Record<LedgerCategory, Partial<AccountPair>>>

/**
 * Merge stored overrides over the defaults. A blank or whitespace-only override is treated as
 * absent rather than as an empty account name, so clearing a field in the settings form returns
 * that category to its default instead of emitting a nameless journal line.
 */
export function resolveAccountMap(overrides?: AccountMapOverrides | null): Record<LedgerCategory, AccountPair> {
  const resolved = {} as Record<LedgerCategory, AccountPair>
  for (const [category, pair] of Object.entries(DEFAULT_ACCOUNT_MAP) as Array<[LedgerCategory, AccountPair]>) {
    const override = overrides?.[category]
    resolved[category] = {
      account: override?.account?.trim() || pair.account,
      offset: override?.offset?.trim() || pair.offset,
    }
  }
  return resolved
}

/** Cents to a plain `123.45` string — no currency symbol, no thousands separator, as CSV wants. */
export function centsToAmountString(cents: number): string {
  const safe = Number.isFinite(cents) ? Math.round(cents) : 0
  return (safe / 100).toFixed(2)
}

/**
 * `MM/DD/YYYY`, read in UTC.
 *
 * The ledger stores an accounting *date*, and the whole pipeline — the backfill, the mapper, the
 * archived-show placement — writes it at UTC midnight. Formatting with the server's local calendar
 * would shift a midnight-UTC date back a day anywhere west of Greenwich and file January's sales
 * in December.
 */
export function toExportDate(date: Date): string {
  const pad = (n: number) => String(n).padStart(2, '0')
  return `${pad(date.getUTCMonth() + 1)}/${pad(date.getUTCDate())}/${date.getUTCFullYear()}`
}

/** `YYYY-MM-DD`, UTC, for the detail export where sortability beats US convention. */
export function toIsoDate(date: Date): string {
  return date.toISOString().slice(0, 10)
}

/**
 * Full detail: every column, sortable dates, one row per ledger entry. Not an import format — it is
 * the spreadsheet and the backup.
 */
export function toDetailCsv(entries: ExportableEntry[]): string {
  return toCsv(
    [
      'Date',
      'Direction',
      'Category',
      'Amount',
      'Description',
      'Counterparty',
      'Channel',
      'Payment method',
      'Source',
      'Source ID',
      'Entered manually',
      'Memo',
      'Previously exported',
    ],
    entries.map((e) => [
      toIsoDate(e.date),
      e.direction,
      LEDGER_CATEGORY_LABELS[e.category],
      centsToAmountString(e.amountCents),
      e.description,
      e.counterparty ?? '',
      e.channel ?? '',
      e.paymentMethod ?? '',
      e.source,
      e.sourceId ?? '',
      e.isManual ? 'yes' : 'no',
      e.memo ?? '',
      e.exportedAt ? toIsoDate(e.exportedAt) : '',
    ])
  )
}

/**
 * QuickBooks Online's four-column bank upload: `Date, Description, Credit, Debit`.
 *
 * Four columns rather than the three-column `Date, Description, Amount` variant QBO also accepts,
 * because the three-column form carries the direction in the sign of the number and a stray minus
 * (or a spreadsheet helpfully reformatting a negative as `(1.23)`) silently reverses a transaction.
 * Two columns cannot be misread.
 *
 * Non-cash rows are dropped — see `IS_CASH_MOVEMENT`.
 */
export function toQboBankCsv(entries: ExportableEntry[]): string {
  const cash = entries.filter((e) => IS_CASH_MOVEMENT[e.category])
  return toCsv(
    ['Date', 'Description', 'Credit', 'Debit'],
    cash.map((e) => {
      const amount = centsToAmountString(e.amountCents)
      const isIn = CATEGORY_DIRECTION[e.category] === 'INCOME'
      return [
        toExportDate(e.date),
        bankDescription(e),
        isIn ? amount : '',
        isIn ? '' : amount,
      ]
    })
  )
}

/** Bank statements have one free-text column, so the useful identifiers are folded into it. */
function bankDescription(e: ExportableEntry): string {
  const parts = [e.description]
  if (e.counterparty) parts.push(e.counterparty)
  return parts.join(' — ')
}

export interface JournalCsvOptions {
  /** Category → the two accounts it posts to. Defaults are only ever suggestions. */
  accounts?: Record<LedgerCategory, AccountPair>
  /** Three-letter code for the Currency column. */
  currency?: string
}

/**
 * The journal-entry CSV QuickBooks Online Advanced imports.
 *
 * Each ledger row becomes **two lines sharing one journal number** — a debit and an equal credit —
 * so every entry balances on its own and a partial import cannot leave the books out of balance.
 * Which account takes which side follows from the direction:
 *
 * - money **in** debits the cash/clearing account and credits the category (revenue, or the tax
 *   liability);
 * - money **out** debits the category (an expense, or a contra-income account like refunds) and
 *   credits cash.
 *
 * The journal number is the ledger row's own id, so a line in QuickBooks can always be traced back
 * to the row — and to the order, refund or show behind it — without keeping a separate crosswalk.
 */
export function toQboJournalCsv(entries: ExportableEntry[], options: JournalCsvOptions = {}): string {
  const accounts = options.accounts ?? DEFAULT_ACCOUNT_MAP
  const currency = options.currency ?? 'USD'
  const rows: Array<Array<string>> = []

  for (const e of entries) {
    const amount = centsToAmountString(e.amountCents)
    const pair = accounts[e.category]
    const isIn = CATEGORY_DIRECTION[e.category] === 'INCOME'
    const journalNo = e.id
    const date = toExportDate(e.date)
    const name = e.counterparty ?? ''

    // Debit side first, which is the order QuickBooks' own template uses.
    const debitAccount = isIn ? pair.offset : pair.account
    const creditAccount = isIn ? pair.account : pair.offset

    rows.push([journalNo, date, currency, debitAccount, amount, '', e.description, name])
    rows.push([journalNo, date, currency, creditAccount, '', amount, e.description, name])
  }

  return toCsv(
    ['Journal No', 'Journal Date', 'Currency', 'Account', 'Debits', 'Credits', 'Description', 'Name'],
    rows
  )
}

/** Which categories in a set would be dropped by the bank format, so the UI can say so up front. */
export function nonCashCategories(entries: ExportableEntry[]): LedgerCategory[] {
  const seen = new Set<LedgerCategory>()
  for (const e of entries) if (!IS_CASH_MOVEMENT[e.category]) seen.add(e.category)
  return [...seen]
}

/** Render a set of entries in the requested format. */
export function renderLedgerExport(
  format: LedgerExportFormat,
  entries: ExportableEntry[],
  options: JournalCsvOptions = {}
): string {
  switch (format) {
    case 'qbo-bank':
      return toQboBankCsv(entries)
    case 'qbo-journal':
      return toQboJournalCsv(entries, options)
    case 'detail':
    default:
      return toDetailCsv(entries)
  }
}

/** `jose-madrid-ledger-qbo-journal-2026-08-15.csv` — format and date in the name. */
export function exportFilename(format: LedgerExportFormat, now: Date): string {
  return `jose-madrid-ledger-${format}-${toIsoDate(now)}.csv`
}
