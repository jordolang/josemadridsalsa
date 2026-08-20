import { NextRequest, NextResponse } from 'next/server'

import { getCurrentUser } from '@/lib/rbac'
import { runGlobalSearch } from '@/lib/admin/search-providers'

/**
 * One search box over the whole admin.
 *
 * The fan-out, permission gating and ranking all live in lib/admin/search-providers.ts so
 * that the ⌘K palette and the full-results page return the same thing; this route only
 * authenticates and passes the query through.
 */
export async function GET(request: NextRequest) {
  const user = await getCurrentUser()
  if (!user) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  const limit = Number.parseInt(request.nextUrl.searchParams.get('limit') ?? '', 10)

  const { results, shape } = await runGlobalSearch(
    user,
    request.nextUrl.searchParams.get('q') ?? '',
    Number.isFinite(limit) && limit > 0 ? { limit: Math.min(limit, 200) } : {}
  )

  return NextResponse.json({ results, shape })
}
