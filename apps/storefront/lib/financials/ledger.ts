/**
 * The bookkeeping ledger's arithmetic and categorisation, kept pure so it can be tested without
 * a database and reused by the backfill, the domain-event writer, and the QuickBooks export.
 *
 * Everything is in **cents**. Order money is stored as Decimal dollars and payment money as
 * integer cents; converting to one integer unit at the boundary is what lets a column of entries
 * sum without rounding drift.
 *
 * The one accounting rule encoded here: each dollar is turned into ledger rows from exactly one
 * source, so nothing is counted twice. An order becomes its revenue components (product, shipping,
 * tax) plus its costs (COGS, processor fee); a refund becomes a single contra row; an archived
 * show becomes its sales and its expenses. Rollups that merely re-summarise those sales are not
 * mapped here at all.
 */
import { z } from 'zod'

import type { LedgerCategory, LedgerDirection, LedgerSource, SalesChannel } from '@prisma/client'

/** Round dollars (as a number or Prisma Decimal stringified) to whole cents. */
export function dollarsToCents(dollars: number): number {
  return Math.round((Number.isFinite(dollars) ? dollars : 0) * 100)
}

/** Which side of the ledger each category sits on. Contra items (refunds, discounts) are EXPENSE
 * so that `sum(income) - sum(expense)` nets correctly. */
export const CATEGORY_DIRECTION: Record<LedgerCategory, LedgerDirection> = {
  PRODUCT_SALES: 'INCOME',
  SHIPPING_INCOME: 'INCOME',
  SALES_TAX_COLLECTED: 'INCOME',
  SHOW_SALES: 'INCOME',
  OTHER_INCOME: 'INCOME',
  COGS: 'EXPENSE',
  PROCESSOR_FEES: 'EXPENSE',
  SHIPPING_COST: 'EXPENSE',
  SHOW_EXPENSES: 'EXPENSE',
  REFUNDS: 'EXPENSE',
  DISCOUNTS: 'EXPENSE',
  BOOTH_FEE: 'EXPENSE',
  TRAVEL: 'EXPENSE',
  MEALS: 'EXPENSE',
  SUPPLIES: 'EXPENSE',
  PAYROLL: 'EXPENSE',
  OTHER_EXPENSE: 'EXPENSE',
}

/** Every category, in display order (income first). Drives the picker and the manual-entry schema. */
export const LEDGER_CATEGORY_VALUES = [
  'PRODUCT_SALES',
  'SHIPPING_INCOME',
  'SALES_TAX_COLLECTED',
  'SHOW_SALES',
  'OTHER_INCOME',
  'COGS',
  'PROCESSOR_FEES',
  'SHIPPING_COST',
  'SHOW_EXPENSES',
  'REFUNDS',
  'DISCOUNTS',
  'BOOTH_FEE',
  'TRAVEL',
  'MEALS',
  'SUPPLIES',
  'PAYROLL',
  'OTHER_EXPENSE',
] as const

/** Human labels for the categories. */
export const LEDGER_CATEGORY_LABELS: Record<LedgerCategory, string> = {
  PRODUCT_SALES: 'Product sales',
  SHIPPING_INCOME: 'Shipping collected',
  SALES_TAX_COLLECTED: 'Sales tax collected',
  SHOW_SALES: 'Show sales',
  OTHER_INCOME: 'Other income',
  COGS: 'Cost of goods',
  PROCESSOR_FEES: 'Processor fees',
  SHIPPING_COST: 'Shipping cost',
  SHOW_EXPENSES: 'Show expenses',
  REFUNDS: 'Refunds',
  DISCOUNTS: 'Discounts',
  BOOTH_FEE: 'Booth / show fee',
  TRAVEL: 'Travel',
  MEALS: 'Meals',
  SUPPLIES: 'Supplies',
  PAYROLL: 'Payroll',
  OTHER_EXPENSE: 'Other expense',
}

/**
 * A hand-entered ledger row. The direction is derived from the category (see `CATEGORY_DIRECTION`)
 * rather than asked for, and money is typed in dollars and stored as cents. Positive amounts only —
 * a refund or discount is a positive amount under a contra category, not a negative sale.
 */
export const ManualLedgerEntrySchema = z.object({
  // Strict YYYY-MM-DD with a round-trip check, so an impossible date (2026-02-31) is rejected
  // rather than silently normalised by the Date parser.
  date: z.string().refine((v) => {
    if (!/^\d{4}-\d{2}-\d{2}$/.test(v)) return false
    const d = new Date(`${v}T00:00:00.000Z`)
    return !Number.isNaN(d.getTime()) && d.toISOString().slice(0, 10) === v
  }, 'Enter a valid date (YYYY-MM-DD)'),
  category: z.enum(LEDGER_CATEGORY_VALUES),
  // At least a cent: a smaller value rounds to zero cents and would create a $0 row.
  amountDollars: z.number().min(0.01, 'Must be at least $0.01').max(1_000_000, 'That looks like a typo'),
  description: z.string().trim().min(1, 'Add a description').max(300),
  counterparty: z.string().trim().max(200).nullable().optional(),
  paymentMethod: z.string().trim().max(60).nullable().optional(),
  memo: z.string().trim().max(1000).nullable().optional(),
})

export type ManualLedgerEntryInput = z.infer<typeof ManualLedgerEntrySchema>

/** A ledger row before it is written — no id, no timestamps. */
export interface LedgerEntryDraft {
  date: Date
  direction: LedgerDirection
  amountCents: number
  category: LedgerCategory
  source: LedgerSource
  sourceId: string
  dedupeKey: string
  description: string
  counterparty?: string | null
  channel?: SalesChannel | null
  paymentMethod?: string | null
}

function draft(
  base: { date: Date; sourceId: string; source: LedgerSource; counterparty?: string | null; channel?: SalesChannel | null; paymentMethod?: string | null },
  category: LedgerCategory,
  amountCents: number,
  description: string
): LedgerEntryDraft {
  return {
    date: base.date,
    direction: CATEGORY_DIRECTION[category],
    amountCents,
    category,
    source: base.source,
    sourceId: base.sourceId,
    dedupeKey: `${base.source.toLowerCase()}:${base.sourceId}:${category.toLowerCase()}`,
    description,
    counterparty: base.counterparty ?? null,
    channel: base.channel ?? null,
    paymentMethod: base.paymentMethod ?? null,
  }
}

export interface OrderLedgerInput {
  orderId: string
  orderNumber: string
  date: Date
  channel?: SalesChannel | null
  counterparty?: string | null
  paymentMethod?: string | null
  subtotalCents: number
  shippingCents: number
  taxCents: number
  discountCents: number
  /** Sum of `unitCost * quantity` across items, in cents; 0 when every cost was unknown. */
  cogsCents: number
  /** The processor fee on the settling payment, in cents; 0 when none/unknown. */
  processorFeeCents: number
}

/**
 * An order's revenue and cost components. Only non-zero components produce a row, so a
 * free-shipping-less, tax-exempt order does not litter the ledger with zeros. Gift-certificate
 * settlement is intentionally absent: the sale's revenue is its goods, and how it was paid for is
 * a balance-sheet concern the P&L ledger does not track.
 */
export function orderToLedgerDrafts(order: OrderLedgerInput): LedgerEntryDraft[] {
  const base = {
    date: order.date,
    sourceId: order.orderId,
    source: 'ORDER' as LedgerSource,
    counterparty: order.counterparty,
    channel: order.channel,
    paymentMethod: order.paymentMethod,
  }
  const label = `Order ${order.orderNumber}`
  const drafts: LedgerEntryDraft[] = []

  if (order.subtotalCents > 0) drafts.push(draft(base, 'PRODUCT_SALES', order.subtotalCents, `${label} — product sales`))
  if (order.shippingCents > 0) drafts.push(draft(base, 'SHIPPING_INCOME', order.shippingCents, `${label} — shipping`))
  if (order.taxCents > 0) drafts.push(draft(base, 'SALES_TAX_COLLECTED', order.taxCents, `${label} — sales tax collected`))
  if (order.discountCents > 0) drafts.push(draft(base, 'DISCOUNTS', order.discountCents, `${label} — discount`))
  if (order.cogsCents > 0) drafts.push(draft(base, 'COGS', order.cogsCents, `${label} — cost of goods`))
  if (order.processorFeeCents > 0) drafts.push(draft(base, 'PROCESSOR_FEES', order.processorFeeCents, `${label} — processor fee`))

  return drafts
}

export interface RefundLedgerInput {
  refundId: string
  date: Date
  amountCents: number
  orderNumber?: string | null
  counterparty?: string | null
  channel?: SalesChannel | null
}

/** A settled refund, as a single contra-income row. */
export function refundToLedgerDraft(refund: RefundLedgerInput): LedgerEntryDraft | null {
  if (refund.amountCents <= 0) return null
  const base = {
    date: refund.date,
    sourceId: refund.refundId,
    source: 'REFUND' as LedgerSource,
    counterparty: refund.counterparty,
    channel: refund.channel,
  }
  const label = refund.orderNumber ? `Refund on ${refund.orderNumber}` : 'Refund'
  return draft(base, 'REFUNDS', refund.amountCents, label)
}

export interface ArchivedShowLedgerInput {
  id: string
  date: Date
  showName: string
  salesCents: number
  expensesCents: number
  salesPerson?: string | null
}

/** A historical show's own tally: sales in, expenses out. */
export function archivedShowSaleToLedgerDrafts(show: ArchivedShowLedgerInput): LedgerEntryDraft[] {
  const base = {
    date: show.date,
    sourceId: show.id,
    source: 'SHOW_ARCHIVE' as LedgerSource,
    counterparty: show.salesPerson ?? null,
  }
  const drafts: LedgerEntryDraft[] = []
  if (show.salesCents > 0) drafts.push(draft(base, 'SHOW_SALES', show.salesCents, `${show.showName} — show sales`))
  if (show.expensesCents > 0) drafts.push(draft(base, 'SHOW_EXPENSES', show.expensesCents, `${show.showName} — show expenses`))
  return drafts
}

// ── Reporting ──────────────────────────────────────────────────────────────────────────────

export interface LedgerLike {
  direction: LedgerDirection
  amountCents: number
  category: LedgerCategory
}

export interface LedgerSummary {
  incomeCents: number
  expenseCents: number
  /** Income − expense. Negative means a loss over the entries summed. */
  netCents: number
  byCategory: Partial<Record<LedgerCategory, number>>
}

/** Totals and a per-category breakdown over any set of entries. */
export function summariseLedger(entries: LedgerLike[]): LedgerSummary {
  let incomeCents = 0
  let expenseCents = 0
  const byCategory: Partial<Record<LedgerCategory, number>> = {}

  for (const e of entries) {
    const amount = Number.isFinite(e.amountCents) ? Math.max(0, e.amountCents) : 0
    // Classify from the category, the same source `profitAndLoss` uses, so the totals and the
    // per-line breakdown can never disagree even if a stored `direction` were ever inconsistent.
    if (CATEGORY_DIRECTION[e.category] === 'INCOME') incomeCents += amount
    else expenseCents += amount
    byCategory[e.category] = (byCategory[e.category] ?? 0) + amount
  }

  return { incomeCents, expenseCents, netCents: incomeCents - expenseCents, byCategory }
}

export interface ProfitAndLoss {
  income: Array<{ category: LedgerCategory; amountCents: number }>
  expenses: Array<{ category: LedgerCategory; amountCents: number }>
  totalIncomeCents: number
  totalExpenseCents: number
  netCents: number
}

/** A simple profit-and-loss: income lines, expense lines, and the net between them. */
export function profitAndLoss(entries: LedgerLike[]): ProfitAndLoss {
  const summary = summariseLedger(entries)
  const income: ProfitAndLoss['income'] = []
  const expenses: ProfitAndLoss['expenses'] = []

  for (const [category, amountCents] of Object.entries(summary.byCategory) as Array<[LedgerCategory, number]>) {
    if (CATEGORY_DIRECTION[category] === 'INCOME') income.push({ category, amountCents })
    else expenses.push({ category, amountCents })
  }

  const byAmountDesc = (a: { amountCents: number }, b: { amountCents: number }) => b.amountCents - a.amountCents
  income.sort(byAmountDesc)
  expenses.sort(byAmountDesc)

  return {
    income,
    expenses,
    totalIncomeCents: summary.incomeCents,
    totalExpenseCents: summary.expenseCents,
    netCents: summary.netCents,
  }
}
