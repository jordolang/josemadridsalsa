import { NextRequest, NextResponse } from 'next/server'
import { z } from 'zod'
import { prisma as db } from '@/lib/prisma'
import { checkRateLimit } from '@/lib/rate-limit/distributed'
import { normalizeGameCode } from '@/lib/arena/game-codes'

/**
 * POST /api/arena/game-codes/verify — public check used by the Battle Arena browser game.
 *
 * Body `{ code }`. Answers `{ valid: true, name }` with the group's name for a live code, or
 * `{ valid: false }` for an unknown or revoked one. The game is served from its own origin, so
 * the answer carries open CORS headers; it reveals nothing beyond the group name the code
 * already stands for, and a per-IP limit keeps codes from being guessed.
 */

const CORS = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
  'Access-Control-Allow-Headers': 'Content-Type',
  'Access-Control-Max-Age': '86400',
}

const VerifySchema = z.object({ code: z.string().max(40) })

export function OPTIONS() {
  return new NextResponse(null, { status: 204, headers: CORS })
}

export async function POST(req: NextRequest) {
  const ip = req.headers.get('x-forwarded-for')?.split(',')[0]?.trim() ?? 'unknown'
  const rl = await checkRateLimit({ identifier: `arena-game-code:${ip}`, maxRequests: 30, windowSeconds: 60 })
  if (!rl.allowed) {
    return NextResponse.json(
      { valid: false, error: 'Too many requests' },
      { status: 429, headers: { ...CORS, 'Retry-After': String(rl.resetIn) } },
    )
  }

  const parsed = VerifySchema.safeParse(await req.json().catch(() => ({})))
  if (!parsed.success) {
    return NextResponse.json({ valid: false, error: 'Invalid request' }, { status: 422, headers: CORS })
  }

  const code = normalizeGameCode(parsed.data.code)
  const row = code
    ? await db.arenaGameCode.findUnique({ where: { code }, select: { id: true, groupName: true, revokedAt: true } })
    : null
  if (!row || row.revokedAt) {
    return NextResponse.json({ valid: false }, { headers: CORS })
  }

  // best effort: a failed timestamp must not turn a good code away
  await db.arenaGameCode.update({ where: { id: row.id }, data: { lastUsedAt: new Date() } }).catch(() => undefined)
  return NextResponse.json({ valid: true, name: row.groupName }, { headers: CORS })
}
