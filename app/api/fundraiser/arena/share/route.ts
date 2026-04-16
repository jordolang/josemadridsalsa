import { NextRequest, NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { z } from 'zod'
import { authOptions } from '@/lib/auth'
import { rateLimit } from '@/lib/rateLimit'
import { activateShieldForUser } from '@/lib/arena/shield-service'

const SharePayload = z.object({
  teamId: z.string().min(1).max(40),
  platform: z
    .enum(['facebook', 'x', 'instagram', 'tiktok', 'other'])
    .default('facebook'),
})

/**
 * POST /api/fundraiser/arena/share
 *
 * User-initiated share that activates (or extends) the team's shield.
 * Auth: NextAuth session. Consecutive-share throttling is enforced inside
 * the shield service transaction.
 */
export async function POST(req: NextRequest) {
  const ip =
    req.headers.get('x-forwarded-for')?.split(',')[0]?.trim() ?? 'unknown'
  const rl = rateLimit(`arena-share:${ip}`, 10, 60_000)
  if (!rl.allowed) {
    return NextResponse.json(
      { success: false, error: 'Too many requests' },
      {
        status: 429,
        headers: { 'Retry-After': String(Math.ceil(rl.retryAfterMs / 1000)) },
      },
    )
  }

  const session = await getServerSession(authOptions)
  if (!session?.user?.id) {
    return NextResponse.json(
      { success: false, error: 'Unauthorized' },
      { status: 401 },
    )
  }

  const parsed = SharePayload.safeParse(await req.json().catch(() => ({})))
  if (!parsed.success) {
    return NextResponse.json(
      { success: false, error: 'Invalid request' },
      { status: 422 },
    )
  }

  try {
    const result = await activateShieldForUser({
      teamId: parsed.data.teamId,
      userId: session.user.id,
      platform: parsed.data.platform,
    })

    if (!result.activated && !result.extended) {
      return NextResponse.json(
        {
          success: false,
          error:
            'You have hit the consecutive-share limit for this team. Another supporter needs to share before you can again.',
          reason: result.reason,
        },
        { status: 429 },
      )
    }

    return NextResponse.json({ success: true, ...result })
  } catch (err) {
    const message = err instanceof Error ? err.message : 'Unknown error'
    const status = message.includes('not found') ? 404 : 500
    return NextResponse.json(
      { success: false, error: message },
      { status },
    )
  }
}
