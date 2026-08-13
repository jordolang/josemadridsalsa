/**
 * Server-side writing of ledger rows: converts Prisma records into drafts (see `ledger.ts`) and
 * upserts them idempotently by `dedupeKey`, so the backfill and the live domain-event writer can
 * both run repeatedly without ever double-counting.
 *
 * Derived rows only. Manual rows are written by the admin API and are never touched here — the
 * upsert keys on `dedupeKey`, which manual rows do not carry.
 */
import type { PaymentStatus } from '@prisma/client'

import { prisma } from '@/lib/prisma'

import {
  archivedShowSaleToLedgerDrafts,
  dollarsToCents,
  orderToLedgerDrafts,
  refundToLedgerDraft,
  type LedgerEntryDraft,
  type OrderLedgerInput,
} from './ledger'

/**
 * Payment states that mean the money actually arrived. A later refund does not un-happen the
 * original sale, so `REFUNDED`/`PARTIALLY_REFUNDED` stay in the set — the sale and its processor
 * fee are still recorded, and the refund is a separate contra row.
 */
const SETTLED_PAYMENT: PaymentStatus[] = ['PAID', 'SUCCEEDED', 'PARTIALLY_REFUNDED', 'REFUNDED']

/** Upsert derived drafts by their dedupe key. Returns how many rows were written. */
export async function upsertLedgerDrafts(drafts: LedgerEntryDraft[]): Promise<number> {
  for (const d of drafts) {
    const data = {
      date: d.date,
      direction: d.direction,
      amountCents: d.amountCents,
      category: d.category,
      source: d.source,
      sourceId: d.sourceId,
      description: d.description,
      counterparty: d.counterparty ?? null,
      channel: d.channel ?? null,
      paymentMethod: d.paymentMethod ?? null,
    }
    await prisma.ledgerEntry.upsert({
      where: { dedupeKey: d.dedupeKey },
      create: { ...data, dedupeKey: d.dedupeKey },
      update: data,
    })
  }
  return drafts.length
}

type OrderWithMoney = {
  id: string
  orderNumber: string
  createdAt: Date
  salesChannel: OrderLedgerInput['channel']
  guestEmail: string | null
  paymentMethod: string | null
  subtotal: unknown
  shippingCost: unknown
  tax: unknown
  discountAmount: unknown
  items: Array<{ unitCost: unknown | null; quantity: number }>
  payments: Array<{ status: PaymentStatus; processorFee: number | null }>
}

/** Convert a loaded order into the pure mapper's input, summing COGS and processor fees. */
export function orderToInput(order: OrderWithMoney): OrderLedgerInput {
  const cogsCents = order.items.reduce((sum, it) => {
    if (it.unitCost == null) return sum
    return sum + dollarsToCents(Number(it.unitCost)) * it.quantity
  }, 0)

  // A null fee means "not known yet" (Square settles its fee hours later; Stripe needs a
  // balance-transaction lookup), never "no fee". Reading it as zero would report a fee-free
  // payment and overstate profit, so only known fees are summed — the fee sweep re-records the
  // order once it fills them in. If none are known yet, no PROCESSOR_FEES row is written at all.
  const processorFeeCents = order.payments
    .filter((p) => SETTLED_PAYMENT.includes(p.status) && p.processorFee != null)
    .reduce((sum, p) => sum + (p.processorFee ?? 0), 0)

  return {
    orderId: order.id,
    orderNumber: order.orderNumber,
    date: order.createdAt,
    channel: order.salesChannel,
    counterparty: order.guestEmail,
    paymentMethod: order.paymentMethod,
    subtotalCents: dollarsToCents(Number(order.subtotal)),
    shippingCents: dollarsToCents(Number(order.shippingCost)),
    taxCents: dollarsToCents(Number(order.tax)),
    discountCents: dollarsToCents(Number(order.discountAmount)),
    cogsCents,
    processorFeeCents,
  }
}

/**
 * Record one order into the ledger, if its money has settled. A PENDING order (a manual sale
 * awaiting payment, an abandoned checkout) writes nothing — the ledger only holds money that moved.
 */
export async function recordOrderInLedger(orderId: string): Promise<number> {
  const order = await prisma.order.findUnique({
    where: { id: orderId },
    select: {
      id: true,
      orderNumber: true,
      createdAt: true,
      salesChannel: true,
      guestEmail: true,
      paymentMethod: true,
      paymentStatus: true,
      subtotal: true,
      shippingCost: true,
      tax: true,
      discountAmount: true,
      items: { select: { unitCost: true, quantity: true } },
      payments: { select: { status: true, processorFee: true } },
    },
  })

  if (!order || !SETTLED_PAYMENT.includes(order.paymentStatus)) return 0
  return upsertLedgerDrafts(orderToLedgerDrafts(orderToInput(order)))
}

/** Record one settled refund into the ledger as a contra row. */
export async function recordRefundInLedger(refundId: string): Promise<number> {
  const refund = await prisma.refund.findUnique({
    where: { id: refundId },
    select: {
      id: true,
      amount: true,
      status: true,
      createdAt: true,
      payment: {
        select: { order: { select: { orderNumber: true, salesChannel: true, guestEmail: true } } },
      },
    },
  })

  if (!refund || refund.status !== 'SUCCEEDED') return 0

  const d = refundToLedgerDraft({
    refundId: refund.id,
    date: refund.createdAt,
    amountCents: refund.amount,
    orderNumber: refund.payment?.order?.orderNumber ?? null,
    counterparty: refund.payment?.order?.guestEmail ?? null,
    channel: refund.payment?.order?.salesChannel ?? null,
  })
  return d ? upsertLedgerDrafts([d]) : 0
}

/**
 * Record every settled refund on an order. The `payment.refunded` domain event carries the order
 * id (not the refund id), so this is the shape the live writer needs; it is idempotent per refund.
 */
export async function recordOrderRefundsInLedger(orderId: string): Promise<number> {
  const refunds = await prisma.refund.findMany({
    where: { status: 'SUCCEEDED', payment: { orderId } },
    select: { id: true },
  })
  let written = 0
  for (const r of refunds) written += await recordRefundInLedger(r.id)
  return written
}

/** Record one archived (historical) show sale into the ledger. */
export async function recordArchivedShowInLedger(show: {
  id: string
  showName: string
  showDate: Date | null
  year: number | null
  sales: unknown | null
  expenses: unknown | null
  salesPerson: string | null
}): Promise<number> {
  // The historical rows predate the order database, so a date is often only a year. Place a
  // year-only show at mid-year rather than dropping it; a show with neither is unplaceable.
  const date =
    show.showDate ?? (show.year != null ? new Date(Date.UTC(show.year, 6, 1)) : null)
  if (!date) return 0

  const drafts = archivedShowSaleToLedgerDrafts({
    id: show.id,
    date,
    showName: show.showName,
    salesCents: show.sales != null ? dollarsToCents(Number(show.sales)) : 0,
    expensesCents: show.expenses != null ? dollarsToCents(Number(show.expenses)) : 0,
    salesPerson: show.salesPerson,
  })
  return drafts.length ? upsertLedgerDrafts(drafts) : 0
}
