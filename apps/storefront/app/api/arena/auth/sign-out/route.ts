import { revokeGameSession } from '@/lib/arena-game/players'
import { errorResponse, json, preflight } from '@/lib/arena-game/http'

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'

export function OPTIONS(request: Request) {
  return preflight(request, 'player')
}

/** Sign the game out of the account. The account stays signed in on this site. */
export async function POST(request: Request) {
  try {
    await revokeGameSession(request)
    return json(request, 'player', { ok: true })
  } catch (error) {
    return errorResponse(request, 'player', error, 'Sign-out failed')
  }
}
