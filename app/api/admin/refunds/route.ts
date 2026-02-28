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

    // Fetch payment details
    const payment = await prisma.payment.findUnique({
      where: { id: paymentId },
      include: { refunds: true },
    })

    if (!payment) {
      return NextResponse.json({ error: 'Payment not found' }, { status: 404 })
    }

    if (payment.status !== 'SUCCEEDED') {
      return NextResponse.json(
        { error: 'Can only refund successful payments' },
        { status: 400 }
      )
    }

    // Calculate refundable amount
    const totalRefunded = payment.refunds.reduce((sum, refund) => {
      if (refund.status === 'SUCCEEDED') {
        return sum + refund.amount
      }
      return sum
    }, 0)

    const refundableAmount = payment.amount - totalRefunded
    const refundAmount = amount || refundableAmount

    if (refundAmount > refundableAmount) {
      return NextResponse.json(
        {
          error: `Cannot refund ${refundAmount} cents. Only ${refundableAmount} cents available for refund.`,
        },
        { status: 400 }
      )
    }

    if (refundAmount <= 0) {
      return NextResponse.json(
        { error: 'Refund amount must be greater than 0' },
        { status: 400 }
      )
    }

    // Process refund through Stripe
    const stripe = getStripe()

    const stripeRefund = await stripe.refunds.create({
      payment_intent: payment.stripePaymentIntentId,
      amount: refundAmount,
      reason: reason as 'duplicate' | 'fraudulent' | 'requested_by_customer' | undefined,
    })

    // Create refund record in database
    const refund = await prisma.refund.create({
      data: {
        stripeRefundId: stripeRefund.id,
        amount: refundAmount,
        reason: reason || undefined,
        status: stripeRefund.status === 'succeeded' ? 'SUCCEEDED' : 'PENDING',
        paymentId: payment.id,
        processedAt: stripeRefund.status === 'succeeded' ? new Date() : null,
      },
    })

    // Update payment status
    const newTotalRefunded = totalRefunded + refundAmount
    const newPaymentStatus =
      newTotalRefunded >= payment.amount ? 'REFUNDED' : 'PARTIALLY_REFUNDED'

    await prisma.payment.update({
      where: { id: payment.id },
      data: { status: newPaymentStatus },
    })

    return NextResponse.json({
      refundId: refund.id,
      status: refund.status.toLowerCase(),
    })
  } catch (error) {
    console.error('Refund processing error:', error)
    return NextResponse.json(
      { error: 'Unable to process refund. Please try again.' },
      { status: 500 }
    )
  }
}
