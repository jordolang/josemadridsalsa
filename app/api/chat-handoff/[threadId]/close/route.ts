import { NextResponse } from 'next/server'
import prisma from '@/lib/prisma'
import { getCurrentUser } from '@/lib/rbac'

export const runtime = 'nodejs'

type Params = { params: Promise<{ threadId: string }> }

const STAFF_ROLES = new Set(['ADMIN', 'STAFF', 'DEVELOPER'])

export async function POST(_request: Request, { params }: Params) {
  const { threadId } = await params
  const user = await getCurrentUser()
  if (!user || !STAFF_ROLES.has(user.role as string)) {
    return NextResponse.json({ error: 'Forbidden.' }, { status: 403 })
  }

  const thread = await prisma.chatThread.findUnique({
    where: { id: threadId },
    select: { id: true, status: true },
  })
  if (!thread) return NextResponse.json({ error: 'Thread not found.' }, { status: 404 })

  await prisma.$transaction([
    prisma.chatThread.update({
      where: { id: threadId },
      data: { status: 'CLOSED', closedAt: new Date(), closedReason: 'admin_closed' },
    }),
    prisma.chatMessage.create({
      data: {
        threadId,
        senderType: 'SYSTEM',
        content: `${user.name ?? user.email} closed the chat.`,
      },
    }),
  ])

  return NextResponse.json({ success: true })
}
