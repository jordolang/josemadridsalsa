import { redirect } from 'next/navigation'

import { prisma } from '@/lib/prisma'
import { getCurrentUser } from '@/lib/rbac'
import { isNextControlFlowError } from '@/lib/next-errors'
import { NotificationList } from '@/components/admin/NotificationList'
import { emailAlertDetails } from '@/lib/inbox/alert-card'
import { INBOUND_EMAIL_ENTITY } from '@/lib/inbox/resolution'

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

    // Customer-email alerts are laid out from the email itself, not the flattened message.
    const emailIds = notifications
      .filter((n) => n.entityType === INBOUND_EMAIL_ENTITY && n.entityId)
      .map((n) => n.entityId as string)
    const emails = emailIds.length
      ? await prisma.inboundEmail.findMany({
          where: { id: { in: emailIds } },
          include: { steps: true },
        })
      : []
    const emailById = new Map(emails.map((email) => [email.id, emailAlertDetails(email)]))

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
            email:
              n.entityType === INBOUND_EMAIL_ENTITY && n.entityId
                ? (emailById.get(n.entityId) ?? null)
                : null,
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
