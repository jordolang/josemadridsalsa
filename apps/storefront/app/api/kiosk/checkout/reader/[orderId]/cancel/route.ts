import { NextResponse } from 'next/server'
import { z } from 'zod'
import { requireKioskAccess } from '@/lib/kiosk/auth'
import { kioskErrorResponse } from '@/lib/kiosk/respond'
import { cancelReaderOrder } from '@/lib/pos/reader-checkout'

/**
 * The customer backed out or the card was declined: release the stock and close the order —
 * unless Square shows the payment went through after all, in which case the sale stands.
 */
export async function POST(request: Request, { params }: { params: Promise<{ orderId: string }> }) {
  try {
    await requireKioskAccess(request)
    const orderId = z.string().min(1).max(64).parse((await params).orderId)
    const { status, orderNumber } = await cancelReaderOrder(orderId)
    return NextResponse.json({ status, orderNumber })
  } catch (error) {
    return kioskErrorResponse(error, 'Cancel failed')
  }
}
