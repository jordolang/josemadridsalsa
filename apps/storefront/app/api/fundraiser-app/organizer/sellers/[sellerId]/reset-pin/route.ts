import { NextResponse } from 'next/server'
import { requireAppSession } from '@/lib/fundraiser-app/access'
import { fundraiserAppErrorResponse } from '@/lib/fundraiser-app/errors'
import { resetSellerPin } from '@/lib/fundraiser-app/organizer'

/** Organizer only: clear a seller's PIN and sign their phones out so they can choose a new one. */
export async function POST(request: Request, { params }: { params: Promise<{ sellerId: string }> }) {
  try {
    const session = await requireAppSession(request, { unlocked: true })
    const { sellerId } = await params
    const seller = await resetSellerPin(session, sellerId)
    return NextResponse.json({ ok: true, seller: { id: seller.id, name: seller.name } })
  } catch (error) {
    return fundraiserAppErrorResponse(error, 'PIN reset failed')
  }
}
