import { requirePlayer } from '@/lib/arena-game/players'
import { removeFriend } from '@/lib/arena-game/friends'
import { errorResponse, json, preflight } from '@/lib/arena-game/http'

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'

export function OPTIONS(request: Request) {
  return preflight(request, 'player')
}

/** Unfriend a player, decline their request, or cancel ours. */
export async function DELETE(request: Request, { params }: { params: Promise<{ handle: string }> }) {
  try {
    const player = await requirePlayer(request)
    const { handle } = await params
    return json(request, 'player', await removeFriend(player, safeDecode(handle).slice(0, 40)))
  } catch (error) {
    return errorResponse(request, 'player', error, 'Remove friend failed')
  }
}

function safeDecode(value: string): string {
  try {
    return decodeURIComponent(value)
  } catch {
    return value
  }
}
