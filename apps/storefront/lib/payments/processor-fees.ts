import { getStripe } from '@/lib/stripe'
import { getPayPalAccessToken } from '@/lib/payments/providers/paypal'

/**
 * Look up what a processor actually charged for a payment.
 *
 * Done as a reconciliation pass rather than in the webhooks, for one reason that forces the
 * design: **Square usually does not know its own fee when `payment.completed` fires** — it
 * computes `processing_fee` after settlement, often hours later. Since a sweep is required
 * for Square no matter what, all three providers go through it. That also keeps an extra
 * network call out of the webhook handlers, which must not fail, and off the checkout path.
 *
 * Every lookup returns null rather than throwing on an unknown fee, because "we have not
 * been told yet" is the normal state for a recent payment and must stay distinguishable from
 * "the fee was zero".
 */

export interface FeeLookupResult {
  /** Fee in cents, or null when the processor cannot tell us yet. */
  feeCents: number | null
  /** Why it is null, for the log. Absent on success. */
  reason?: string
}

/**
 * Stripe keeps the fee on the balance transaction, not the payment intent, so it has to be
 * expanded — which is exactly the extra round trip we do not want inside a webhook.
 */
export async function fetchStripeFee(paymentIntentId: string): Promise<FeeLookupResult> {
  try {
    const stripe = getStripe()
    if (!stripe) return { feeCents: null, reason: 'stripe not configured' }

    const intent = await stripe.paymentIntents.retrieve(paymentIntentId, {
      expand: ['latest_charge.balance_transaction'],
    })

    const charge = intent.latest_charge
    if (!charge || typeof charge === 'string') {
      return { feeCents: null, reason: 'no expanded charge' }
    }

    const balanceTransaction = charge.balance_transaction
    if (!balanceTransaction || typeof balanceTransaction === 'string') {
      // Normal for a very recent payment: the balance transaction exists but is not
      // available until the charge settles.
      return { feeCents: null, reason: 'balance transaction not available yet' }
    }

    return { feeCents: balanceTransaction.fee }
  } catch (error) {
    return { feeCents: null, reason: `stripe lookup failed: ${(error as Error).message}` }
  }
}

/**
 * PayPal reports its cut on the capture's seller receivable breakdown, in currency units
 * rather than minor units — hence the conversion.
 */
export async function fetchPayPalFee(captureId: string): Promise<FeeLookupResult> {
  try {
    const clientId = process.env.PAYPAL_CLIENT_ID
    const clientSecret = process.env.PAYPAL_CLIENT_SECRET
    if (!clientId || !clientSecret) return { feeCents: null, reason: 'paypal not configured' }

    const baseUrl =
      process.env.PAYPAL_SANDBOX !== 'false'
        ? 'https://api-m.sandbox.paypal.com'
        : 'https://api-m.paypal.com'

    const accessToken = await getPayPalAccessToken(baseUrl, clientId, clientSecret)
    if (!accessToken) return { feeCents: null, reason: 'paypal auth failed' }

    const response = await fetch(`${baseUrl}/v2/payments/captures/${captureId}`, {
      headers: { Authorization: `Bearer ${accessToken}` },
    })
    if (!response.ok) {
      return { feeCents: null, reason: `paypal returned ${response.status}` }
    }

    const capture = await response.json()
    const fee = capture?.seller_receivable_breakdown?.paypal_fee?.value
    if (fee === undefined || fee === null) {
      return { feeCents: null, reason: 'no fee on capture' }
    }

    return { feeCents: Math.round(parseFloat(fee) * 100) }
  } catch (error) {
    return { feeCents: null, reason: `paypal lookup failed: ${(error as Error).message}` }
  }
}

/**
 * Square returns `processing_fee` as an array — a payment can carry more than one fee entry —
 * and frequently omits it entirely until the payment settles. Summing the array is correct;
 * treating an absent array as zero is not.
 */
export function readSquareFee(payment: {
  processing_fee?: Array<{ amount_money?: { amount?: number | bigint } }> | null
}): FeeLookupResult {
  const entries = payment.processing_fee
  if (!entries || entries.length === 0) {
    return { feeCents: null, reason: 'square has not settled the fee yet' }
  }

  let total = 0
  for (const entry of entries) {
    const amount = entry.amount_money?.amount
    if (amount === undefined || amount === null) {
      return { feeCents: null, reason: 'square fee entry missing an amount' }
    }
    total += Number(amount)
  }

  return { feeCents: total }
}

/**
 * How long to leave a payment before giving up on ever learning its fee.
 *
 * Settlement takes a couple of days at the outside; past a week the sweep would be
 * re-querying the same dead payments forever, which is cost with no information.
 */
export const FEE_LOOKUP_MAX_AGE_DAYS = 7

/** Whether a payment is still worth asking about. */
export function isWorthCheckingFee(input: {
  paidAt: Date | null
  createdAt: Date
  processorFee: number | null
  processorFeeCheckedAt: Date | null
  now: Date
}): boolean {
  if (input.processorFee !== null) return false

  const settledFrom = input.paidAt ?? input.createdAt
  const ageDays = (input.now.getTime() - settledFrom.getTime()) / (24 * 60 * 60 * 1000)
  if (ageDays > FEE_LOOKUP_MAX_AGE_DAYS) return false

  // Do not re-ask within the hour; nothing settles that fast, and the sweep runs often.
  if (input.processorFeeCheckedAt) {
    const sinceCheck = input.now.getTime() - input.processorFeeCheckedAt.getTime()
    if (sinceCheck < 60 * 60 * 1000) return false
  }

  return true
}
