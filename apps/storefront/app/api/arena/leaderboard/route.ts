import { leaderboard } from '@/lib/arena-game/matches'
import { LeaderboardQuerySchema } from '@/lib/arena-game/rules'
import { ArenaGameError, errorResponse, json, preflight } from '@/lib/arena-game/http'

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'

export function OPTIONS(request: Request) {
  return preflight(request, 'public')
}

/**
 * GET /api/arena/leaderboard?board=players|teams&period=week|month|all&mode=all|cpu|online|tournament|versus&teamId=&limit=
 * Public: handles, groups and totals only.
 */
export async function GET(request: Request) {
  try {
    const params = Object.fromEntries(new URL(request.url).searchParams)
    const parsed = LeaderboardQuerySchema.safeParse(params)
    if (!parsed.success) throw new ArenaGameError('Unknown leaderboard.', 400)
    return json(request, 'public', await leaderboard(parsed.data), {
      headers: { 'Cache-Control': 'public, s-maxage=30, stale-while-revalidate=120' },
    })
  } catch (error) {
    return errorResponse(request, 'public', error, 'Leaderboard failed')
  }
}
