import { NextResponse } from 'next/server'
import { requireKioskAccess } from '@/lib/kiosk/auth'
import { KioskCartSchema, startKioskCheckout } from '@/lib/kiosk/checkout'
import { kioskErrorResponse } from '@/lib/kiosk/respond'

/** Price the cart and send the total to the Square Terminal. */
export async function POST(request: Request) {
  try {
    await requireKioskAccess(request)
    const parsed = KioskCartSchema.safeParse(await request.json().catch(() => null))
    if (!parsed.success) {
      return NextResponse.json({ error: parsed.error.issues[0]?.message ?? 'Invalid order' }, { status: 400 })
    }
    const { checkoutId, orderNumber, quote } = await startKioskCheckout(parsed.data)
    return NextResponse.json({ checkoutId, orderNumber, quote })
  } catch (error) {
    return kioskErrorResponse(error, 'Checkout failed')
  }
}
