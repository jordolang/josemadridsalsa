import { NextResponse } from 'next/server'
import { requirePermission } from '@/lib/rbac'
import { logAuditWithRequest } from '@/lib/audit'
import { disconnectSquare } from '@/lib/square/oauth'

/** Revoke the kiosk card reader's Square connection. Kiosks stop taking cards until reconnected. */
export async function POST(request: Request) {
  let userId: string
  try {
    userId = (await requirePermission('settings:write')).id
  } catch {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
  }
  try {
    await disconnectSquare()
    await logAuditWithRequest({ userId, action: 'disconnect', entityType: 'SquareOAuth', entityId: null }, request)
    return NextResponse.json({ ok: true })
  } catch (error) {
    return NextResponse.json({ error: error instanceof Error ? error.message : 'Disconnect failed' }, { status: 502 })
  }
}
