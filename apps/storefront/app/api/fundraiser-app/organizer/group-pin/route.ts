import { NextResponse } from 'next/server'
import { UnlockSchema, requireAppSession } from '@/lib/fundraiser-app/access'
import { fundraiserAppErrorResponse } from '@/lib/fundraiser-app/errors'
import { changeGroupPin } from '@/lib/fundraiser-app/organizer'

/** Organizer only: a new group PIN for future sign-ups. */
export async function POST(request: Request) {
  try {
    const session = await requireAppSession(request, { unlocked: true })
    const parsed = UnlockSchema.safeParse(await request.json().catch(() => null))
    if (!parsed.success) {
      return NextResponse.json({ error: parsed.error.issues[0]?.message ?? 'Enter a PIN' }, { status: 400 })
    }
    await changeGroupPin(session, parsed.data.pin)
    return NextResponse.json({ ok: true })
  } catch (error) {
    return fundraiserAppErrorResponse(error, 'Group PIN change failed')
  }
}
