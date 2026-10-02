import { NextResponse } from 'next/server'
import { requireAppSession, signOutSession } from '@/lib/fundraiser-app/access'
import { fundraiserAppErrorResponse } from '@/lib/fundraiser-app/errors'

/** Sign this phone out. The seller can come back with "I already joined". */
export async function POST(request: Request) {
  try {
    const session = await requireAppSession(request)
    await signOutSession(session)
    return NextResponse.json({ ok: true })
  } catch (error) {
    return fundraiserAppErrorResponse(error, 'Sign-out failed')
  }
}
