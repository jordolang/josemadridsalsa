import { requirePlayer } from '@/lib/arena-game/players'
import { openHostedMatch } from '@/lib/arena-game/matches'
import { HostedMatchSchema } from '@/lib/arena-game/rules'
import { errorResponse, json, preflight, readBody } from '@/lib/arena-game/http'

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'

export function OPTIONS(request: Request) {
  return preflight(request, 'player')
}

/** The host opens an online match; the answer carries one seat ticket per other player. */
export async function POST(request: Request) {
  try {
    const player = await requirePlayer(request)
    const input = await readBody(request, HostedMatchSchema)
    return json(request, 'player', await openHostedMatch(player, input), { status: 201 })
  } catch (error) {
    return errorResponse(request, 'player', error, 'Hosted match start failed')
  }
}
