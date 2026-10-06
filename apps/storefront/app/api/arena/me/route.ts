import { z } from 'zod'
import { describeSelf, requirePlayer, updateSelf } from '@/lib/arena-game/players'
import { errorResponse, json, preflight, readBody } from '@/lib/arena-game/http'

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'

const UpdateSchema = z.object({
  handle: z.string().max(60).optional(),
  teamId: z.string().min(1).max(64).nullable().optional(),
})

export function OPTIONS(request: Request) {
  return preflight(request, 'player')
}

/** The signed-in player's profile: name, group, totals, rank and recent matches. */
export async function GET(request: Request) {
  try {
    const player = await requirePlayer(request)
    return json(request, 'player', await describeSelf(player))
  } catch (error) {
    return errorResponse(request, 'player', error, 'Profile failed')
  }
}

/** Rename the player or choose their fundraising group. */
export async function PATCH(request: Request) {
  try {
    const player = await requirePlayer(request)
    const input = await readBody(request, UpdateSchema)
    return json(request, 'player', await updateSelf(player, input))
  } catch (error) {
    return errorResponse(request, 'player', error, 'Profile update failed')
  }
}
