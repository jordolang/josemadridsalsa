import { NextResponse } from 'next/server'
import { describeSeller, requireAppSession } from '@/lib/fundraiser-app/access'
import { fundraiserAppErrorResponse } from '@/lib/fundraiser-app/errors'

/** The signed-in seller, their group, and their sales so far. */
export async function GET(request: Request) {
  try {
    const session = await requireAppSession(request, { unlocked: true })
    return NextResponse.json(await describeSeller(session))
  } catch (error) {
    return fundraiserAppErrorResponse(error, 'Profile failed')
  }
}
