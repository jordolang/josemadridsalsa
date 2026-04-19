import { NextRequest, NextResponse } from 'next/server'
import { prisma as db } from '@/lib/prisma'
import { requireAdminSession } from '@/lib/admin-auth'
import { resetSeasonHP } from '@/lib/arena/damage'

/**
 * POST /api/admin/arena/seasons/[id]/reset-hp — re-seed every ACTIVE team
 * in this season to its goalAmount. Admin-only.
 */
export async function POST(
  _req: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  await requireAdminSession()
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
  return NextResponse.json({
    success: true,
    seasonId: season.id,
    period: season.period,
    teamsReset: resetCount,
  })
}
