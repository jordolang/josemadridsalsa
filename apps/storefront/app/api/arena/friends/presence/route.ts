import { requirePlayer } from '@/lib/arena-game/players'
import { PresenceSchema, checkIn } from '@/lib/arena-game/friends'
import { errorResponse, json, preflight, readBody } from '@/lib/arena-game/http'

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'

export function OPTIONS(request: Request) {
  return preflight(request, 'player')
}

/**
 * The game checks in while it is open (about every 30 seconds) with the private room the player
 * is in, if any, and gets the friends view back, so one call keeps both sides current.
 */
export async function POST(request: Request) {
  try {
    const player = await requirePlayer(request)
    const { room } = await readBody(request, PresenceSchema)
    return json(request, 'player', await checkIn(player, room ?? null))
  } catch (error) {
    return errorResponse(request, 'player', error, 'Check-in failed')
  }
}
