import { NextResponse } from 'next/server'
import { GroupCredentialsSchema, listRoster, limitCredentialAttempts } from '@/lib/fundraiser-app/access'
import { fundraiserAppErrorResponse } from '@/lib/fundraiser-app/errors'

/** The names to pick from when getting back into the app. */
export async function POST(request: Request) {
  try {
    await limitCredentialAttempts(request)
    const parsed = GroupCredentialsSchema.safeParse(await request.json().catch(() => null))
    if (!parsed.success) {
      return NextResponse.json({ error: parsed.error.issues[0]?.message ?? 'Check what you entered' }, { status: 400 })
    }
    return NextResponse.json({ sellers: await listRoster(parsed.data) })
  } catch (error) {
    return fundraiserAppErrorResponse(error, 'Roster failed')
  }
}
