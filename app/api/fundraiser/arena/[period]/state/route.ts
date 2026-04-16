import { NextRequest, NextResponse } from 'next/server'
import { rateLimit } from '@/lib/rateLimit'
import { loadArenaSnapshot } from '@/lib/arena/server-state'

export const dynamic = 'force-dynamic'

/**
 * GET /api/fundraiser/arena/[period]/state
 *
 * Returns the current arena snapshot for a period. Used by the client-side
 * polling hook in `lib/arena/use-arena-state.ts`. Public (no auth) — the
 * data is the same spectator view shown on the arena page.
 *
 * Rate-limited at 120 req/min per IP. The snapshot is not cached on the
 * edge because the whole point is up-to-date HP/shield state.
 */
export async function GET(
  req: NextRequest,
  { params }: { params: Promise<{ period: string }> },
) {
  const ip =
    req.headers.get('x-forwarded-for')?.split(',')[0]?.trim() ?? 'unknown'
  const rl = rateLimit(`arena-state:${ip}`, 120, 60_000)
  if (!rl.allowed) {
    return NextResponse.json(
      { success: false, error: 'Too many requests' },
      {
        status: 429,
        headers: { 'Retry-After': String(Math.ceil(rl.retryAfterMs / 1000)) },
      },
    )
  }

  const { period } = await params
  if (!/^\d{4}-\d{2}$/.test(period)) {
    return NextResponse.json(
      { success: false, error: 'period must be YYYY-MM' },
      { status: 400 },
    )
  }

  const snapshot = await loadArenaSnapshot(period)
  return NextResponse.json(
    { success: true, snapshot },
    {
      headers: {
        'Cache-Control': 'no-store',
      },
    },
  )
}
