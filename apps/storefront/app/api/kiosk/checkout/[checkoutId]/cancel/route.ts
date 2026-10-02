import { NextResponse } from 'next/server'
import { requireKioskAccess } from '@/lib/kiosk/auth'
import { kioskErrorResponse } from '@/lib/kiosk/respond'
import { cancelTerminalCheckout } from '@/lib/pos/terminal-checkout'

/** The customer backed out: pull the charge off the Terminal and release the stock. */
export async function POST(request: Request, { params }: { params: Promise<{ checkoutId: string }> }) {
  try {
    await requireKioskAccess(request)
    const { checkoutId } = await params
    const { status } = await cancelTerminalCheckout(checkoutId)
    return NextResponse.json({ status })
  } catch (error) {
    return kioskErrorResponse(error, 'Cancel failed')
  }
}
