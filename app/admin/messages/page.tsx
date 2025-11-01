import Link from 'next/link'
import { redirect } from 'next/navigation'
import { MessageSquare, Search } from 'lucide-react'
import { prisma } from '@/lib/prisma'
import { getCurrentUser, hasPermission } from '@/lib/rbac'
import { Card } from '@/components/ui/card'
import { Input } from '@/components/ui/input'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'

type SearchParams = {
  status?: string
  q?: string
  page?: string
}

const STATUS_OPTIONS = [
  { value: 'ALL', label: 'All' },
  { value: 'OPEN', label: 'Open' },
  { value: 'CLOSED', label: 'Closed' },
]

async function getConversations(searchParams: SearchParams) {
  const page = Number(searchParams.page) || 1
  const limit = 20
  const skip = (page - 1) * limit

  const where: any = {}

  const statusFilter = searchParams.status?.toUpperCase()
  if (statusFilter && statusFilter !== 'ALL') {
    where.status = statusFilter
  }

  if (searchParams.q) {
    where.OR = [
      { subject: { contains: searchParams.q, mode: 'insensitive' } },
      { email: { contains: searchParams.q, mode: 'insensitive' } },
      {
        user: {
          OR: [
            { email: { contains: searchParams.q, mode: 'insensitive' } },
            { name: { contains: searchParams.q, mode: 'insensitive' } },
          ],
        },
      },
    ]
  }

  const [conversations, total, openCount, unreadCount] = await Promise.all([
    prisma.conversation.findMany({
      where,
      skip,
      take: limit,
      orderBy: { updatedAt: 'desc' },
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
        _count: {
          select: {
            messages: true,
          },
        },
      },
    }),
    prisma.conversation.count({ where }),
    prisma.conversation.count({ where: { status: 'OPEN' } }),
    prisma.message.count({ where: { senderType: 'USER', readAt: null } }),
  ])

  return {
    conversations,
    total,
    page,
    totalPages: Math.ceil(total / limit),
    openCount,
    unreadCount,
  }
}

export default async function MessagesPage({ searchParams }: { searchParams: SearchParams }) {
  const user = await getCurrentUser()

  if (!user || !(await hasPermission(user, 'messaging:read'))) {
    redirect('/admin')
  }

  const { conversations, total, page, totalPages, openCount, unreadCount } = await getConversations(
    searchParams
  )

  const statusCandidate = searchParams.status?.toUpperCase()
  const activeStatus = STATUS_OPTIONS.some((option) => option.value === statusCandidate)
    ? (statusCandidate as 'ALL' | 'OPEN' | 'CLOSED')
    : 'ALL'

  return (
    <div className="space-y-6">
      <div className="flex flex-col gap-2 md:flex-row md:items-center md:justify-between">
        <div>
          <h1 className="text-3xl font-bold">Customer Messages</h1>
          <p className="text-slate-600">
            Track conversations from customers across the storefront
          </p>
        </div>
        <div className="rounded-lg bg-amber-50 px-4 py-3 text-sm text-amber-800">
          {unreadCount === 0 ? 'All caught up! No unread messages.' : `${unreadCount} customer message(s) awaiting reply.`}
        </div>
      </div>

      <div className="grid gap-4 sm:grid-cols-3">
        <Card className="p-4">
          <p className="text-sm text-slate-600">Total conversations</p>
          <p className="mt-2 text-2xl font-semibold">{total.toLocaleString()}</p>
        </Card>
        <Card className="p-4">
          <p className="text-sm text-slate-600">Open conversations</p>
          <p className="mt-2 text-2xl font-semibold text-blue-600">{openCount.toLocaleString()}</p>
        </Card>
        <Card className="p-4">
          <p className="text-sm text-slate-600">Unread messages</p>
          <p className="mt-2 text-2xl font-semibold text-amber-600">{unreadCount.toLocaleString()}</p>
        </Card>
      </div>

      <Card className="p-4">
        <form className="grid gap-4 md:grid-cols-[2fr_auto] lg:grid-cols-[2fr_auto_auto]" method="get">
          <div className="relative">
            <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
            <Input
              type="search"
              name="q"
              placeholder="Search by subject, customer, or email"
              defaultValue={searchParams.q}
              className="pl-9"
            />
          </div>
          <input type="hidden" name="status" value={activeStatus} />
          <Button type="submit" variant="outline" className="justify-self-start md:justify-self-end">
            Search
          </Button>
          <Link
            href="/admin/messages"
            className="hidden rounded-md border border-slate-200 px-4 py-2 text-sm font-medium text-slate-600 hover:text-blue-600 lg:inline-block"
          >
            Reset
          </Link>
        </form>
        <div className="mt-4 flex flex-wrap items-center gap-2">
          {STATUS_OPTIONS.map((option) => {
            const isActive = option.value === activeStatus
            const href =
              option.value === 'ALL'
                ? `/admin/messages${searchParams.q ? `?q=${encodeURIComponent(searchParams.q)}` : ''}`
                : `/admin/messages?status=${option.value}${
                    searchParams.q ? `&q=${encodeURIComponent(searchParams.q)}` : ''
                  }`
            return (
              <Link
                key={option.value}
                href={href}
                className={`rounded-full px-3 py-1 text-sm font-medium ${
                  isActive
                    ? 'bg-blue-600 text-white'
                    : 'bg-slate-100 text-slate-600 hover:bg-slate-200'
                }`}
              >
                {option.label}
              </Link>
            )
          })}
        </div>
      </Card>

      <Card>
        <div className="overflow-x-auto">
          <table className="w-full min-w-[640px]">
            <thead className="border-b bg-slate-50 text-sm text-slate-600">
              <tr>
                <th className="px-4 py-3 text-left font-medium">Subject</th>
                <th className="px-4 py-3 text-left font-medium">Customer</th>
                <th className="px-4 py-3 text-left font-medium">Messages</th>
                <th className="px-4 py-3 text-left font-medium">Updated</th>
                <th className="px-4 py-3 text-left font-medium">Status</th>
                <th className="px-4 py-3 text-right font-medium">Actions</th>
              </tr>
            </thead>
            <tbody className="text-sm">
              {conversations.length === 0 ? (
                <tr>
                  <td colSpan={6} className="px-6 py-12 text-center text-slate-500">
                    No conversations found.
                  </td>
                </tr>
              ) : (
                conversations.map((conversation) => {
                  const latestMessage = conversation.messages[0]
                  const hasUnread =
                    latestMessage?.senderType === 'USER' && latestMessage?.readAt === null
                  return (
                    <tr key={conversation.id} className="border-b last:border-0">
                      <td className="px-4 py-4">
                        <div className="flex items-center gap-2">
                          <MessageSquare className="h-4 w-4 text-slate-400" />
                          <div>
                            <p className="font-medium text-slate-900">
                              {conversation.subject || 'General Inquiry'}
                            </p>
                            {latestMessage && (
                              <p className="mt-1 line-clamp-1 text-xs text-slate-500">
                                {latestMessage.body}
                              </p>
                            )}
                          </div>
                        </div>
                      </td>
                      <td className="px-4 py-4 text-slate-600">
                        {conversation.user?.name ||
                          conversation.user?.email ||
                          conversation.email ||
                          'Anonymous'}
                      </td>
                      <td className="px-4 py-4 text-slate-600">
                        {conversation._count.messages.toLocaleString()}
                      </td>
                      <td className="px-4 py-4 text-slate-600">
                        {conversation.updatedAt.toLocaleString()}
                      </td>
                      <td className="px-4 py-4">
                        <div className="flex items-center gap-2">
                          <Badge
                            className={
                              conversation.status === 'OPEN'
                                ? 'bg-blue-100 text-blue-700'
                                : 'bg-slate-100 text-slate-600'
                            }
                          >
                            {conversation.status}
                          </Badge>
                          {hasUnread && (
                            <span className="text-xs font-medium text-amber-600">Unread</span>
                          )}
                        </div>
                      </td>
                      <td className="px-4 py-4 text-right">
                        <Link
                          href={`/admin/messages/${conversation.id}`}
                          className="text-sm font-medium text-blue-600 hover:underline"
                        >
                          View
                        </Link>
                      </td>
                    </tr>
                  )
                })
              )}
            </tbody>
          </table>
        </div>

        {totalPages > 1 && (
          <div className="flex items-center justify-between border-t px-6 py-4 text-sm text-slate-600">
            <span>
              Page {page} of {totalPages}
            </span>
            <div className="flex items-center gap-2">
              <Link
                href={`/admin/messages?page=${Math.max(page - 1, 1)}${
                  searchParams.status ? `&status=${activeStatus}` : ''
                }${searchParams.q ? `&q=${encodeURIComponent(searchParams.q)}` : ''}`}
                className={`rounded-md border px-3 py-1 ${
                  page === 1
                    ? 'pointer-events-none border-slate-200 text-slate-300'
                    : 'border-slate-200 text-slate-600 hover:border-blue-300 hover:text-blue-600'
                }`}
              >
                Previous
              </Link>
              <Link
                href={`/admin/messages?page=${Math.min(page + 1, totalPages)}${
                  searchParams.status ? `&status=${activeStatus}` : ''
                }${searchParams.q ? `&q=${encodeURIComponent(searchParams.q)}` : ''}`}
                className={`rounded-md border px-3 py-1 ${
                  page === totalPages
                    ? 'pointer-events-none border-slate-200 text-slate-300'
                    : 'border-slate-200 text-slate-600 hover:border-blue-300 hover:text-blue-600'
                }`}
              >
                Next
              </Link>
            </div>
          </div>
        )}
      </Card>
    </div>
  )
}
