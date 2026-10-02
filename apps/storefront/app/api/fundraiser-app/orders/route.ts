import { NextResponse } from 'next/server'
import { requireAppSession } from '@/lib/fundraiser-app/access'
import { fundraiserAppErrorResponse } from '@/lib/fundraiser-app/errors'
import { PhoneOrderSchema, createPhoneOrder, listSellerOrders } from '@/lib/fundraiser-app/orders'

/** The seller's own orders. */
export async function GET(request: Request) {
  try {
    const session = await requireAppSession(request, { unlocked: true })
    return NextResponse.json({ orders: await listSellerOrders(session) })
  } catch (error) {
    return fundraiserAppErrorResponse(error, 'Order list failed')
  }
}

/** Record an order the seller took. Priced on the server from the group's store. */
export async function POST(request: Request) {
  try {
    const session = await requireAppSession(request, { unlocked: true })
    const parsed = PhoneOrderSchema.safeParse(await request.json().catch(() => null))
    if (!parsed.success) {
      return NextResponse.json({ error: parsed.error.issues[0]?.message ?? 'Check the order' }, { status: 400 })
    }
    const order = await createPhoneOrder(session, parsed.data)
    return NextResponse.json({ order }, { status: order.duplicate ? 200 : 201 })
  } catch (error) {
    return fundraiserAppErrorResponse(error, 'Order failed')
  }
}
