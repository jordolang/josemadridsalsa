import { NextResponse } from 'next/server'
import { z } from 'zod'
import prisma from '@/lib/prisma'
import { requirePermission } from '@/lib/rbac'
import { logAuditWithRequest } from '@/lib/audit'
import { refundPaymentInTx } from '@/lib/payments/refund'

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
    // transaction to prevent double-refund race conditions. The body lives in
    // `lib/payments/refund.ts` so return completion refunds through the same code.
    const result = await prisma.$transaction(async (tx) =>
      refundPaymentInTx(tx, { paymentId, amountCents: amount, reason })
    )

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
