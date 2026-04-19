import { NextRequest, NextResponse } from 'next/server'
import { prisma as db } from '@/lib/prisma'
import { rateLimit } from '@/lib/rateLimit'
import {
  isAllowedShareReferer,
  verifyAndConsumeNonce,
} from '@/lib/arena/share-nonce'

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'

/**
 * GET /s/[nonce]
 *
 * Redeems a signed share-intent token: verifies the HMAC, enforces
 * anti-cheat quotas, activates the team's shield, and redirects the
 * visitor to the team page. Any rejection still 302s to the team page
 * (if known) with a `?shareStatus=` query param so the UI can explain.
 *
 * Referer allowlist is soft — mobile browsers often strip `Referer`,
 * so a missing or unparseable value logs a warning but does not block.
 */
export async function GET(
  req: NextRequest,
  { params }: { params: Promise<{ nonce: string }> },
) {
  const { nonce } = await params

  const ip =
    req.headers.get('x-forwarded-for')?.split(',')[0]?.trim() ?? 'unknown'
  const rl = rateLimit(`share-redeem:${ip}`, 60, 60_000)
  if (!rl.allowed) {
    return new NextResponse('Too many requests', {
      status: 429,
      headers: { 'Retry-After': String(Math.ceil(rl.retryAfterMs / 1000)) },
    })
  }

  const referer = req.headers.get('referer')
  if (!isAllowedShareReferer(referer)) {
    console.warn(
      `/s/[nonce] redeem with disallowed referer=${referer} ip=${ip} (soft-allow per policy)`,
    )
  }

  const result = await verifyAndConsumeNonce(nonce)
  if (!result.ok) {
    console.warn(
      `/s/[nonce] redeem failed: ${result.reason}${
        'limit' in result ? ` (${result.limit})` : ''
      } ip=${ip}`,
    )
    return redirectWithStatus(req, null, result.reason)
  }

  // Load team slug for the redirect (the consumed nonce has the teamId
  // but not the slug). If lookup fails, bounce to home.
  const team = await db.fundraiserTeam.findUnique({
    where: { id: result.teamId },
    select: { slug: true },
  })

  // Grant already recorded in the transaction. Now activate the shield.
  // Swallow shield-service errors so a failure here still redirects the
  // user — the grant stays as audit evidence.
  try {
    const { activateShieldForUser } = await import(
      '@/lib/arena/shield-service'
    )
    await activateShieldForUser({
      teamId: result.teamId,
      userId: result.userId,
      platform: result.platform,
    })
  } catch (err) {
    console.error('share redeem: activateShieldForUser failed', err)
  }

  return redirectWithStatus(req, team?.slug ?? null, 'activated')
}

function redirectWithStatus(
  req: NextRequest,
  teamSlug: string | null,
  status: string,
): NextResponse {
  const origin =
    process.env.APP_URL ??
    req.headers.get('origin') ??
    new URL(req.url).origin
  const target = teamSlug
    ? `${origin}/fundraise/${teamSlug}?shareStatus=${encodeURIComponent(status)}`
    : `${origin}/?shareStatus=${encodeURIComponent(status)}`
  return NextResponse.redirect(target, 302)
}
