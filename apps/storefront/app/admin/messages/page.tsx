import Link from 'next/link'
import { redirect } from 'next/navigation'
import { Info, MessageSquare, Search } from 'lucide-react'

import { prisma } from '@/lib/prisma'
import { getCurrentUser, hasPermission } from '@/lib/rbac'
import { Alert, AlertDescription } from '@/components/ui/alert'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from '@/components/ui/card'
import { Input } from '@/components/ui/input'
import {
  Pagination,
  PaginationContent,
  PaginationItem,
  PaginationLink,
  PaginationNext,
  PaginationPrevious,
} from '@/components/ui/pagination'
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table'

type SearchParams = {
  status?: string
  q?: string
  page?: string
}

const STATUS_OPTIONS = [
  { value: 'ALL', label: 'All' },
  { value: 'OPEN', label: 'Open' },
  { value: 'CLOSED', label: 'Closed' },
] as const

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

export default async function MessagesPage({
  searchParams,
}: {
  searchParams: Promise<SearchParams>
}) {
  const params = await searchParams
  const user = await getCurrentUser()

  if (!user || !(await hasPermission(user, 'messaging:read'))) {
    redirect('/admin')
  }

  const { conversations, total, page, totalPages, openCount, unreadCount } =
    await getConversations(params)

  const statusCandidate = params.status?.toUpperCase()
  const activeStatus = STATUS_OPTIONS.some(
    (option) => option.value === statusCandidate
  )
    ? (statusCandidate as 'ALL' | 'OPEN' | 'CLOSED')
    : 'ALL'

  const buildPageHref = (targetPage: number) => {
    const qs = new URLSearchParams()
    qs.set('page', String(targetPage))
    if (params.status) qs.set('status', activeStatus)
    if (params.q) qs.set('q', params.q)
    return `/admin/messages?${qs.toString()}`
  }

  return (
    <div className="space-y-6">
      <div className="flex flex-col gap-4 md:flex-row md:items-start md:justify-between">
        <div>
          <h1 className="text-2xl font-bold tracking-tight">
            Contact Form Messages
          </h1>
          <p className="text-sm text-muted-foreground">
            Review and respond to contact form submissions from the storefront
          </p>
        </div>
        <Alert className="w-fit">
          <Info className="size-4" />
          <AlertDescription>
            {unreadCount === 0
              ? 'All caught up! No unread contact form messages.'
              : `${unreadCount} contact form message(s) awaiting reply.`}
          </AlertDescription>
        </Alert>
      </div>

      <div className="grid gap-4 sm:grid-cols-3">
        <Card>
          <CardHeader className="pb-2">
            <CardDescription className="text-xs font-medium uppercase tracking-wide">
              Total submissions
            </CardDescription>
            <CardTitle className="text-2xl font-bold tabular-nums">
              {total.toLocaleString()}
            </CardTitle>
          </CardHeader>
        </Card>
        <Card>
          <CardHeader className="pb-2">
            <CardDescription className="text-xs font-medium uppercase tracking-wide">
              Open messages
            </CardDescription>
            <CardTitle className="text-2xl font-bold tabular-nums">
              {openCount.toLocaleString()}
            </CardTitle>
          </CardHeader>
        </Card>
        <Card>
          <CardHeader className="pb-2">
            <CardDescription className="text-xs font-medium uppercase tracking-wide">
              Unread contact messages
            </CardDescription>
            <CardTitle className="text-2xl font-bold tabular-nums">
              {unreadCount.toLocaleString()}
            </CardTitle>
          </CardHeader>
        </Card>
      </div>

      <Card>
        <CardContent className="space-y-4 pt-6">
          <form
            className="grid gap-4 md:grid-cols-[2fr_auto] lg:grid-cols-[2fr_auto_auto]"
            method="get"
          >
            <div className="relative">
              <Search className="pointer-events-none absolute left-3 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" />
              <Input
                type="search"
                name="q"
                placeholder="Search by subject, customer, or email"
                defaultValue={params.q}
                className="pl-9"
              />
            </div>
            <input type="hidden" name="status" value={activeStatus} />
            <Button
              type="submit"
              variant="outline"
              className="justify-self-start md:justify-self-end"
            >
              Search
            </Button>
            <Button asChild variant="ghost" className="hidden lg:inline-flex">
              <Link href="/admin/messages">Reset</Link>
            </Button>
          </form>
          <div className="flex flex-wrap items-center gap-2">
            {STATUS_OPTIONS.map((option) => {
              const isActive = option.value === activeStatus
              const href =
                option.value === 'ALL'
                  ? `/admin/messages${
                      params.q ? `?q=${encodeURIComponent(params.q)}` : ''
                    }`
                  : `/admin/messages?status=${option.value}${
                      params.q ? `&q=${encodeURIComponent(params.q)}` : ''
                    }`
              return (
                <Button
                  key={option.value}
                  asChild
                  variant={isActive ? 'default' : 'outline'}
                  size="sm"
                >
                  <Link href={href}>{option.label}</Link>
                </Button>
              )
            })}
          </div>
        </CardContent>
      </Card>

      <div className="rounded-lg border">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Subject</TableHead>
              <TableHead>Customer</TableHead>
              <TableHead className="text-right">Messages</TableHead>
              <TableHead>Updated</TableHead>
              <TableHead>Status</TableHead>
              <TableHead className="text-right">Actions</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {conversations.length === 0 ? (
              <TableRow>
                <TableCell
                  colSpan={6}
                  className="py-12 text-center text-muted-foreground"
                >
                  No contact form messages found.
                </TableCell>
              </TableRow>
            ) : (
              conversations.map((conversation) => {
                const latestMessage = conversation.messages[0]
                const hasUnread =
                  latestMessage?.senderType === 'USER' &&
                  latestMessage?.readAt === null
                return (
                  <TableRow key={conversation.id}>
                    <TableCell>
                      <div className="flex items-start gap-2">
                        <MessageSquare className="mt-0.5 size-4 shrink-0 text-muted-foreground" />
                        <div>
                          <p className="font-medium">
                            {conversation.subject || 'General Inquiry'}
                          </p>
                          {latestMessage && (
                            <p className="mt-1 line-clamp-1 text-xs text-muted-foreground">
                              {latestMessage.body}
                            </p>
                          )}
                        </div>
                      </div>
                    </TableCell>
                    <TableCell className="text-muted-foreground">
                      {conversation.user?.name ||
                        conversation.user?.email ||
                        conversation.email ||
                        'Anonymous'}
                    </TableCell>
                    <TableCell className="text-right tabular-nums text-muted-foreground">
                      {conversation._count.messages.toLocaleString()}
                    </TableCell>
                    <TableCell className="text-muted-foreground">
                      {conversation.updatedAt.toLocaleString()}
                    </TableCell>
                    <TableCell>
                      <div className="flex items-center gap-2">
                        <Badge
                          variant={
                            conversation.status === 'OPEN'
                              ? 'default'
                              : 'outline'
                          }
                        >
                          {conversation.status}
                        </Badge>
                        {hasUnread && (
                          <Badge variant="warning">Unread</Badge>
                        )}
                      </div>
                    </TableCell>
                    <TableCell className="text-right">
                      <Button asChild variant="ghost" size="sm">
                        <Link href={`/admin/messages/${conversation.id}`}>
                          View
                        </Link>
                      </Button>
                    </TableCell>
                  </TableRow>
                )
              })
            )}
          </TableBody>
        </Table>
      </div>

      {totalPages > 1 && (
        <Pagination>
          <PaginationContent>
            {page > 1 && (
              <PaginationItem>
                <PaginationPrevious href={buildPageHref(page - 1)} />
              </PaginationItem>
            )}
            <PaginationItem>
              <PaginationLink href="#" isActive>
                {page} / {totalPages}
              </PaginationLink>
            </PaginationItem>
            {page < totalPages && (
              <PaginationItem>
                <PaginationNext href={buildPageHref(page + 1)} />
              </PaginationItem>
            )}
          </PaginationContent>
        </Pagination>
      )}
    </div>
  )
}
