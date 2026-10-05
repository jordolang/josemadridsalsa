import { NextResponse } from 'next/server'
import { ReclaimSchema, reclaimSeller, limitCredentialAttempts } from '@/lib/fundraiser-app/access'
import { fundraiserAppErrorResponse } from '@/lib/fundraiser-app/errors'

/** Get back in: pick your name and enter your PIN (or choose a new one after a reset). */
export async function POST(request: Request) {
  try {
    await limitCredentialAttempts(request)
    const parsed = ReclaimSchema.safeParse(await request.json().catch(() => null))
    if (!parsed.success) {
      return NextResponse.json({ error: parsed.error.issues[0]?.message ?? 'Check what you entered' }, { status: 400 })
    }
    return NextResponse.json(await reclaimSeller(parsed.data))
  } catch (error) {
    return fundraiserAppErrorResponse(error, 'Reclaim failed')
  }
}
