import { requirePlayer } from '@/lib/arena-game/players'
import { startMatch } from '@/lib/arena-game/matches'
import { StartMatchSchema } from '@/lib/arena-game/rules'
import { errorResponse, json, preflight, readBody } from '@/lib/arena-game/http'

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'

export function OPTIONS(request: Request) {
  return preflight(request, 'player')
}

/** The game opens a match as the fight starts; the result goes to /api/arena/matches/[id]. */
export async function POST(request: Request) {
  try {
    const player = await requirePlayer(request)
    const input = await readBody(request, StartMatchSchema)
    return json(request, 'player', await startMatch(player, input), { status: 201 })
  } catch (error) {
    return errorResponse(request, 'player', error, 'Match start failed')
  }
}
