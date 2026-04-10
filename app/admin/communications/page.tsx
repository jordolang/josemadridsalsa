import Link from 'next/link'
import { redirect } from 'next/navigation'
import type { Metadata } from 'next'
import {
  Mail,
  MessageSquare,
  Star,
  Users,
} from 'lucide-react'
import { prisma } from '@/lib/prisma'
import { getCurrentUser, hasPermission, hasAnyPermission } from '@/lib/rbac'
import { Card } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { createMetadata } from '@/lib/metadata'

export const metadata: Metadata = createMetadata({
  title: 'Communications - Jose Madrid Salsa Admin',
  description: 'Messaging, email, and feedback management.',
  pathname: '/admin/communications',
})

async function getCommunicationOverview() {
  const [
    openConversations,
    closedConversations,
    unreadMessages,
    emailTemplates,
    pendingReviews,
    mailingLists,
    recentConversations,
  ] = await Promise.all([
    prisma.conversation.count({ where: { status: 'OPEN' } }),
    prisma.conversation.count({ where: { status: 'CLOSED' } }),
    prisma.message.count({ where: { readAt: null, senderType: 'USER' } }),
    prisma.emailTemplate.count(),
    prisma.review.count({ where: { status: 'PENDING' } }),
    prisma.mailingList.count(),
    prisma.conversation.findMany({
      orderBy: { updatedAt: 'desc' },
      take: 5,
      include: {
        user: {
          select: {
            email: true,
            name: true,
          },
        },
        messages: {
          orderBy: { createdAt: 'desc' },
          take: 1,
        },
      },
    }),
  ])

  return {
    openConversations,
    closedConversations,
    unreadMessages,
    emailTemplates,
    pendingReviews,
    mailingLists,
    recentConversations,
  }
}

const statusVariant: Record<'OPEN' | 'CLOSED', 'default' | 'secondary'> = {
  OPEN: 'default',
  CLOSED: 'secondary',
}

export default async function CommunicationsPage() {
  const user = await getCurrentUser()

  const canViewMessaging = await hasPermission(user, 'messaging:read')
  const canViewReviews = await hasPermission(user, 'content:read')

  if (!user || !canViewMessaging) {
    redirect('/admin')
  }

  const overview = await getCommunicationOverview()
  const canReply = await hasPermission(user, 'messaging:reply')
  const canManageEmails = await hasAnyPermission(user, ['content:read', 'content:write'])

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold">Communications</h1>
          <p className="text-muted-foreground">
            Manage customer conversations, email campaigns, mailing lists, and feedback
          </p>
        </div>
      </div>

      <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
        <Card className="p-6">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm text-muted-foreground">Open Conversations</p>
              <p className="mt-2 text-3xl font-bold text-foreground">
                {overview.openConversations.toLocaleString()}
              </p>
            </div>
            <div className="rounded-full bg-primary/10 p-3">
              <MessageSquare className="h-6 w-6 text-primary" />
            </div>
          </div>
          <p className="mt-4 text-sm text-muted-foreground">
            {overview.unreadMessages} messages waiting for response
          </p>
        </Card>

        <Card className="p-6">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm text-muted-foreground">Archived Conversations</p>
              <p className="mt-2 text-3xl font-bold text-foreground">
                {overview.closedConversations.toLocaleString()}
              </p>
            </div>
            <div className="rounded-full bg-muted p-3">
              <Users className="h-6 w-6 text-muted-foreground" />
            </div>
          </div>
          <p className="mt-4 text-sm text-muted-foreground">
            All closed conversations remain searchable.
          </p>
        </Card>

        <Card className="p-6">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm text-muted-foreground">Email Templates</p>
              <p className="mt-2 text-3xl font-bold text-foreground">
                {overview.emailTemplates.toLocaleString()}
              </p>
            </div>
            <div className="rounded-full bg-emerald-100 p-3">
              <Mail className="h-6 w-6 text-emerald-600" />
            </div>
          </div>
          <p className="mt-4 text-sm text-muted-foreground">
            Templates for order notifications and marketing.
          </p>
        </Card>

        <Card className="p-6">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm text-muted-foreground">Pending Reviews</p>
              <p className="mt-2 text-3xl font-bold text-foreground">
                {overview.pendingReviews.toLocaleString()}
              </p>
            </div>
            <div className="rounded-full bg-amber-100 p-3">
              <Star className="h-6 w-6 text-amber-500" />
            </div>
          </div>
          <p className="mt-4 text-sm text-muted-foreground">
            Awaiting moderation before appearing on the site.
          </p>
        </Card>
      </div>

      <div className="grid gap-4 lg:grid-cols-[2fr_1fr]">
        <Card className="p-6">
          <div className="mb-4 flex items-center justify-between">
            <div>
              <h2 className="text-xl font-semibold">Recent Conversations</h2>
              <p className="text-sm text-muted-foreground">
                Latest updates across customer support channels
              </p>
            </div>
            <Link
              href="/admin/messages"
              className="text-sm font-medium text-primary hover:underline"
            >
              View all
            </Link>
          </div>

          {overview.recentConversations.length === 0 ? (
            <div className="py-10 text-center text-sm text-muted-foreground">
              No customer conversations yet.
            </div>
          ) : (
            <div className="space-y-3">
              {overview.recentConversations.map((conversation) => {
                const latestMessage = conversation.messages[0]
                return (
                  <Link
                    key={conversation.id}
                    href={`/admin/messages/${conversation.id}`}
                    className="block rounded-lg border border-border bg-card p-4 hover:border-primary hover:shadow-sm"
                  >
                    <div className="flex items-start justify-between gap-4">
                      <div>
                        <div className="flex items-center gap-2">
                          <p className="text-sm font-medium text-foreground">
                            {conversation.subject || 'General Inquiry'}
                          </p>
                          <Badge variant={statusVariant[conversation.status]}>
                            {conversation.status}
                          </Badge>
                        </div>
                        <p className="mt-1 text-sm text-muted-foreground">
                          {conversation.user?.name ||
                            conversation.user?.email ||
                            conversation.email ||
                            'Anonymous customer'}
                        </p>
                      </div>
                      <p className="text-xs text-muted-foreground">
                        {conversation.updatedAt.toLocaleString()}
                      </p>
                    </div>
                    {latestMessage && (
                      <p className="mt-2 line-clamp-2 text-sm text-muted-foreground">
                        {latestMessage.body}
                      </p>
                    )}
                  </Link>
                )
              })}
            </div>
          )}
        </Card>

        <Card className="p-6">
          <h2 className="text-xl font-semibold">Quick Actions</h2>
          <div className="mt-4 space-y-3">
            <Link
              href="/admin/messages"
              className="block rounded-md border border-border px-4 py-3 text-sm font-medium text-foreground hover:border-primary hover:text-primary"
            >
              Manage customer messages
            </Link>
            {canManageEmails && (
              <Link
                href="/admin/emails"
                className="block rounded-md border border-border px-4 py-3 text-sm font-medium text-foreground hover:border-primary hover:text-primary"
              >
                Edit email templates
              </Link>
            )}
            {canViewReviews && (
              <Link
                href="/admin/reviews"
                className="block rounded-md border border-border px-4 py-3 text-sm font-medium text-foreground hover:border-primary hover:text-primary"
              >
                Moderate product reviews
              </Link>
            )}
            {canManageEmails && (
              <Link
                href="/admin/communications/lists"
                className="block rounded-md border border-border px-4 py-3 text-sm font-medium text-foreground hover:border-primary hover:text-primary"
              >
                Manage mailing lists & subscribers
              </Link>
            )}
            {canManageEmails && (
              <Link
                href="/admin/email-campaigns"
                className="block rounded-md border border-border px-4 py-3 text-sm font-medium text-foreground hover:border-primary hover:text-primary"
              >
                View email campaigns
              </Link>
            )}
            {canReply ? (
              <p className="rounded-md bg-emerald-50 px-4 py-3 text-xs text-emerald-700 dark:bg-emerald-950/40 dark:text-emerald-300">
                You have reply access. Respond directly to customer inquiries.
              </p>
            ) : (
              <p className="rounded-md bg-amber-50 px-4 py-3 text-xs text-amber-700 dark:bg-amber-950/40 dark:text-amber-300">
                You have read-only access. Contact an admin to send replies.
              </p>
            )}
          </div>
        </Card>
      </div>
    </div>
  )
}
