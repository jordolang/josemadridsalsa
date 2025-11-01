import { NextRequest, NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import { prisma } from '@/lib/prisma'

export async function GET(
  _: NextRequest,
  context: { params: Promise<{ id: string }> }
) {
  const session = await getServerSession(authOptions)
  if (!session?.user?.id || (session.user as any).role !== 'ADMIN') {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }
  const { id } = await context.params
  const conversation = await prisma.conversation.findUnique({
    where: { id },
    include: { user: { select: { email: true } }, messages: { orderBy: { createdAt: 'asc' } } },
  })
  if (!conversation) return NextResponse.json({ error: 'Not found' }, { status: 404 })
  return NextResponse.json(conversation)
}

export async function POST(
  req: NextRequest,
  context: { params: Promise<{ id: string }> }
) {
  const session = await getServerSession(authOptions)
  if (!session?.user?.id || (session.user as any).role !== 'ADMIN') {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }
  const { id } = await context.params
  const body = await req.json()
  const { message } = body || {}
  if (!message) return NextResponse.json({ error: 'message required' }, { status: 400 })

  await prisma.message.create({ data: { conversationId: id, senderType: 'ADMIN', body: message } })
  const convo = await prisma.conversation.update({ where: { id }, data: { updatedAt: new Date() }, include: { user: { select: { email: true } } } })
  const { logAudit } = await import('@/lib/audit')
  await logAudit({ action: 'ADMIN_REPLY', entityType: 'Conversation', entityId: id })

  // Send email on admin reply
  const to = convo.user?.email || convo.email
  if (to) {
    const { sendAdminReplyEmail } = await import('@/lib/email')
    await sendAdminReplyEmail(to, convo.subject || 'Reply from Jose Madrid Salsa', message)
  }

  return NextResponse.json({ ok: true })
}
