import { countPlayersOnline } from '@/lib/arena-game/friends'
import { isMissingTableError } from '@/lib/prisma-errors'
import { errorResponse, json, preflight } from '@/lib/arena-game/http'
import type { BattleLiveStatus } from '@/lib/arena-game/links'

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'

export function OPTIONS(request: Request) {
  return preflight(request, 'public')
}

/**
 * GET /api/arena/live: how many signed-in players have the game open right now (their game
 * checked in within the last 90 seconds). Public: a count only. Drives the nav's Battle Live dot.
 */
export async function GET(request: Request) {
  try {
    const body: BattleLiveStatus = { playing: await countPlayersOnline() }
    return json(request, 'public', body, {
      headers: { 'Cache-Control': 'public, s-maxage=20, stale-while-revalidate=40' },
    })
  } catch (error) {
    // A database without the arena tables (P2021) has no one playing; report 0 rather
    // than failing the nav's Battle Live dot on every page.
    if (isMissingTableError(error)) {
      return json(request, 'public', { playing: 0 } satisfies BattleLiveStatus)
    }
    return errorResponse(request, 'public', error, 'Live player count failed')
  }
}
