import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { getCurrentUser, hasPermission } from '@/lib/rbac'
import { logAuditWithRequest } from '@/lib/audit'
import { SubscriberStatus, SuppressionReason } from '@prisma/client'

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params
    const user = await getCurrentUser()
    if (!user || !(await hasPermission(user, 'content:write'))) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const body = await request.json() as {
      action: string
      subscriberIds: string[]
      targetListId?: string
      status?: SubscriberStatus
    }
    const { action, subscriberIds, targetListId, status } = body

    if (!action || !subscriberIds || subscriberIds.length === 0) {
      return NextResponse.json({ error: 'Missing required fields' }, { status: 400 })
    }

    // Logged once up front rather than per branch: every case below mutates subscriber
    // records and returns from inside the switch, so a single entry naming the action and
    // the affected count is both simpler and harder to leave out of a new branch.
    await logAuditWithRequest(
      {
        userId: user.id,
        action: `bulk_${action}`,
        entityType: 'mailing_list',
        entityId: id,
        changes: { subscriberCount: subscriberIds.length, targetListId, status },
      },
      request
    )

    switch (action) {
      case 'delete':
        await prisma.mailingListSubscriber.deleteMany({
          where: { id: { in: subscriberIds }, listId: id },
        })
        return NextResponse.json({ success: true, affected: subscriberIds.length })

      case 'updateStatus':
        if (!status) return NextResponse.json({ error: 'Status required' }, { status: 400 })
        await prisma.mailingListSubscriber.updateMany({
          where: { id: { in: subscriberIds }, listId: id },
          data: {
            status,
            unsubscribedAt: status === 'UNSUBSCRIBED' ? new Date() : undefined,
          },
        })
        return NextResponse.json({ success: true, affected: subscriberIds.length })

      case 'moveTo': {
        if (!targetListId) return NextResponse.json({ error: 'Target list required' }, { status: 400 })
        const subs = await prisma.mailingListSubscriber.findMany({
          where: { id: { in: subscriberIds }, listId: id },
        })
        for (const sub of subs) {
          await prisma.mailingListSubscriber.upsert({
            where: { listId_email: { listId: targetListId, email: sub.email } },
            create: {
              listId: targetListId,
              email: sub.email,
              firstName: sub.firstName,
              lastName: sub.lastName,
              source: 'moved',
              status: sub.status,
            },
            update: {},
          })
        }
        await prisma.mailingListSubscriber.deleteMany({
          where: { id: { in: subscriberIds }, listId: id },
        })
        return NextResponse.json({ success: true, affected: subs.length })
      }

      case 'copyTo': {
        if (!targetListId) return NextResponse.json({ error: 'Target list required' }, { status: 400 })
        const subsC = await prisma.mailingListSubscriber.findMany({
          where: { id: { in: subscriberIds }, listId: id },
        })
        for (const sub of subsC) {
          await prisma.mailingListSubscriber.upsert({
            where: { listId_email: { listId: targetListId, email: sub.email } },
            create: {
              listId: targetListId,
              email: sub.email,
              firstName: sub.firstName,
              lastName: sub.lastName,
              source: 'copied',
              status: sub.status,
            },
            update: {},
          })
        }
        return NextResponse.json({ success: true, affected: subsC.length })
      }

      case 'suppress': {
        const subsS = await prisma.mailingListSubscriber.findMany({
          where: { id: { in: subscriberIds }, listId: id },
          select: { email: true },
        })
        for (const sub of subsS) {
          await prisma.emailSuppression.upsert({
            where: { email: sub.email },
            create: { email: sub.email, reason: SuppressionReason.MANUAL, source: 'bulk_action' },
            update: { reason: SuppressionReason.MANUAL },
          })
        }
        await prisma.mailingListSubscriber.updateMany({
          where: { id: { in: subscriberIds }, listId: id },
          data: { status: 'UNSUBSCRIBED' },
        })
        return NextResponse.json({ success: true, affected: subsS.length })
      }

      default:
        return NextResponse.json({ error: 'Unknown action' }, { status: 400 })
    }
  } catch (error) {
    console.error('Bulk action error:', error)
    return NextResponse.json({ error: 'Bulk action failed' }, { status: 500 })
  }
}
