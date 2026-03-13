import { NextRequest, NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import { prisma } from '@/lib/prisma'

export async function GET() {
  const session = await getServerSession(authOptions)
  if (!session?.user?.id || (session.user as any).role !== 'ADMIN') {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  const conversations = await prisma.conversation.findMany({
    orderBy: { updatedAt: 'desc' },
    include: {
      messages: { orderBy: { createdAt: 'desc' }, take: 1 },
      user: { select: { email: true } },
    },
  })

  return NextResponse.json(conversations)
}
