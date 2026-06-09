import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { getCurrentUser, hasPermission } from '@/lib/rbac'

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params
    const user = await getCurrentUser()
    if (!user || !(await hasPermission(user, 'content:read'))) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const campaign = await prisma.emailCampaign.findUnique({
      where: { id },
      select: {
        status: true,
        totalRecipients: true,
        sentCount: true,
        failedCount: true,
        bouncedCount: true,
        startedAt: true,
        completedAt: true,
      },
    })

    if (!campaign) return NextResponse.json({ error: 'Not found' }, { status: 404 })

    return NextResponse.json(campaign)
  } catch {
    return NextResponse.json({ error: 'Failed to get status' }, { status: 500 })
  }
}
