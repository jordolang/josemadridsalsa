import { NextResponse } from 'next/server'
import { z } from 'zod'
import { requireAppSession } from '@/lib/fundraiser-app/access'
import { confirmCardPayment } from '@/lib/fundraiser-app/card-payments'
import { fundraiserAppErrorResponse } from '@/lib/fundraiser-app/errors'

export const dynamic = 'force-dynamic'

const OrderId = z.string().min(1).max(64)
const Body = z.object({ paymentId: z.string().min(1).max(192).optional() })

/** The phone took the card. Square is asked directly whether that payment pays this order. */
export async function POST(request: Request, { params }: { params: Promise<{ orderId: string }> }) {
  try {
    const session = await requireAppSession(request, { unlocked: true })
    const orderId = OrderId.parse((await params).orderId)
    const parsed = Body.safeParse(await request.json().catch(() => ({})))
    if (!parsed.success) return NextResponse.json({ error: 'Invalid payment' }, { status: 400 })
    return NextResponse.json(await confirmCardPayment(session, orderId, parsed.data.paymentId))
  } catch (error) {
    return fundraiserAppErrorResponse(error, 'Card confirmation failed')
  }
}

/** Ask Square whether a card payment for this order went through (the phone lost track). */
export async function GET(request: Request, { params }: { params: Promise<{ orderId: string }> }) {
  try {
    const session = await requireAppSession(request, { unlocked: true })
    const orderId = OrderId.parse((await params).orderId)
    return NextResponse.json(await confirmCardPayment(session, orderId))
  } catch (error) {
    return fundraiserAppErrorResponse(error, 'Card status check failed')
  }
}
