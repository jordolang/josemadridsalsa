import { NextResponse } from 'next/server'
import { z } from 'zod'
import prisma from '@/lib/prisma'
import { requirePermission } from '@/lib/rbac'
import { logAuditWithRequest } from '@/lib/audit'
import { getProvider } from '@/lib/payments'
import type { PaymentProvider } from '@/lib/payments/types'

const RefundRequestSchema = z.object({
  paymentId: z.string().min(1, 'Payment ID is required'),
  amount: z.number().positive('Amount must be greater than 0').optional(),
  reason: z.string().optional(),
})

export async function POST(request: Request) {
  try {
    const actor = await requirePermission('orders:write')

    const json = await request.json()
    const parsed = RefundRequestSchema.safeParse(json)

    if (!parsed.success) {
      return NextResponse.json(
        { error: 'Invalid refund request data', details: parsed.error.flatten() },
        { status: 400 }
      )
    }

    const { paymentId, amount, reason } = parsed.data

    // Wrap refund amount computation, provider call, and payment update in a single
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

      // Resolve the provider payment ID based on which provider processed the payment
      const provider = (payment.provider || 'STRIPE') as PaymentProvider
      const providerPaymentId =
        payment.providerPaymentId ||
        payment.stripePaymentIntentId ||
        payment.squarePaymentId ||
        payment.paypalCaptureId

      if (!providerPaymentId) {
        throw Object.assign(new Error('No provider payment ID found for this payment'), { code: 'NO_PROVIDER_ID' })
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

      // Process refund through the appropriate provider adapter
      const adapter = getProvider(provider)
      const refundResult = await adapter.refund({
        providerPaymentId,
        amount: refundAmount,
        reason,
      })

      if (!refundResult.success) {
        throw Object.assign(
          new Error(refundResult.error || 'Refund failed at payment provider'),
          { code: 'PROVIDER_ERROR' }
        )
      }

      // Create refund record in database
      // stripeRefundId is provider-agnostic despite the name (see Refund.provider), and it
      // is UNIQUE — the previous `provider === 'STRIPE' ? id : ''` wrote an empty string for
      // every PayPal and Square refund, so the second non-Stripe refund ever taken would hit
      // the unique constraint and roll the whole refund back. Store the real provider ID.
      if (!refundResult.providerRefundId) {
        // Fail rather than synthesise an ID. A fabricated identifier in a financial table
        // can never be reconciled against the processor, which is worse than a refund that
        // visibly failed to record — the money moved, so this needs a human to look at it.
        throw Object.assign(
          new Error(
            `${provider} reported a ${refundResult.status} refund with no refund ID; refund not recorded`
          ),
          { code: 'PROVIDER_ERROR' }
        )
      }

      const refund = await tx.refund.create({
        data: {
          stripeRefundId: refundResult.providerRefundId,
          provider,
          amount: refundAmount,
          reason: reason || undefined,
          status: refundResult.status,
          paymentId: payment.id,
          processedAt: refundResult.status === 'SUCCEEDED' ? new Date() : null,
        },
      })

      // Update payment status when refund succeeds
      if (refundResult.status === 'SUCCEEDED') {
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

    // Logged after the transaction commits, so a rolled-back refund leaves no audit entry
    // claiming money moved. Amounts are in cents, matching the Refund record.
    await logAuditWithRequest(
      {
        userId: actor.id,
        action: 'refund',
        entityType: 'payment',
        entityId: paymentId,
        changes: {
          refundId: result.id,
          amount: result.amount,
          status: result.status,
          reason: reason ?? null,
        },
      },
      request
    )

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
    if (err.code === 'NO_PROVIDER_ID') {
      return NextResponse.json({ error: 'Payment has no provider reference' }, { status: 400 })
    }
    if (err.code === 'PROVIDER_ERROR') {
      return NextResponse.json({ error: 'Refund failed at payment provider' }, { status: 502 })
    }
    console.error('Refund processing error:', error)
    return NextResponse.json(
      { error: 'Unable to process refund. Please try again.' },
      { status: 500 }
    )
  }
}
