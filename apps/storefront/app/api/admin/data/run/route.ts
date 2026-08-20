import { NextResponse, type NextRequest } from 'next/server'

import { runReport } from '@/lib/data-studio/execute.server'
import { parseQuerySpec } from '@/lib/data-studio/schemas'
import { getCurrentUser, hasPermission } from '@/lib/rbac'

/**
 * POST /api/admin/data/run — answer one report spec.
 *
 * This exists for the builder's live preview, where the spec changes without a navigation. Viewing a
 * *saved* report does not come through here: the page calls `runReport` directly in its server
 * component, which is how every other admin report page in this app works and avoids duplicating the
 * spec type across the client boundary.
 *
 * `data:read` gates the section; the dataset's own permission is enforced inside `runReport`, so a
 * caller who can reach this route still cannot read a dataset they lack the domain permission for.
 */
export const maxDuration = 60

export async function POST(request: NextRequest) {
  const user = await getCurrentUser()
  if (!user || !(await hasPermission(user, 'data:read'))) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  let body: unknown
  try {
    body = await request.json()
  } catch {
    return NextResponse.json({ error: 'Expected a JSON body' }, { status: 400 })
  }

  const parsed = parseQuerySpec(body)
  if (!parsed.ok) {
    return NextResponse.json({ error: parsed.message, issues: parsed.issues }, { status: 400 })
  }

  const outcome = await runReport(user, parsed.spec)
  if (!outcome.ok) {
    return NextResponse.json({ error: outcome.message }, { status: outcome.status })
  }

  return NextResponse.json({ result: outcome.result })
}
