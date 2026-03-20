import { NextRequest, NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import prisma from '@/lib/prisma'

interface RouteParams {
  params: Promise<{ id: string }>
}

export async function GET(req: NextRequest, { params }: RouteParams) {
  try {
    const session = await getServerSession(authOptions)
    if (!session?.user || !['ADMIN', 'DEVELOPER', 'STAFF'].includes((session.user as any).role)) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const { id: fundraiserId } = await params

    const fundraiser = await prisma.fundraiser.findUnique({
      where: { id: fundraiserId },
      select: { id: true },
    })

    if (!fundraiser) {
      return NextResponse.json({ error: 'Fundraiser not found' }, { status: 404 })
    }

    const messages = await prisma.fundraiserMessage.findMany({
      where: { fundraiserId },
      orderBy: { createdAt: 'desc' },
      select: {
        id: true,
        authorName: true,
        authorEmail: true,
        authorAvatar: true,
        content: true,
        isHidden: true,
        isApproved: true,
        createdAt: true,
      },
    })

    return NextResponse.json({ messages })
  } catch (error) {
    console.error('[Admin Fundraiser Messages GET]', error)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}
