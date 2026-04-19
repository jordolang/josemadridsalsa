import { NextRequest, NextResponse } from 'next/server'
import { z } from 'zod'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import { prisma as db } from '@/lib/prisma'
import { rateLimit } from '@/lib/rateLimit'
import { hasRole } from '@/lib/rbac'
import { UserRole } from '@prisma/client'

const ReplyPayload = z.object({
  body: z.string().trim().min(1).max(500),
})

/**
 * POST /api/fundraiser/sale-events/[id]/reply
 *
 * Admin/staff-gated reply to a supporter-feed sale event. The project
 * doesn't yet model a "team owner" user role — the admin panel uses a
 * cookie-based `admin_token` session that isn't tied to a User row, so
 * authored replies need a NextAuth-session user with admin/staff role
 * to satisfy the `authorUserId` FK. Broadening to true team owners is a
 * follow-up once FundraiserTeam ↔ User is modeled.
 *
 * Rate-limit: 1 reply per user per 30 s.
 */
export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  const session = await getServerSession(authOptions)
  const userId = session?.user?.id
  const role = (session?.user as { role?: UserRole } | undefined)?.role
  if (!userId) {
    return NextResponse.json(
      { success: false, error: 'Unauthorized' },
      { status: 401 },
    )
  }
  // ADMIN / DEVELOPER / STAFF may reply on behalf of the team.
  if (
    !hasRole({ role: role ?? UserRole.CUSTOMER }, [
      UserRole.ADMIN,
      UserRole.DEVELOPER,
      UserRole.STAFF,
    ])
  ) {
    return NextResponse.json(
      { success: false, error: 'Forbidden — staff role required' },
      { status: 403 },
    )
  }

  // Per-user rate limit keyed on userId (not IP) so a shared office
  // network doesn't lock out individual authors.
  const rl = rateLimit(`sale-reply:${userId}`, 1, 30_000)
  if (!rl.allowed) {
    return NextResponse.json(
      { success: false, error: 'Slow down — 1 reply per 30s' },
      {
        status: 429,
        headers: { 'Retry-After': String(Math.ceil(rl.retryAfterMs / 1000)) },
      },
    )
  }

  const parsed = ReplyPayload.safeParse(await req.json().catch(() => ({})))
  if (!parsed.success) {
    return NextResponse.json(
      { success: false, error: 'Invalid request', details: parsed.error.flatten() },
      { status: 422 },
    )
  }

  const { id: saleEventId } = await params
  const saleEvent = await db.fundraiserSaleEvent.findUnique({
    where: { id: saleEventId },
    select: { id: true },
  })
  if (!saleEvent) {
    return NextResponse.json(
      { success: false, error: 'Sale event not found' },
      { status: 404 },
    )
  }

  const reply = await db.fundraiserSaleEventReply.create({
    data: {
      saleEventId,
      authorUserId: userId,
      body: parsed.data.body,
    },
    select: {
      id: true,
      saleEventId: true,
      body: true,
      createdAt: true,
      author: { select: { id: true, name: true, email: true } },
    },
  })

  return NextResponse.json({ success: true, reply }, { status: 201 })
}
