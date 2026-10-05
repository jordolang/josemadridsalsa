import { NextResponse } from 'next/server'
import { RegisterSchema, registerSeller, limitCredentialAttempts } from '@/lib/fundraiser-app/access'
import { fundraiserAppErrorResponse } from '@/lib/fundraiser-app/errors'

/** First-time setup: join the group by name and choose a personal PIN. */
export async function POST(request: Request) {
  try {
    await limitCredentialAttempts(request)
    const parsed = RegisterSchema.safeParse(await request.json().catch(() => null))
    if (!parsed.success) {
      return NextResponse.json({ error: parsed.error.issues[0]?.message ?? 'Check what you entered' }, { status: 400 })
    }
    return NextResponse.json(await registerSeller(parsed.data), { status: 201 })
  } catch (error) {
    return fundraiserAppErrorResponse(error, 'Registration failed')
  }
}
