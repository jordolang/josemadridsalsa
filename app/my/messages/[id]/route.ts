import { NextRequest, NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import { prisma } from '@/lib/prisma'

export async function GET(
  _: NextRequest,
  context: { params: Promise<{ id: string }> }
) {
  const session = await getServerSession(authOptions)
  if (!session?.user?.email) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const { id } = await context.params
  const convo = await prisma.conversation.findFirst({
    where: { id, OR: [{ userId: (session.user as any).id }, { email: session.user.email }] },
    include: { messages: { orderBy: { createdAt: 'asc' } } },
  })

  if (!convo) return NextResponse.json({ error: 'Not found' }, { status: 404 })
  return NextResponse.json(convo)
}

export async function POST(
  req: NextRequest,
  context: { params: Promise<{ id: string }> }
) {
  const session = await getServerSession(authOptions)
  if (!session?.user?.email) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  const body = await req.json()
  const { id } = await context.params

  // Rate limiting by IP
  const ip = req.headers.get('x-forwarded-for')?.split(',')[0]?.trim() || '0.0.0.0'
  const { rateLimit } = await import('@/lib/rateLimit')
  const limitCheck = rateLimit(`messages:reply:${ip}`, 5, 60_000)
  if (!limitCheck.allowed) {
    return NextResponse.json({ error: 'Too many requests' }, { status: 429, headers: { 'Retry-After': String(Math.ceil(limitCheck.retryAfterMs / 1000)) } as any })
  }

  // Validate payload
  const { AdminReplySchema } = await import('@/lib/validation')
  const parsed = AdminReplySchema.safeParse({ conversationId: id, message: body?.message })
  if (!parsed.success) return NextResponse.json({ error: 'Invalid payload' }, { status: 400 })
  const { message } = parsed.data

  const convo = await prisma.conversation.findFirst({
    where: { id, OR: [{ userId: (session.user as any).id }, { email: session.user.email }] },
  })
  if (!convo) return NextResponse.json({ error: 'Not found' }, { status: 404 })

  await prisma.message.create({ data: { conversationId: id, senderType: 'USER', body: message } })
  await prisma.conversation.update({ where: { id }, data: { updatedAt: new Date() } })

  return NextResponse.json({ ok: true })
}
