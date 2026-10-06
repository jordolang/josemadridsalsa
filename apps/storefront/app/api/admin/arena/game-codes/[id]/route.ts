import { NextRequest, NextResponse } from 'next/server'
import { z } from 'zod'
import { prisma as db } from '@/lib/prisma'
import { requireAdminSession } from '@/lib/admin-auth'
import { logAuditWithRequest } from '@/lib/audit'

const UpdateGameCodeSchema = z.object({ revoked: z.boolean() })

/**
 * PATCH /api/admin/arena/game-codes/[id] — revoke a code (`{ revoked: true }`) or bring it
 * back (`{ revoked: false }`). Players already in a match keep playing; the code stops
 * letting anyone new in.
 */
export async function PATCH(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const admin = await requireAdminSession()
  const { id } = await params
  const parsed = UpdateGameCodeSchema.safeParse(await req.json().catch(() => ({})))
  if (!parsed.success) {
    return NextResponse.json({ success: false, error: 'Invalid request' }, { status: 422 })
  }

  const existing = await db.arenaGameCode.findUnique({ where: { id }, select: { id: true } })
  if (!existing) {
    return NextResponse.json({ success: false, error: 'Code not found' }, { status: 404 })
  }

  const code = await db.arenaGameCode.update({
    where: { id },
    data: { revokedAt: parsed.data.revoked ? new Date() : null },
    include: { fundraiser: { select: { id: true, name: true } } },
  })
  await logAuditWithRequest(
    {
      userId: admin.id,
      action: parsed.data.revoked ? 'revoke' : 'restore',
      entityType: 'arena_game_code',
      entityId: id,
      changes: { revoked: parsed.data.revoked },
    },
    req,
  )
  return NextResponse.json({ success: true, code })
}
