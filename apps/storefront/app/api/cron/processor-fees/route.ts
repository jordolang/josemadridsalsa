import { NextResponse } from 'next/server'

import { prisma } from '@/lib/prisma'
import { isAuthorizedCronRequest } from '@/lib/cron/auth'
import { SETTLED_PAYMENT, recordOrderInLedger } from '@/lib/financials/ledger-writer'
import {
  fetchPayPalFee,
  fetchSquareFee,
  fetchStripeFee,
  FEE_LOOKUP_MAX_AGE_DAYS,
  isWorthCheckingFee,
} from '@/lib/payments/processor-fees'

/**
 * GET /api/cron/processor-fees
 *
 * Fills in what each processor actually charged, so net revenue can be a real number rather
 * than gross pretending to be one.
 *
 * This is a sweep and not webhook work because Square does not know its own fee at
 * `payment.completed` — it settles the fee hours later. Since a sweep is unavoidable for
 * Square, all providers use it, which also keeps a third-party call out of the webhook
 * handlers that must not fail. All three providers are now covered.
 *
 * Every payment it touches gets `processorFeeCheckedAt` stamped whether or not a fee came
 * back, so an unanswerable payment is retried on a schedule rather than on every tick, and
 * abandoned entirely after a week.
 */

export const dynamic = 'force-dynamic'
export const maxDuration = 60

/** Bounded so one tick cannot run long against a backlog. */
const BATCH = 50

export async function GET(request: Request) {
  if (!isAuthorizedCronRequest(request)) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  try {
    const now = new Date()
    const oldest = new Date(now.getTime() - FEE_LOOKUP_MAX_AGE_DAYS * 24 * 60 * 60 * 1000)

    const candidates = await prisma.payment.findMany({
      where: {
        processorFee: null,
        // A refund does not un-charge the processor's fee, so refunded payments still need their
        // fee looked up — otherwise a refunded order's cost is silently missing from net revenue
        // and the ledger. Same "money arrived" set the ledger records against.
        status: { in: SETTLED_PAYMENT },
        createdAt: { gte: oldest },
      },
      select: {
        id: true,
        orderId: true,
        provider: true,
        createdAt: true,
        paidAt: true,
        processorFee: true,
        processorFeeCheckedAt: true,
        stripePaymentIntentId: true,
        paypalCaptureId: true,
        providerPaymentId: true,
        squarePaymentId: true,
      },
      orderBy: { createdAt: 'asc' },
      take: BATCH,
    })

    let checked = 0
    let resolved = 0
    const unresolved: Record<string, number> = {}

    for (const payment of candidates) {
      if (
        !isWorthCheckingFee({
          paidAt: payment.paidAt,
          createdAt: payment.createdAt,
          processorFee: payment.processorFee,
          processorFeeCheckedAt: payment.processorFeeCheckedAt,
          now,
        })
      ) {
        continue
      }

      checked += 1
      let feeCents: number | null = null
      let reason = 'unsupported provider'

      if (payment.provider === 'STRIPE' && payment.stripePaymentIntentId) {
        const result = await fetchStripeFee(payment.stripePaymentIntentId)
        feeCents = result.feeCents
        reason = result.reason ?? ''
      } else if (payment.provider === 'PAYPAL' && payment.paypalCaptureId) {
        const result = await fetchPayPalFee(payment.paypalCaptureId)
        feeCents = result.feeCents
        reason = result.reason ?? ''
      } else if (payment.provider === 'SQUARE') {
        // `squarePaymentId` first: on a terminal sale `providerPaymentId` can hold the
        // terminal *checkout* ID, which `payments.get` rejects as not found.
        const squareId = payment.squarePaymentId ?? payment.providerPaymentId
        if (squareId) {
          const result = await fetchSquareFee(squareId)
          feeCents = result.feeCents
          reason = result.reason ?? ''
        } else {
          reason = 'square payment has no payment id'
        }
      }

      // Stamp the attempt either way — that is what stops an unanswerable payment being
      // re-queried on every single tick.
      await prisma.payment.update({
        where: { id: payment.id },
        data: {
          processorFeeCheckedAt: now,
          ...(feeCents !== null ? { processorFee: feeCents } : {}),
        },
      })

      if (feeCents !== null) {
        resolved += 1
        // The fee is now known, so refresh this order's ledger rows — the live writer left the
        // PROCESSOR_FEES row off while the fee was still null. Idempotent, and never allowed to
        // fail the sweep. If it does fail, the row is not lost for good: `ledger:backfill`
        // re-records every settled order idempotently and is the reconciliation net for exactly
        // this gap.
        try {
          await recordOrderInLedger(payment.orderId)
        } catch (error) {
          console.warn('[cron/processor-fees] ledger refresh failed', { orderId: payment.orderId, error })
        }
      } else {
        unresolved[reason || 'unknown'] = (unresolved[reason || 'unknown'] ?? 0) + 1
      }
    }

    return NextResponse.json({
      success: true,
      candidates: candidates.length,
      checked,
      resolved,
      unresolved,
    })
  } catch (error) {
    console.error('Processor fee sweep error:', error)
    return NextResponse.json({ error: 'Cron failed' }, { status: 500 })
  }
}
