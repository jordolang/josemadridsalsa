import { NextRequest, NextResponse } from 'next/server'
import { prisma as db } from '@/lib/prisma'
import { requireAdminSession } from '@/lib/admin-auth'
import { logAuditWithRequest } from '@/lib/audit'
import { resetSeasonHP } from '@/lib/arena/damage'

/**
 * POST /api/admin/arena/seasons/[id]/reset-hp — re-seed every ACTIVE team
 * in this season to its goalAmount. Admin-only.
 */
export async function POST(
  _req: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  const admin = await requireAdminSession()
  const { id: seasonId } = await params

  const season = await db.fundraiserSeason.findUnique({
    where: { id: seasonId },
    select: { id: true, period: true, status: true },
  })
  if (!season) {
    return NextResponse.json(
      { success: false, error: 'Season not found' },
      { status: 404 },
    )
  }

  const resetCount = await resetSeasonHP(season.id)

  await logAuditWithRequest(
    {
      userId: admin.id,
      action: 'reset_hp',
      entityType: 'fundraiser_season',
      entityId: season.id,
      changes: { period: season.period, teamsReset: resetCount },
    },
    _req,
  )

  return NextResponse.json({
    success: true,
    seasonId: season.id,
    period: season.period,
    teamsReset: resetCount,
  })
}
