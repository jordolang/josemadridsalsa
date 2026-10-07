import { countPlayersOnline } from '@/lib/arena-game/friends'
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
    return errorResponse(request, 'public', error, 'Live player count failed')
  }
}
