import { NextRequest, NextResponse } from 'next/server'
import { getCurrentUser, hasPermission } from '@/lib/rbac'
import { logAuditWithRequest } from '@/lib/audit'
import { AppSettingsUpdateSchema, getAppSettings, updateAppSettings } from '@/lib/fundraiser-app/admin'
import { FundraiserAppError } from '@/lib/fundraiser-app/errors'

function errorResponse(error: unknown, context: string) {
  if (error instanceof FundraiserAppError) {
    return NextResponse.json({ error: error.message }, { status: error.status })
  }
  console.error(`[Admin fundraiser app] ${context}:`, error)
  return NextResponse.json({ error: context }, { status: 500 })
}

/** The group's mobile app settings and its sellers' sign-in state. */
export async function GET(_req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const user = await getCurrentUser()
    if (!user || !(await hasPermission(user, 'orders:read'))) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 403 })
    }
    const { id } = await params
    return NextResponse.json(await getAppSettings(id))
  } catch (error) {
    return errorResponse(error, 'Failed to load mobile app settings')
  }
}

/** Turn the app on or off, issue a new group ID, set the group PIN, or assign the organizer seat. */
export async function PATCH(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const user = await getCurrentUser()
    if (!user || !(await hasPermission(user, 'orders:write'))) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 403 })
    }
    const { id } = await params
    const parsed = AppSettingsUpdateSchema.safeParse(await req.json().catch(() => null))
    if (!parsed.success) {
      return NextResponse.json({ error: parsed.error.issues[0]?.message ?? 'Validation failed' }, { status: 400 })
    }

    await updateAppSettings(id, parsed.data)
    const { groupPin, ...rest } = parsed.data
    await logAuditWithRequest(
      {
        userId: user.id,
        action: 'update',
        entityType: 'fundraiser_mobile_app',
        entityId: id,
        // Never the PIN itself.
        changes: { ...rest, ...(groupPin ? { groupPinChanged: true } : {}) },
      },
      req
    )
    return NextResponse.json(await getAppSettings(id))
  } catch (error) {
    return errorResponse(error, 'Failed to update mobile app settings')
  }
}
