import { NextResponse } from 'next/server'
import { GroupCredentialsSchema, checkGroup, limitCredentialAttempts } from '@/lib/fundraiser-app/access'
import { fundraiserAppErrorResponse } from '@/lib/fundraiser-app/errors'

/** Setup, step one: check the group ID and group PIN. */
export async function POST(request: Request) {
  try {
    await limitCredentialAttempts(request)
    const parsed = GroupCredentialsSchema.safeParse(await request.json().catch(() => null))
    if (!parsed.success) {
      return NextResponse.json({ error: parsed.error.issues[0]?.message ?? 'Check what you entered' }, { status: 400 })
    }
    return NextResponse.json({ group: await checkGroup(parsed.data) })
  } catch (error) {
    return fundraiserAppErrorResponse(error, 'Group check failed')
  }
}
