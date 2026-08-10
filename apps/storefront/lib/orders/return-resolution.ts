import type { ReturnReason, ReturnResolution } from '@prisma/client'

/**
 * What completing a return actually does about the money.
 *
 * Until now `ReturnRequest.resolution` was stored and displayed and nothing branched on it, so
 * a return marked EXCHANGE or STORE_CREDIT behaved exactly like a refund — except that no
 * refund was issued either, because nothing wrote `refundId`. Completion restocked the goods
 * and stopped. This module is the decision that was missing.
 *
 * The rule that matters: **a return produces exactly one outcome.** Money back, credit, or
 * replacement goods — never two. The database enforces at-most-one of each via unique columns;
 * this enforces at-most-one *in total*, which unique columns cannot express.
 */

export type ReturnOutcome = 'REFUND' | 'STORE_CREDIT' | 'EXCHANGE'

/** What a resolution obliges completion to do. The mapping is total, so a new enum value breaks the build. */
export function outcomeForResolution(resolution: ReturnResolution): ReturnOutcome {
  switch (resolution) {
    case 'REFUND':
      return 'REFUND'
    case 'STORE_CREDIT':
      return 'STORE_CREDIT'
    case 'EXCHANGE':
      return 'EXCHANGE'
  }
}

export interface SettledOutcomes {
  /** A refund has already been recorded against this return. */
  refundId: string | null
  /** Store credit has already been issued. */
  giftCertificateId: string | null
  /** A replacement order has already been raised. */
  exchangeOrderId: string | null
}

export type ResolutionBlock =
  | { code: 'ALREADY_SETTLED'; outcome: ReturnOutcome; message: string }
  | { code: 'CONFLICTING_OUTCOME'; outcome: ReturnOutcome; message: string }
  | { code: 'NOTHING_TO_SETTLE'; message: string }

const OUTCOME_LABELS: Record<ReturnOutcome, string> = {
  REFUND: 'a refund',
  STORE_CREDIT: 'store credit',
  EXCHANGE: 'a replacement order',
}

/** Which outcome, if any, this return has already produced. */
export function settledOutcome(settled: SettledOutcomes): ReturnOutcome | null {
  if (settled.refundId) return 'REFUND'
  if (settled.giftCertificateId) return 'STORE_CREDIT'
  if (settled.exchangeOrderId) return 'EXCHANGE'
  return null
}

/**
 * Whether completion may settle this return, and how.
 *
 * Two separate refusals, because they need different messages. A return that already produced
 * the outcome its resolution asks for is a **repeat** — harmless, and completion should skip
 * the money step rather than fail. A return that produced a *different* outcome is a
 * **conflict**: someone refunded the customer and is now also trying to issue credit, and that
 * has to stop rather than be smoothed over.
 */
export function planResolution(
  resolution: ReturnResolution,
  settled: SettledOutcomes
): { ok: true; outcome: ReturnOutcome } | { ok: false; block: ResolutionBlock } {
  const wanted = outcomeForResolution(resolution)
  const existing = settledOutcome(settled)

  if (existing === null) {
    return { ok: true, outcome: wanted }
  }

  if (existing === wanted) {
    return {
      ok: false,
      block: {
        code: 'ALREADY_SETTLED',
        outcome: wanted,
        message: `This return has already produced ${OUTCOME_LABELS[wanted]}.`,
      },
    }
  }

  return {
    ok: false,
    block: {
      code: 'CONFLICTING_OUTCOME',
      outcome: existing,
      message: `This return already produced ${OUTCOME_LABELS[existing]}, so it cannot also produce ${OUTCOME_LABELS[wanted]}. Reverse the first outcome before changing the resolution.`,
    },
  }
}

/**
 * The value a return owes the customer, in cents.
 *
 * Deliberately the same figure for all three outcomes: the refund amount, the credit amount,
 * and the value of the replacement goods are one number. Computing them differently is how a
 * customer ends up better or worse off depending on which button staff pressed.
 */
export interface ReturnedLineValue {
  orderItemId: string
  quantity: number
  /** Unit price in cents, as sold — not the current catalogue price. */
  unitPriceCents: number
}

export function returnValueCents(
  lines: ReturnedLineValue[],
  restockingFeeCents = 0
): number {
  const goods = lines.reduce((sum, line) => sum + line.unitPriceCents * line.quantity, 0)
  // A fee larger than the goods gives nothing back rather than charging the customer.
  return Math.max(0, goods - restockingFeeCents)
}

/**
 * Return reasons that are the business's fault.
 *
 * These are the only cases where the customer gets the **original shipping** back as well. Everyone
 * else paid for a delivery that happened, so that service was rendered — but a customer who was sent
 * a broken or wrong jar should not be out of pocket for the postage that brought it.
 *
 * `QUALITY_ISSUE` counts: the product not being good enough is on us. `CHANGED_MIND`,
 * `ARRIVED_LATE` and `NOT_AS_DESCRIBED` do not — a late parcel still arrived, and "not as
 * described" is a judgement call staff can override per return.
 */
export const OUR_FAULT_RETURN_REASONS: ReturnReason[] = ['DAMAGED', 'WRONG_ITEM', 'QUALITY_ISSUE']

export function isOurFault(reason: ReturnReason): boolean {
  return OUR_FAULT_RETURN_REASONS.includes(reason)
}

export interface RefundBreakdownInput {
  lines: ReturnedLineValue[]
  /** Tax the order collected, in cents. */
  orderTaxCents: number
  /** Goods total of the whole order, in cents — the base tax was charged on. */
  orderGoodsCents: number
  /** Shipping and handling the customer paid, in cents. */
  orderShippingCents: number
  reason: ReturnReason
  restockingFeeCents?: number
  /**
   * Staff override. Forces original shipping in or out regardless of the reason, for the calls
   * that do not fit the rule.
   */
  refundShippingOverride?: boolean
}

export interface RefundBreakdown {
  goodsCents: number
  /** Tax attributable to the returned goods. */
  taxCents: number
  /** Original shipping, included only when the return is our fault. */
  shippingCents: number
  restockingFeeCents: number
  totalCents: number
  /** Whether shipping was included, and why — shown to staff before they confirm. */
  shippingRefunded: boolean
  shippingReason: string
}

/**
 * What to send back.
 *
 * **Goods + the tax on those goods**, plus original shipping when the fault is ours, less any
 * restocking fee.
 *
 * Tax is apportioned by the returned goods' share of the order's goods rather than recomputed:
 * re-running Stripe Tax would price today's rates against a sale that happened at yesterday's, and
 * refunding the whole order's tax for one returned jar would hand back tax that was never
 * collected on it.
 */
export function computeRefundBreakdown(input: RefundBreakdownInput): RefundBreakdown {
  const goodsCents = input.lines.reduce(
    (sum, line) => sum + line.unitPriceCents * line.quantity,
    0
  )

  // Guard the divisor: an order whose goods total is zero — fully discounted, or a replacement —
  // has no tax to apportion, and dividing by it would produce NaN in a refund.
  const share = input.orderGoodsCents > 0 ? goodsCents / input.orderGoodsCents : 0
  const taxCents = Math.round(input.orderTaxCents * Math.min(1, share))

  const ourFault = input.refundShippingOverride ?? isOurFault(input.reason)
  const shippingCents = ourFault ? input.orderShippingCents : 0

  const restockingFeeCents = input.restockingFeeCents ?? 0

  return {
    goodsCents,
    taxCents,
    shippingCents,
    restockingFeeCents,
    // Never negative: a fee larger than everything else refunds nothing rather than billing them.
    totalCents: Math.max(0, goodsCents + taxCents + shippingCents - restockingFeeCents),
    shippingRefunded: ourFault && input.orderShippingCents > 0,
    shippingReason: ourFault
      ? 'Refunded — the return is down to us'
      : 'Not refunded — the delivery happened',
  }
}

/**
 * How long store credit issued for a return stays live.
 *
 * Given an expiry at all so it does not sit on the balance sheet forever, but a long one:
 * credit the customer did not ask for — they wanted their money — should not quietly expire
 * before they have had a fair chance to spend it.
 */
export const STORE_CREDIT_VALID_DAYS = 365

export function storeCreditExpiry(issuedAt: Date): Date {
  const expiry = new Date(issuedAt)
  expiry.setDate(expiry.getDate() + STORE_CREDIT_VALID_DAYS)
  return expiry
}

/** `JMS-CR-YYYYMMDD-####`. Distinct from purchased certificates (`JMS-GC-…`) so the two are
 *  tellable apart on a phone call and in the gift-certificate list. */
export function generateStoreCreditCode(now: Date, random: () => number = Math.random): string {
  const datePart = now.toISOString().slice(0, 10).replace(/-/g, '')
  const suffix = Math.floor(random() * 9000 + 1000)
  return `JMS-CR-${datePart}-${suffix}`
}

/**
 * Order number for a replacement raised by an exchange.
 *
 * `JMS-EX-…` rather than `JMS-…` because an exchange order shows up in the same lists as sales
 * and someone will need to tell at a glance why it has a zero total.
 */
export function generateExchangeOrderNumber(now: Date, random: () => number = Math.random): string {
  const datePart = now.toISOString().slice(0, 10).replace(/-/g, '')
  const suffix = Math.floor(random() * 9000 + 1000)
  return `JMS-EX-${datePart}-${suffix}`
}
