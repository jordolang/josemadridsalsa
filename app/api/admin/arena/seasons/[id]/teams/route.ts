import { NextRequest, NextResponse } from 'next/server'
import { z } from 'zod'
import { prisma as db } from '@/lib/prisma'
import { requireAdminSession } from '@/lib/admin-auth'

const TeamOpSchema = z.object({
  teamId: z.string().min(1),
})

/**
 * POST /api/admin/arena/seasons/[id]/teams — link a team to a season.
 * Also syncs `activePeriod` so the legacy period-scoped queries still see
 * the team in the right cohort.
 */
export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  await requireAdminSession()
  const { id: seasonId } = await params
  const parsed = TeamOpSchema.safeParse(await req.json().catch(() => ({})))
  if (!parsed.success) {
    return NextResponse.json(
      { success: false, error: 'Invalid request' },
      { status: 422 },
    )
  }

  const season = await db.fundraiserSeason.findUnique({
    where: { id: seasonId },
    select: { id: true, period: true },
  })
  if (!season) {
    return NextResponse.json(
      { success: false, error: 'Season not found' },
      { status: 404 },
    )
  }

  const team = await db.fundraiserTeam.findUnique({
    where: { id: parsed.data.teamId },
    select: { id: true, slug: true, name: true },
  })
  if (!team) {
    return NextResponse.json(
      { success: false, error: 'Team not found' },
      { status: 404 },
    )
  }

  const updated = await db.fundraiserTeam.update({
    where: { id: team.id },
    data: { seasonId: season.id, activePeriod: season.period },
    select: {
      id: true,
      slug: true,
      name: true,
      seasonId: true,
      activePeriod: true,
    },
  })
  return NextResponse.json({ success: true, team: updated })
}

