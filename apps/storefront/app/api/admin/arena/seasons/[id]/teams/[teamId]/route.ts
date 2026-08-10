import { NextRequest, NextResponse } from 'next/server'
import { prisma as db } from '@/lib/prisma'
import { requireAdminSession } from '@/lib/admin-auth'
import { logAuditWithRequest } from '@/lib/audit'

/**
 * DELETE /api/admin/arena/seasons/[id]/teams/[teamId]
 *
 * Unlinks a team from a season by clearing `FundraiserTeam.seasonId`.
 * Leaves `activePeriod` untouched so historical queries still work.
 *
 * 409 when the team is linked to a different season (prevents accidental
 * removal from the wrong season).
 */
export async function DELETE(
  _req: NextRequest,
  { params }: { params: Promise<{ id: string; teamId: string }> },
) {
  const admin = await requireAdminSession()
  const { id: seasonId, teamId } = await params

  const team = await db.fundraiserTeam.findUnique({
    where: { id: teamId },
    select: { id: true, seasonId: true },
  })
  if (!team) {
    return NextResponse.json(
      { success: false, error: 'Team not found' },
      { status: 404 },
    )
  }
  if (team.seasonId !== seasonId) {
    return NextResponse.json(
      { success: false, error: 'Team is not linked to this season' },
      { status: 409 },
    )
  }

  await db.fundraiserTeam.update({
    where: { id: team.id },
    data: { seasonId: null },
  })
  await logAuditWithRequest(
    {
      userId: admin.id,
      action: 'update',
      entityType: 'fundraiser_team',
      entityId: team.id,
      changes: { seasonId: { from: seasonId, to: null } },
    },
    _req,
  )

  return NextResponse.json({ success: true, teamId: team.id })
}
