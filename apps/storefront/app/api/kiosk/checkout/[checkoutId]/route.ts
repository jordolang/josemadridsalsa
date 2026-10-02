import { NextResponse } from 'next/server'
import { requireKioskAccess } from '@/lib/kiosk/auth'
import { kioskErrorResponse } from '@/lib/kiosk/respond'
import { syncTerminalCheckout } from '@/lib/pos/terminal-checkout'

export const dynamic = 'force-dynamic'

/** Poll the Terminal; a completed payment finalizes the order as a side effect. */
export async function GET(request: Request, { params }: { params: Promise<{ checkoutId: string }> }) {
  try {
    await requireKioskAccess(request)
    const { checkoutId } = await params
    const { status, orderNumber } = await syncTerminalCheckout(checkoutId)
    return NextResponse.json({ status, orderNumber })
  } catch (error) {
    return kioskErrorResponse(error, 'Status check failed')
  }
}
