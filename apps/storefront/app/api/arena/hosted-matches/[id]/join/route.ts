import { requirePlayer } from '@/lib/arena-game/players'
import { joinHostedMatch } from '@/lib/arena-game/matches'
import { JoinHostedMatchSchema } from '@/lib/arena-game/rules'
import { errorResponse, json, preflight, readBody } from '@/lib/arena-game/http'

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'

export function OPTIONS(request: Request) {
  return preflight(request, 'player')
}

/** A player claims their seat in the host's match with the ticket the host handed them. */
export async function POST(request: Request, { params }: { params: Promise<{ id: string }> }) {
  try {
    const player = await requirePlayer(request)
    const { id } = await params
    const input = await readBody(request, JoinHostedMatchSchema)
    return json(request, 'player', await joinHostedMatch(player, id, input))
  } catch (error) {
    return errorResponse(request, 'player', error, 'Hosted match join failed')
  }
}
