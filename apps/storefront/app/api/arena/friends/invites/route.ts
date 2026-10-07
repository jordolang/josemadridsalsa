import { requirePlayer } from '@/lib/arena-game/players'
import { InviteSchema, inviteFriend } from '@/lib/arena-game/friends'
import { errorResponse, json, preflight, readBody } from '@/lib/arena-game/http'

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'

export function OPTIONS(request: Request) {
  return preflight(request, 'player')
}

/** Invite a friend into the player's private room. Friends only; a few a minute. */
export async function POST(request: Request) {
  try {
    const player = await requirePlayer(request)
    const { handle, room } = await readBody(request, InviteSchema)
    return json(request, 'player', await inviteFriend(player, handle, room), { status: 201 })
  } catch (error) {
    return errorResponse(request, 'player', error, 'Invite failed')
  }
}
