import type { ReturnResolution } from '@prisma/client'

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
