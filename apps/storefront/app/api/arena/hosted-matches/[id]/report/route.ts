import { requirePlayer } from '@/lib/arena-game/players'
import { reportHostedMatch } from '@/lib/arena-game/matches'
import { HostedReportSchema } from '@/lib/arena-game/rules'
import { errorResponse, json, preflight, readBody } from '@/lib/arena-game/http'

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'

export function OPTIONS(request: Request) {
  return preflight(request, 'player')
}

/** The host reports every seat's result, once; it is recorded for the players who claimed seats. */
export async function POST(request: Request, { params }: { params: Promise<{ id: string }> }) {
  try {
    const player = await requirePlayer(request)
    const { id } = await params
    const input = await readBody(request, HostedReportSchema)
    return json(request, 'player', await reportHostedMatch(player, id, input))
  } catch (error) {
    return errorResponse(request, 'player', error, 'Hosted match report failed')
  }
}
