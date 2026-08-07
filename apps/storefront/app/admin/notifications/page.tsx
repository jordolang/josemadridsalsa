import { redirect } from 'next/navigation'

import { prisma } from '@/lib/prisma'
import { getCurrentUser } from '@/lib/rbac'
import { isNextControlFlowError } from '@/lib/next-errors'
import { NotificationList } from '@/components/admin/NotificationList'

export const metadata = { title: 'Notifications | Jose Madrid Salsa Admin' }

export default async function NotificationsPage() {
  try {
    const user = await getCurrentUser()
    if (!user) redirect('/admin')

    const notifications = await prisma.notification.findMany({
      where: { userId: user.id },
      // Unread first, newest within each group — the list is a worklist, not a log.
      orderBy: [{ isRead: 'asc' }, { createdAt: 'desc' }],
      take: 100,
    })

    const unread = notifications.filter((n) => !n.isRead).length

    return (
      <div className="space-y-6">
        <div>
          <h1 className="text-2xl font-bold tracking-tight">Notifications</h1>
          <p className="text-sm text-muted-foreground">
            {unread > 0 ? `${unread} unread` : 'All caught up'}
          </p>
        </div>

        <NotificationList
          notifications={notifications.map((n) => ({
            id: n.id,
            type: n.type,
            severity: n.severity,
            title: n.title,
            message: n.message,
            link: n.link,
            isRead: n.isRead,
            createdAt: n.createdAt.toISOString(),
          }))}
        />
      </div>
    )
  } catch (error) {
    if (isNextControlFlowError(error)) throw error
    console.error('[Notifications] Error rendering:', error)
    throw new Error('Failed to load notifications')
  }
}
