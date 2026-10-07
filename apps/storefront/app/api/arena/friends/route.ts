import { requirePlayer } from '@/lib/arena-game/players'
import { AddFriendSchema, addFriend, friendsView } from '@/lib/arena-game/friends'
import { errorResponse, json, preflight, readBody } from '@/lib/arena-game/http'

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'

export function OPTIONS(request: Request) {
  return preflight(request, 'player')
}

/** The player's friends (who is online, in which private room), requests both ways and room invites. */
export async function GET(request: Request) {
  try {
    const player = await requirePlayer(request)
    return json(request, 'player', await friendsView(player))
  } catch (error) {
    return errorResponse(request, 'player', error, 'Friends failed')
  }
}

/** Send a friend request by in-game name, or accept one that player already sent. */
export async function POST(request: Request) {
  try {
    const player = await requirePlayer(request)
    const { handle } = await readBody(request, AddFriendSchema)
    return json(request, 'player', await addFriend(player, handle))
  } catch (error) {
    return errorResponse(request, 'player', error, 'Add friend failed')
  }
}
