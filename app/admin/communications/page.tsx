import Link from 'next/link'
import { redirect } from 'next/navigation'
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

export const metadata = {
  title: 'Communications | Admin',
  description: 'Messaging, email, and feedback management',
}

async function getCommunicationOverview() {
  const [
    openConversations,
    closedConversations,
    unreadMessages,
    emailTemplates,
    pendingReviews,
    recentConversations,
  ] = await Promise.all([
    prisma.conversation.count({ where: { status: 'OPEN' } }),
    prisma.conversation.count({ where: { status: 'CLOSED' } }),
    prisma.message.count({ where: { readAt: null, senderType: 'USER' } }),
    prisma.emailTemplate.count(),
    prisma.review.count({ where: { status: 'PENDING' } }),
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
    recentConversations,
  }
}

const statusStyles = {
  OPEN: 'bg-blue-100 text-blue-800',
  CLOSED: 'bg-slate-100 text-slate-700',
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
          <p className="text-slate-600">
            Manage customer conversations, email templates, and feedback
          </p>
        </div>
      </div>

      <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
        <Card className="p-6">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm text-slate-600">Open Conversations</p>
              <p className="mt-2 text-3xl font-bold text-slate-900">
                {overview.openConversations.toLocaleString()}
              </p>
            </div>
            <div className="rounded-full bg-blue-100 p-3">
              <MessageSquare className="h-6 w-6 text-blue-600" />
            </div>
          </div>
          <p className="mt-4 text-sm text-slate-500">
            {overview.unreadMessages} messages waiting for response
          </p>
        </Card>

        <Card className="p-6">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm text-slate-600">Archived Conversations</p>
              <p className="mt-2 text-3xl font-bold text-slate-900">
                {overview.closedConversations.toLocaleString()}
              </p>
            </div>
            <div className="rounded-full bg-slate-100 p-3">
              <Users className="h-6 w-6 text-slate-600" />
            </div>
          </div>
          <p className="mt-4 text-sm text-slate-500">
            All closed conversations remain searchable.
          </p>
        </Card>

        <Card className="p-6">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm text-slate-600">Email Templates</p>
              <p className="mt-2 text-3xl font-bold text-slate-900">
                {overview.emailTemplates.toLocaleString()}
              </p>
            </div>
            <div className="rounded-full bg-emerald-100 p-3">
              <Mail className="h-6 w-6 text-emerald-600" />
            </div>
          </div>
          <p className="mt-4 text-sm text-slate-500">
            Templates for order notifications and marketing.
          </p>
        </Card>

        <Card className="p-6">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm text-slate-600">Pending Reviews</p>
              <p className="mt-2 text-3xl font-bold text-slate-900">
                {overview.pendingReviews.toLocaleString()}
              </p>
            </div>
            <div className="rounded-full bg-amber-100 p-3">
              <Star className="h-6 w-6 text-amber-500" />
            </div>
          </div>
          <p className="mt-4 text-sm text-slate-500">
            Awaiting moderation before appearing on the site.
          </p>
        </Card>
      </div>

      <div className="grid gap-4 lg:grid-cols-[2fr_1fr]">
        <Card className="p-6">
          <div className="mb-4 flex items-center justify-between">
            <div>
              <h2 className="text-xl font-semibold">Recent Conversations</h2>
              <p className="text-sm text-slate-600">
                Latest updates across customer support channels
              </p>
            </div>
            <Link
              href="/admin/messages"
              className="text-sm font-medium text-blue-600 hover:underline"
            >
              View all
            </Link>
          </div>

          {overview.recentConversations.length === 0 ? (
            <div className="py-10 text-center text-sm text-slate-500">
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
                    className="block rounded-lg border border-slate-200 bg-white p-4 hover:border-blue-300 hover:shadow-sm"
                  >
                    <div className="flex items-start justify-between gap-4">
                      <div>
                        <div className="flex items-center gap-2">
                          <p className="text-sm font-medium text-slate-900">
                            {conversation.subject || 'General Inquiry'}
                          </p>
                          <Badge className={statusStyles[conversation.status]}>
                            {conversation.status}
                          </Badge>
                        </div>
                        <p className="mt-1 text-sm text-slate-500">
                          {conversation.user?.name ||
                            conversation.user?.email ||
                            conversation.email ||
                            'Anonymous customer'}
                        </p>
                      </div>
                      <p className="text-xs text-slate-500">
                        {conversation.updatedAt.toLocaleString()}
                      </p>
                    </div>
                    {latestMessage && (
                      <p className="mt-2 line-clamp-2 text-sm text-slate-600">
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
              className="block rounded-md border border-slate-200 px-4 py-3 text-sm font-medium text-slate-700 hover:border-blue-300 hover:text-blue-600"
            >
              Manage customer messages
            </Link>
            {canManageEmails && (
              <Link
                href="/admin/emails"
                className="block rounded-md border border-slate-200 px-4 py-3 text-sm font-medium text-slate-700 hover:border-blue-300 hover:text-blue-600"
              >
                Edit email templates
              </Link>
            )}
            {canViewReviews && (
              <Link
                href="/admin/reviews"
                className="block rounded-md border border-slate-200 px-4 py-3 text-sm font-medium text-slate-700 hover:border-blue-300 hover:text-blue-600"
              >
                Moderate product reviews
              </Link>
            )}
            {canReply ? (
              <p className="rounded-md bg-emerald-50 px-4 py-3 text-xs text-emerald-700">
                You have reply access. Respond directly to customer inquiries.
              </p>
            ) : (
              <p className="rounded-md bg-amber-50 px-4 py-3 text-xs text-amber-700">
                You have read-only access. Contact an admin to send replies.
              </p>
            )}
          </div>
        </Card>
      </div>
    </div>
  )
}
