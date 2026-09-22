import { NextRequest, NextResponse } from 'next/server'
import { z } from 'zod'

import { prisma } from '@/lib/prisma'
import { getCurrentUser } from '@/lib/rbac'
import {
  markAllNotificationsRead,
  markNotificationRead,
} from '@/lib/notifications/dispatch'
import { UnresolvedEmailError } from '@/lib/inbox/resolution'

const PatchSchema = z.object({
  /** Omit to clear everything unread for the current operator. */
  id: z.string().cuid().optional(),
})

export async function GET() {
  const user = await getCurrentUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const [notifications, unread] = await Promise.all([
    prisma.notification.findMany({
      where: { userId: user.id },
      orderBy: [{ isRead: 'asc' }, { createdAt: 'desc' }],
      take: 100,
    }),
    prisma.notification.count({ where: { userId: user.id, isRead: false } }),
  ])

  return NextResponse.json({ notifications, unread })
}

/** Mark one notification read, or all of them when no id is given. */
export async function PATCH(request: NextRequest) {
  try {
    const user = await getCurrentUser()
    if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

    const { id } = PatchSchema.parse(await request.json().catch(() => ({})))

    if (id) {
      // Scoped to the current user inside the helper, so an id from someone else's list
      // silently affects nothing rather than clearing their notification.
      await markNotificationRead(id, user.id)
      return NextResponse.json({ success: true, marked: 1 })
    }

    const marked = await markAllNotificationsRead(user.id)
    return NextResponse.json({ success: true, marked })
  } catch (error) {
    if (error instanceof z.ZodError) {
      return NextResponse.json({ error: error.issues[0].message }, { status: 400 })
    }
    // A customer-email alert that still has work attached refuses to clear. 409 rather
    // than 400: the request was well formed, the resource is simply not in a state where
    // it can be dismissed yet.
    if (error instanceof UnresolvedEmailError) {
      return NextResponse.json(
        { error: error.message, outstanding: error.outstanding },
        { status: 409 },
      )
    }
    console.error('Notification update error:', error)
    return NextResponse.json({ error: 'Failed to update notifications' }, { status: 500 })
  }
}
