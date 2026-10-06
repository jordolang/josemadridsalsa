import { describePublic } from '@/lib/arena-game/players'
import { errorResponse, json, preflight } from '@/lib/arena-game/http'

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'

export function OPTIONS(request: Request) {
  return preflight(request, 'public')
}

/** A fighter's public profile: name, group, totals, rank and recent matches. */
export async function GET(request: Request, { params }: { params: Promise<{ handle: string }> }) {
  try {
    const { handle } = await params
    return json(request, 'public', await describePublic(safeDecode(handle).slice(0, 40)), {
      headers: { 'Cache-Control': 'public, s-maxage=30, stale-while-revalidate=120' },
    })
  } catch (error) {
    return errorResponse(request, 'public', error, 'Player profile failed')
  }
}

function safeDecode(value: string): string {
  try {
    return decodeURIComponent(value)
  } catch {
    return value
  }
}
