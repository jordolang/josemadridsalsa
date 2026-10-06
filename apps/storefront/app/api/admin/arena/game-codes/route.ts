import { NextRequest, NextResponse } from 'next/server'
import { z } from 'zod'
import { prisma as db } from '@/lib/prisma'
import { requireAdminSession } from '@/lib/admin-auth'
import { logAuditWithRequest } from '@/lib/audit'
import { generateGameCode } from '@/lib/arena/game-codes'

const CreateGameCodeSchema = z
  .object({
    groupName: z.string().trim().max(40).optional(),
    fundraiserId: z.string().min(1).optional(),
  })
  .refine((v) => v.groupName || v.fundraiserId, { message: 'Give a group name or pick a fundraiser' })

/**
 * GET /api/admin/arena/game-codes — every Battle Arena game code, newest first.
 */
export async function GET() {
  await requireAdminSession()
  const codes = await db.arenaGameCode.findMany({
    orderBy: { createdAt: 'desc' },
    include: { fundraiser: { select: { id: true, name: true } } },
    take: 500,
  })
  return NextResponse.json({ success: true, codes })
}

/**
 * POST /api/admin/arena/game-codes — make a code for a fundraising group. The group name
 * defaults to the picked fundraiser's organization.
 */
export async function POST(req: NextRequest) {
  const admin = await requireAdminSession()
  const parsed = CreateGameCodeSchema.safeParse(await req.json().catch(() => ({})))
  if (!parsed.success) {
    return NextResponse.json(
      { success: false, error: 'Invalid request', details: parsed.error.flatten() },
      { status: 422 },
    )
  }

  let groupName = parsed.data.groupName?.replace(/\s+/g, ' ') || ''
  const fundraiserId = parsed.data.fundraiserId ?? null
  if (fundraiserId) {
    const fundraiser = await db.fundraiser.findUnique({
      where: { id: fundraiserId },
      select: { organizationName: true, name: true },
    })
    if (!fundraiser) {
      return NextResponse.json({ success: false, error: 'Fundraiser not found' }, { status: 404 })
    }
    groupName ||= (fundraiser.organizationName || fundraiser.name).slice(0, 40)
  }

  // a clash in a trillion codes is unlikely, but retry rather than fail on one
  for (let attempt = 0; attempt < 5; attempt++) {
    try {
      const code = await db.arenaGameCode.create({
        data: { code: generateGameCode(), groupName, fundraiserId, createdBy: admin.id },
        include: { fundraiser: { select: { id: true, name: true } } },
      })
      await logAuditWithRequest(
        {
          userId: admin.id,
          action: 'create',
          entityType: 'arena_game_code',
          entityId: code.id,
          changes: { groupName, fundraiserId },
        },
        req,
      )
      return NextResponse.json({ success: true, code }, { status: 201 })
    } catch (err) {
      const isUnique =
        typeof err === 'object' && err !== null && 'code' in err && (err as { code?: string }).code === 'P2002'
      if (!isUnique) throw err
    }
  }
  return NextResponse.json({ success: false, error: 'Could not make a unique code, try again' }, { status: 500 })
}
