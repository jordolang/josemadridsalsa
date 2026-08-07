import { NextRequest, NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import prisma from '@/lib/prisma'
import { logAuditWithRequest } from '@/lib/audit'

interface RouteParams {
  params: Promise<{ id: string; messageId: string }>
}

export async function PUT(req: NextRequest, { params }: RouteParams) {
  try {
    const session = await getServerSession(authOptions)
    if (!session?.user || !['ADMIN', 'DEVELOPER', 'STAFF'].includes((session.user as any).role)) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const { id: fundraiserId, messageId } = await params
    const body = await req.json()
    const { isHidden } = body as { isHidden?: boolean }

    if (typeof isHidden !== 'boolean') {
      return NextResponse.json({ error: 'isHidden boolean is required' }, { status: 400 })
    }

    // Verify message belongs to this fundraiser
    const existing = await prisma.fundraiserMessage.findFirst({
      where: { id: messageId, fundraiserId },
    })

    if (!existing) {
      return NextResponse.json({ error: 'Message not found' }, { status: 404 })
    }

    const updated = await prisma.fundraiserMessage.update({
      where: { id: messageId },
      data: { isHidden },
      select: {
        id: true,
        authorName: true,
        authorEmail: true,
        content: true,
        isHidden: true,
        isApproved: true,
        createdAt: true,
      },
    })

    await logAuditWithRequest(
      {
        userId: (session.user as { id: string }).id,
        action: 'update',
        entityType: 'fundraiser_message',
        entityId: updated.id,
        changes: { isHidden: { from: existing.isHidden, to: updated.isHidden } },
      },
      req
    )

    return NextResponse.json({ message: updated })
  } catch (error) {
    console.error('[Admin Fundraiser Messages PUT]', error)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}
