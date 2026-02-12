import { NextRequest, NextResponse } from 'next/server'
import { getCurrentUser, isAdmin } from '@/lib/rbac'
import { prisma } from '@/lib/prisma'
import { getStripe } from '@/lib/stripe'
import { logAuditWithRequest } from '@/lib/audit'

export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    // Authentication & authorization
    const user = await getCurrentUser()
    if (!user || !isAdmin(user)) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const { id } = await params
    const body = await req.json()
    const { amount, reason } = body

    // Validate amount
    if (!amount || typeof amount !== 'number' || amount <= 0) {
      return NextResponse.json(
        { error: 'Invalid refund amount' },
        { status: 400 }
      )
    }

    // Fetch the order with payment details
    const order = await prisma.order.findUnique({
      where: { id },
      include: { items: true },
    })

    if (!order) {
      return NextResponse.json({ error: 'Order not found' }, { status: 404 })
    }

    // Check if order has been paid
    if (order.paymentStatus !== 'PAID') {
      return NextResponse.json(
        { error: 'Order has not been paid' },
        { status: 400 }
      )
    }

    // Check if order has a Stripe payment ID
    if (!order.stripePaymentId) {
      return NextResponse.json(
        { error: 'No Stripe payment found for this order' },
        { status: 400 }
      )
    }

    const stripe = getStripe()

    // Retrieve the payment intent to get the charge ID
    const paymentIntent = await stripe.paymentIntents.retrieve(
      order.stripePaymentId
    )

    const chargeId = paymentIntent.latest_charge as string
    if (!chargeId) {
      return NextResponse.json(
        { error: 'No charge found for this payment' },
        { status: 400 }
      )
    }

    // Validate refund amount doesn't exceed order total
    const orderTotalCents = Math.round(Number(order.total) * 100)
    const refundAmountCents = Math.round(amount * 100)

    if (refundAmountCents > orderTotalCents) {
      return NextResponse.json(
        { error: 'Refund amount exceeds order total' },
        { status: 400 }
      )
    }

    // Create refund in Stripe
    const refund = await stripe.refunds.create({
      charge: chargeId,
      amount: refundAmountCents,
      metadata: {
        orderId: order.id,
        orderNumber: order.orderNumber,
        refundedBy: user.id,
        reason: reason || 'Admin refund',
      },
    })

    // Log audit - wrap in try/catch to prevent blocking if audit fails
    try {
      await logAuditWithRequest(
        {
          userId: user.id,
          action: 'orders.refund',
          entityType: 'order',
          entityId: order.id,
          changes: {
            refundId: refund.id,
            amount: amount,
            reason: reason || 'Admin refund',
            status: refund.status,
          },
        },
        req
      )
    } catch (auditError) {
      console.error('Failed to log audit for refund:', refund.id, auditError)
      // Continue - refund was successful even if audit failed
    }

    return NextResponse.json({
      success: true,
      refund: {
        id: refund.id,
        amount: refund.amount / 100,
        status: refund.status,
        created: refund.created,
      },
    })
  } catch (error) {
    console.error('Refund error:', error)

    // Handle Stripe-specific errors
    if (error && typeof error === 'object' && 'type' in error) {
      const stripeError = error as any
      if (stripeError.type === 'StripeCardError') {
        return NextResponse.json(
          { error: stripeError.message },
          { status: 400 }
        )
      }
    }

    return NextResponse.json(
      { error: 'Unable to process refund' },
      { status: 500 }
    )
  }
}
