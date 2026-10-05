import { NextResponse } from 'next/server'
import { UnlockSchema, describeSeller, requireAppSession, unlockSession } from '@/lib/fundraiser-app/access'
import { fundraiserAppErrorResponse } from '@/lib/fundraiser-app/errors'

/** The personal PIN, asked for every time the app opens. */
export async function POST(request: Request) {
  try {
    const session = await requireAppSession(request)
    const parsed = UnlockSchema.safeParse(await request.json().catch(() => null))
    if (!parsed.success) {
      return NextResponse.json({ error: parsed.error.issues[0]?.message ?? 'Enter your PIN' }, { status: 400 })
    }
    await unlockSession(session, parsed.data.pin)
    return NextResponse.json(await describeSeller(session))
  } catch (error) {
    return fundraiserAppErrorResponse(error, 'Unlock failed')
  }
}
