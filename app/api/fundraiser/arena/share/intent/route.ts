import { NextRequest, NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { z } from 'zod'
import { authOptions } from '@/lib/auth'
import { prisma as db } from '@/lib/prisma'
import { rateLimit } from '@/lib/rateLimit'
import { createShareNonce, type SharePlatform } from '@/lib/arena/share-nonce'

const IntentPayload = z.object({
  teamId: z.string().min(1).max(40),
  platform: z
    .enum(['facebook', 'x', 'instagram', 'tiktok', 'other'])
    .default('facebook'),
})

/**
 * POST /api/fundraiser/arena/share/intent
 *
 * Mints a single-use HMAC-signed nonce the client embeds in a social
 * share URL. When the sharer (or a clicker) lands on `/s/[nonce]`, the
 * redemption endpoint verifies the signature, enforces anti-cheat
 * quotas, and activates the team's shield.
 *
 * Auth: NextAuth session required.
 * Rate limit: 20 intents/min/IP to prevent nonce-minting floods.
 */
export async function POST(req: NextRequest) {
  const ip =
    req.headers.get('x-forwarded-for')?.split(',')[0]?.trim() ?? 'unknown'
  const rl = rateLimit(`share-intent:${ip}`, 20, 60_000)
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

  const parsed = IntentPayload.safeParse(await req.json().catch(() => ({})))
  if (!parsed.success) {
    return NextResponse.json(
      { success: false, error: 'Invalid request' },
      { status: 422 },
    )
  }

  const team = await db.fundraiserTeam.findUnique({
    where: { id: parsed.data.teamId },
    select: { id: true, status: true, slug: true },
  })
  if (!team || team.status !== 'ACTIVE') {
    return NextResponse.json(
      { success: false, error: 'Team not found or inactive' },
      { status: 404 },
    )
  }

  const minted = await createShareNonce({
    userId: session.user.id,
    teamId: team.id,
    platform: parsed.data.platform as SharePlatform,
  })

  const origin =
    process.env.APP_URL ??
    req.headers.get('origin') ??
    new URL(req.url).origin

  return NextResponse.json({
    success: true,
    nonce: minted.nonce,
    shareUrl: `${origin}/s/${minted.nonce}`,
    teamSlug: team.slug,
    expiresAt: minted.expiresAt.toISOString(),
  })
}
