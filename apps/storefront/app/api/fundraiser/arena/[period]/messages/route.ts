import { NextRequest, NextResponse } from 'next/server'
import { z } from 'zod'
import { Prisma } from '@prisma/client'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import { prisma } from '@/lib/prisma'
import { rateLimit } from '@/lib/rateLimit'

export const dynamic = 'force-dynamic'

const PERIOD_RE = /^\d{4}-\d{2}$/
const MESSAGE_LIMIT = 9

const MessagePayload = z.object({
  body: z.string().trim().min(1).max(120),
  teamId: z.string().min(1).max(64).nullish(),
})

const messageSelect = {
  id: true,
  teamId: true,
  body: true,
  createdAt: true,
  author: { select: { name: true } },
} as const

type MessageRow = {
  id: string
  teamId: string | null
  body: string
  createdAt: Date
  author: { name: string | null }
}

// Public spectators see first names only — these are school fundraisers.
function toDto(row: MessageRow) {
  return {
    id: row.id,
    teamId: row.teamId,
    author: row.author.name?.trim().split(/\s+/)[0] || 'Fan',
    body: row.body,
    createdAt: row.createdAt.getTime(),
  }
}

/**
 * GET /api/fundraiser/arena/[period]/messages — latest chat bubbles (public).
 */
export async function GET(
  req: NextRequest,
  { params }: { params: Promise<{ period: string }> },
) {
  const ip = req.headers.get('x-forwarded-for')?.split(',')[0]?.trim() ?? 'unknown'
  const rl = rateLimit(`arena-messages:${ip}`, 60, 60_000)
  if (!rl.allowed) {
    return NextResponse.json({ success: false, error: 'Too many requests' }, { status: 429 })
  }

  const { period } = await params
  if (!PERIOD_RE.test(period)) {
    return NextResponse.json({ success: false, error: 'period must be YYYY-MM' }, { status: 400 })
  }

  const rows = await prisma.arenaMessage.findMany({
    where: { period },
    orderBy: { createdAt: 'desc' },
    take: MESSAGE_LIMIT,
    select: messageSelect,
  })

  return NextResponse.json(
    { success: true, messages: rows.map(toDto) },
    { headers: { 'Cache-Control': 'no-store' } },
  )
}

/**
 * POST /api/fundraiser/arena/[period]/messages — signed-in users only,
 * 1 message per 15 s per user.
 */
export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ period: string }> },
) {
  const session = await getServerSession(authOptions)
  const userId = session?.user?.id
  if (!userId) {
    return NextResponse.json({ success: false, error: 'Sign in to post a message' }, { status: 401 })
  }

  const rl = rateLimit(`arena-message-post:${userId}`, 1, 15_000)
  if (!rl.allowed) {
    return NextResponse.json(
      { success: false, error: 'Slow down — 1 message per 15s' },
      { status: 429, headers: { 'Retry-After': String(Math.ceil(rl.retryAfterMs / 1000)) } },
    )
  }

  const { period } = await params
  if (!PERIOD_RE.test(period)) {
    return NextResponse.json({ success: false, error: 'period must be YYYY-MM' }, { status: 400 })
  }

  const parsed = MessagePayload.safeParse(await req.json().catch(() => ({})))
  if (!parsed.success) {
    return NextResponse.json({ success: false, error: 'Invalid message' }, { status: 422 })
  }

  const body = parsed.data.body.replace(/\s+/g, ' ')
  let teamId = parsed.data.teamId ?? null
  if (teamId) {
    const team = await prisma.fundraiserTeam.findUnique({ where: { id: teamId }, select: { id: true } })
    if (!team) teamId = null
  }

  let row: MessageRow
  try {
    row = await prisma.arenaMessage.create({
      data: { period, teamId, authorUserId: userId, body },
      select: messageSelect,
    })
  } catch (error) {
    // A session for an account that no longer exists: ask for a fresh sign-in, not a 500.
    if (error instanceof Prisma.PrismaClientKnownRequestError && error.code === 'P2003') {
      return NextResponse.json({ success: false, error: 'Sign in again to post a message' }, { status: 401 })
    }
    throw error
  }

  return NextResponse.json({ success: true, message: toDto(row) }, { status: 201 })
}
