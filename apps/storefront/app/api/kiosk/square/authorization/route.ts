import { NextResponse } from 'next/server'
import { KioskAuthError, requireKioskAccess } from '@/lib/kiosk/auth'
import { kioskErrorResponse } from '@/lib/kiosk/respond'
import { SquareOAuthError, getSquareReaderToken } from '@/lib/square/oauth'

export const dynamic = 'force-dynamic'

/**
 * The Square sign-in for a paired kiosk iPad's card reader: an OAuth access token and the
 * location to take payments at. Only a paired kiosk (its device token) gets it — not a staff
 * browser, which has no reader and no reason to hold a payments token.
 */
export async function GET(request: Request) {
  try {
    if ((await requireKioskAccess(request)) !== 'device') {
      throw new KioskAuthError('Only a paired kiosk can sign in to Square.')
    }
    const locationId = process.env.SQUARE_LOCATION_ID
    if (!locationId) return NextResponse.json({ error: 'SQUARE_LOCATION_ID is not set' }, { status: 503 })
    const { accessToken, expiresAt } = await getSquareReaderToken()
    return NextResponse.json({ accessToken, expiresAt, locationId }, { headers: { 'Cache-Control': 'no-store' } })
  } catch (error) {
    if (error instanceof SquareOAuthError) return NextResponse.json({ error: error.message }, { status: 503 })
    return kioskErrorResponse(error, 'Square sign-in failed')
  }
}
