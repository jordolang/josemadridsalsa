import { NextResponse } from 'next/server'
import { requireAppSession } from '@/lib/fundraiser-app/access'
import { squareAuthorizationFor } from '@/lib/fundraiser-app/card-payments'
import { fundraiserAppErrorResponse } from '@/lib/fundraiser-app/errors'

export const dynamic = 'force-dynamic'

/** The Square sign-in for the phone's payment SDK, for groups with card payments turned on. */
export async function GET(request: Request) {
  try {
    const session = await requireAppSession(request, { unlocked: true })
    return NextResponse.json(await squareAuthorizationFor(session), { headers: { 'Cache-Control': 'no-store' } })
  } catch (error) {
    return fundraiserAppErrorResponse(error, 'Square sign-in failed')
  }
}
