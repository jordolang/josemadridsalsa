import { requirePlayer } from '@/lib/arena-game/players'
import { finishMatch } from '@/lib/arena-game/matches'
import { FinishMatchSchema } from '@/lib/arena-game/rules'
import { errorResponse, json, preflight, readBody } from '@/lib/arena-game/http'

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'

export function OPTIONS(request: Request) {
  return preflight(request, 'player')
}

/** The player's result for a match the game opened. Sending it again changes nothing. */
export async function POST(request: Request, { params }: { params: Promise<{ id: string }> }) {
  try {
    const player = await requirePlayer(request)
    const { id } = await params
    const input = await readBody(request, FinishMatchSchema)
    return json(request, 'player', await finishMatch(player, id, input))
  } catch (error) {
    return errorResponse(request, 'player', error, 'Match result failed')
  }
}
