import { NextResponse } from 'next/server'
import { getCurrentUser, hasPermission } from '@/lib/rbac'
import { getIntegrationHealth } from '@/lib/integrations/health'

export const dynamic = 'force-dynamic'

// Live health of every integration — runs real probes server-side.
export async function GET() {
  const user = await getCurrentUser()
  if (!user || !(await hasPermission(user, 'settings:read'))) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }
  return NextResponse.json({ services: await getIntegrationHealth() })
}
