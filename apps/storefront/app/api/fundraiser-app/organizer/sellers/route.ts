import { NextResponse } from 'next/server'
import { requireAppSession } from '@/lib/fundraiser-app/access'
import { fundraiserAppErrorResponse } from '@/lib/fundraiser-app/errors'
import { listGroupSellers } from '@/lib/fundraiser-app/organizer'

/** Organizer only: everyone in the group, with sales and sign-in state. */
export async function GET(request: Request) {
  try {
    const session = await requireAppSession(request, { unlocked: true })
    return NextResponse.json({ sellers: await listGroupSellers(session) })
  } catch (error) {
    return fundraiserAppErrorResponse(error, 'Seller list failed')
  }
}
