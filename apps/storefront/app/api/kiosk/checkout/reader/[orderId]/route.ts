import { NextResponse } from 'next/server'
import { z } from 'zod'
import { requireKioskAccess } from '@/lib/kiosk/auth'
import { kioskErrorResponse } from '@/lib/kiosk/respond'
import { confirmReaderPayment } from '@/lib/pos/reader-checkout'

export const dynamic = 'force-dynamic'

const OrderId = z.string().min(1).max(64)
const Body = z.object({ paymentId: z.string().min(1).max(192).optional() })

/**
 * The iPad took a card on its Square Reader. Square is asked directly whether that payment
 * really pays this order before the order is marked paid.
 */
export async function POST(request: Request, { params }: { params: Promise<{ orderId: string }> }) {
  try {
    await requireKioskAccess(request)
    const orderId = OrderId.parse((await params).orderId)
    const parsed = Body.safeParse(await request.json().catch(() => ({})))
    if (!parsed.success) return NextResponse.json({ error: 'Invalid payment' }, { status: 400 })
    const { status, orderNumber } = await confirmReaderPayment(orderId, parsed.data.paymentId)
    return NextResponse.json({ status, orderNumber })
  } catch (error) {
    return kioskErrorResponse(error, 'Payment confirmation failed')
  }
}

/** Ask Square whether a payment for this order has gone through (when the iPad lost track). */
export async function GET(request: Request, { params }: { params: Promise<{ orderId: string }> }) {
  try {
    await requireKioskAccess(request)
    const orderId = OrderId.parse((await params).orderId)
    const { status, orderNumber } = await confirmReaderPayment(orderId)
    return NextResponse.json({ status, orderNumber })
  } catch (error) {
    return kioskErrorResponse(error, 'Status check failed')
  }
}
