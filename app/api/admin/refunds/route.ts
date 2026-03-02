import { NextResponse } from 'next/server'
import { z } from 'zod'
import { getStripe } from '@/lib/stripe'
import prisma from '@/lib/prisma'

const RefundRequestSchema = z.object({
  paymentId: z.string().min(1, 'Payment ID is required'),
  amount: z.number().positive('Amount must be greater than 0').optional(),
  reason: z.string().optional(),
})

export async function POST(request: Request) {
  try {
    const json = await request.json()
    const parsed = RefundRequestSchema.safeParse(json)

    if (!parsed.success) {
      return NextResponse.json(
        { error: 'Invalid refund request data', details: parsed.error.flatten() },
        { status: 400 }
      )
    }

    const { paymentId, amount, reason } = parsed.data
    const stripe = getStripe()

    // Wrap refund amount computation, Stripe call, and payment update in a single
    // transaction to prevent double-refund race conditions.
    const result = await prisma.$transaction(async (tx) => {
      // Re-fetch payment with refunds inside transaction for consistent state
      const payment = await tx.payment.findUnique({
        where: { id: paymentId },
        include: { refunds: true },
      })

      if (!payment) throw Object.assign(new Error('Payment not found'), { code: 'NOT_FOUND' })

      if (payment.status !== 'SUCCEEDED') {
        throw Object.assign(new Error('Can only refund successful payments'), { code: 'NOT_SUCCEEDED' })
      }

      // Calculate refundable amount within the transaction
      const totalRefunded = payment.refunds.reduce((sum, refund) => {
        if (refund.status === 'SUCCEEDED') {
          return sum + refund.amount
        }
        return sum
      }, 0)

      const refundableAmount = payment.amount - totalRefunded
      const refundAmount = amount || refundableAmount

      if (refundAmount > refundableAmount) {
        throw Object.assign(
          new Error(`Cannot refund ${refundAmount} cents. Only ${refundableAmount} cents available for refund.`),
          { code: 'EXCEEDS_REFUNDABLE' }
        )
      }

      if (refundAmount <= 0) {
        throw Object.assign(new Error('Refund amount must be greater than 0'), { code: 'INVALID_AMOUNT' })
      }

      // Process refund through Stripe
      const stripeRefund = await stripe.refunds.create({
        payment_intent: payment.stripePaymentIntentId!,
        amount: refundAmount,
        reason: reason as 'duplicate' | 'fraudulent' | 'requested_by_customer' | undefined,
      })

      // Create refund record in database
      const refund = await tx.refund.create({
        data: {
          stripeRefundId: stripeRefund.id,
          amount: refundAmount,
          reason: reason || undefined,
          status: stripeRefund.status === 'succeeded' ? 'SUCCEEDED' : 'PENDING',
          paymentId: payment.id,
          processedAt: stripeRefund.status === 'succeeded' ? new Date() : null,
        },
      })

      // Fix: only update paymentStatus when the Stripe refund status is 'succeeded'
      if (stripeRefund.status === 'succeeded') {
        const newTotalRefunded = totalRefunded + refundAmount
        const newPaymentStatus =
          newTotalRefunded >= payment.amount ? 'REFUNDED' : 'PARTIALLY_REFUNDED'

        await tx.payment.update({
          where: { id: payment.id },
          data: { status: newPaymentStatus },
        })
      }

      return refund
    })

    return NextResponse.json({
      refundId: result.id,
      status: result.status.toLowerCase(),
    })
  } catch (error) {
    const err = error as Error & { code?: string }
    if (err.code === 'NOT_FOUND') {
      return NextResponse.json({ error: 'Payment not found' }, { status: 404 })
    }
    if (err.code === 'NOT_SUCCEEDED') {
      return NextResponse.json({ error: 'Can only refund successful payments' }, { status: 400 })
    }
    if (err.code === 'EXCEEDS_REFUNDABLE' || err.code === 'INVALID_AMOUNT') {
      return NextResponse.json({ error: err.message }, { status: 400 })
    }
    console.error('Refund processing error:', error)
    return NextResponse.json(
      { error: 'Unable to process refund. Please try again.' },
      { status: 500 }
    )
  }
}
