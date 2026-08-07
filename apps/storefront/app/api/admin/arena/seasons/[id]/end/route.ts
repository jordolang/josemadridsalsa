import { NextRequest, NextResponse } from 'next/server'
import { z } from 'zod'
import { prisma as db } from '@/lib/prisma'
import { requireAdminSession } from '@/lib/admin-auth'
import { logAuditWithRequest } from '@/lib/audit'

const EndSeasonSchema = z.object({
  // Optional prize/scholarship amounts recorded on the Championship row.
  // Defaults to 0/0 so admins can just hit "end" without filling anything.
  prizeAmount: z.number().nonnegative().default(0),
  scholarshipAmount: z.number().nonnegative().default(0),
})

/**
 * POST /api/admin/arena/seasons/[id]/end
 *
 * Atomically:
 *   1. Picks the winning team (highest salesCount among ACTIVE teams in
 *      the season). Ties break on earliest createdAt (stable).
 *   2. Creates a FundraiserChampionship row keyed on the season's
 *      period (month/year), tagged with seasonId for forward lookups.
 *   3. Sets the season status to ENDED and pins championTeamId.
 *
 * Idempotent: if the season is already ENDED, returns its existing
 * championship instead of recomputing.
 */
export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  const admin = await requireAdminSession()
  const { id: seasonId } = await params
  const parsed = EndSeasonSchema.safeParse(await req.json().catch(() => ({})))
  if (!parsed.success) {
    return NextResponse.json(
      { success: false, error: 'Invalid request' },
      { status: 422 },
    )
  }
  const { prizeAmount, scholarshipAmount } = parsed.data

  const season = await db.fundraiserSeason.findUnique({
    where: { id: seasonId },
    select: { id: true, period: true, status: true, championTeamId: true },
  })
  if (!season) {
    return NextResponse.json(
      { success: false, error: 'Season not found' },
      { status: 404 },
    )
  }
  if (season.status === 'ENDED' || season.status === 'ARCHIVED') {
    const existingChampionship = await db.fundraiserChampionship.findFirst({
      where: { seasonId: season.id },
    })
    return NextResponse.json({
      success: true,
      alreadyEnded: true,
      seasonId: season.id,
      championTeamId: season.championTeamId,
      championship: existingChampionship,
    })
  }

  // period is "YYYY-MM" — FundraiserChampionship is keyed on (month, year) Ints.
  const [yearStr, monthStr] = season.period.split('-')
  const year = Number(yearStr)
  const month = Number(monthStr)
  if (!Number.isInteger(year) || !Number.isInteger(month)) {
    return NextResponse.json(
      { success: false, error: `Malformed season.period: ${season.period}` },
      { status: 500 },
    )
  }

  const champion = await db.fundraiserTeam.findFirst({
    where: { seasonId: season.id, status: 'ACTIVE' },
    orderBy: [{ salesCount: 'desc' }, { createdAt: 'asc' }],
    select: { id: true, slug: true, name: true, salesCount: true },
  })

  const result = await db.$transaction(async (tx) => {
    const updatedSeason = await tx.fundraiserSeason.update({
      where: { id: season.id },
      data: {
        status: 'ENDED',
        championTeamId: champion?.id ?? null,
      },
    })

    // A championship row always exists per ended season, even when no
    // ACTIVE teams participated — the admin UI wants a consistent record.
    const championship = champion
      ? await tx.fundraiserChampionship.upsert({
          where: { month_year: { month, year } },
          update: {
            winningFundraiserId: champion.id,
            seasonId: season.id,
            prizeAmount,
            scholarshipAmount,
          },
          create: {
            month,
            year,
            winningFundraiserId: champion.id,
            seasonId: season.id,
            prizeAmount,
            scholarshipAmount,
          },
        })
      : null

    return { updatedSeason, championship }
  })

  // Ending a season freezes standings and awards the championship, so it needs an
  // attributable record of who closed it and what it paid out.
  await logAuditWithRequest(
    {
      userId: admin.id,
      action: 'update',
      entityType: 'fundraiser_season',
      entityId: season.id,
      changes: {
        period: season.period,
        status: { to: 'ENDED' },
        championshipId: result.championship?.id ?? null,
      },
    },
    req,
  )

  return NextResponse.json({
    success: true,
    seasonId: season.id,
    period: season.period,
    champion,
    championship: result.championship,
  })
}
