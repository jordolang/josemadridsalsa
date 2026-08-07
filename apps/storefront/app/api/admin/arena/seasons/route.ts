import { NextRequest, NextResponse } from 'next/server'
import { z } from 'zod'
import type { Prisma } from '@prisma/client'
import { prisma as db } from '@/lib/prisma'
import { requireAdminSession } from '@/lib/admin-auth'
import { logAuditWithRequest } from '@/lib/audit'

const CreateSeasonSchema = z.object({
  period: z.string().regex(/^\d{4}-\d{2}$/, 'period must be YYYY-MM'),
  startsAt: z.string().datetime(),
  endsAt: z.string().datetime(),
  status: z.enum(['DRAFT', 'ACTIVE', 'ENDED', 'ARCHIVED']).default('DRAFT'),
  rulesJson: z.record(z.string(), z.unknown()).nullish(),
})

/**
 * POST /api/admin/arena/seasons — create a new Battle Arena season.
 */
export async function POST(req: NextRequest) {
  const admin = await requireAdminSession()
  const parsed = CreateSeasonSchema.safeParse(await req.json().catch(() => ({})))
  if (!parsed.success) {
    return NextResponse.json(
      { success: false, error: 'Invalid request', details: parsed.error.flatten() },
      { status: 422 },
    )
  }

  const { period, startsAt, endsAt, status, rulesJson } = parsed.data
  const startDate = new Date(startsAt)
  const endDate = new Date(endsAt)
  if (endDate.getTime() <= startDate.getTime()) {
    return NextResponse.json(
      { success: false, error: 'endsAt must be after startsAt' },
      { status: 422 },
    )
  }

  try {
    const season = await db.fundraiserSeason.create({
      data: {
        period,
        startsAt: startDate,
        endsAt: endDate,
        status,
        rulesJson: (rulesJson ?? undefined) as Prisma.InputJsonValue | undefined,
        createdBy: admin.id,
      },
    })
    await logAuditWithRequest(
      {
        userId: admin.id,
        action: 'create',
        entityType: 'fundraiser_season',
        entityId: season.id,
        changes: { period, status, startsAt: startDate, endsAt: endDate },
      },
      req,
    )

    return NextResponse.json({ success: true, season }, { status: 201 })
  } catch (err) {
    const isUnique =
      typeof err === 'object' &&
      err !== null &&
      'code' in err &&
      (err as { code?: string }).code === 'P2002'
    if (isUnique) {
      return NextResponse.json(
        { success: false, error: `Season for period ${period} already exists` },
        { status: 409 },
      )
    }
    const message = err instanceof Error ? err.message : 'Unknown error'
    return NextResponse.json({ success: false, error: message }, { status: 500 })
  }
}

/**
 * GET /api/admin/arena/seasons — list seasons, newest first.
 */
export async function GET() {
  const admin = await requireAdminSession()
  const seasons = await db.fundraiserSeason.findMany({
    orderBy: [{ startsAt: 'desc' }],
    include: {
      _count: { select: { teams: true } },
      championTeam: { select: { id: true, slug: true, name: true } },
    },
  })
  return NextResponse.json({ success: true, seasons })
}
