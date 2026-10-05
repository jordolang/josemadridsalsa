import { NextResponse } from 'next/server'
import { z } from 'zod'
import { requireAppSession } from '@/lib/fundraiser-app/access'
import { cancelCardOrder } from '@/lib/fundraiser-app/card-payments'
import { fundraiserAppErrorResponse } from '@/lib/fundraiser-app/errors'

export const dynamic = 'force-dynamic'

/** The card was declined or the customer backed out; cancels the order unless Square says it paid. */
export async function POST(request: Request, { params }: { params: Promise<{ orderId: string }> }) {
  try {
    const session = await requireAppSession(request, { unlocked: true })
    const orderId = z.string().min(1).max(64).parse((await params).orderId)
    return NextResponse.json(await cancelCardOrder(session, orderId))
  } catch (error) {
    return fundraiserAppErrorResponse(error, 'Card cancel failed')
  }
}
