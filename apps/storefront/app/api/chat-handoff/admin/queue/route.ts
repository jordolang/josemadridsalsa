import { NextResponse } from 'next/server'
import prisma from '@/lib/prisma'
import { getCurrentUser } from '@/lib/rbac'

export const runtime = 'nodejs'

const STAFF_ROLES = new Set(['ADMIN', 'STAFF', 'DEVELOPER'])

export async function GET() {
  const user = await getCurrentUser()
  if (!user || !STAFF_ROLES.has(user.role as string)) {
    return NextResponse.json({ error: 'Forbidden.' }, { status: 403 })
  }

  const [waiting, active] = await Promise.all([
    prisma.chatThread.findMany({
      where: { status: 'WAITING' },
      orderBy: { startedAt: 'asc' },
      take: 50,
      select: {
        id: true,
        startedAt: true,
        lastMessageAt: true,
        customerName: true,
        customerEmail: true,
        source: true,
      },
    }),
    prisma.chatThread.findMany({
      where: { status: 'ACTIVE' },
      orderBy: { lastMessageAt: 'desc' },
      take: 50,
      select: {
        id: true,
        startedAt: true,
        lastMessageAt: true,
        customerName: true,
        customerEmail: true,
        assignedAdminId: true,
        source: true,
      },
    }),
  ])

  return NextResponse.json({
    waiting: waiting.map((t) => ({ ...t, startedAt: t.startedAt.toISOString(), lastMessageAt: t.lastMessageAt.toISOString() })),
    active: active.map((t) => ({ ...t, startedAt: t.startedAt.toISOString(), lastMessageAt: t.lastMessageAt.toISOString() })),
    serverTime: new Date().toISOString(),
  })
}
