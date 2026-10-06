import { listTeams } from '@/lib/arena-game/players'
import { errorResponse, json, preflight } from '@/lib/arena-game/http'

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'

export function OPTIONS(request: Request) {
  return preflight(request, 'public')
}

/** The fundraising groups a player can fight for. */
export async function GET(request: Request) {
  try {
    return json(request, 'public', { teams: await listTeams() }, { headers: { 'Cache-Control': 'public, s-maxage=60, stale-while-revalidate=300' } })
  } catch (error) {
    return errorResponse(request, 'public', error, 'Team list failed')
  }
}
