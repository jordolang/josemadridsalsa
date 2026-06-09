import Link from 'next/link'
import { Headphones, MessageSquare } from 'lucide-react'
import { prisma } from '@/lib/prisma'
import { requireAnyPermission } from '@/lib/rbac'
import { Badge } from '@/components/ui/badge'
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table'

export const dynamic = 'force-dynamic'

type Search = { status?: string; page?: string }

const STATUS_OPTIONS = [
  { value: 'ALL', label: 'All' },
  { value: 'WAITING', label: 'Waiting' },
  { value: 'ACTIVE', label: 'Active' },
  { value: 'CLOSED', label: 'Closed' },
  { value: 'OFFLINE', label: 'Offline (missed)' },
] as const

const PAGE_SIZE = 25

const STATUS_VARIANT: Record<string, 'default' | 'secondary' | 'destructive' | 'outline'> = {
  WAITING: 'destructive',
  ACTIVE: 'default',
  CLOSED: 'outline',
  OFFLINE: 'secondary',
}

export default async function LiveChatHistoryPage({
  searchParams,
}: {
  searchParams: Promise<Search>
}) {
  await requireAnyPermission(['messaging:read'])
  const { status = 'ALL', page = '1' } = await searchParams
  const pageNumber = Math.max(1, Number(page) || 1)
  const where = status === 'ALL' ? {} : { status: status as 'WAITING' | 'ACTIVE' | 'CLOSED' | 'OFFLINE' }

  const [threads, total] = await Promise.all([
    prisma.chatThread.findMany({
      where,
      orderBy: { startedAt: 'desc' },
      take: PAGE_SIZE,
      skip: (pageNumber - 1) * PAGE_SIZE,
      include: {
        messages: {
          take: 1,
          orderBy: { createdAt: 'desc' },
          select: { content: true },
        },
      },
    }),
    prisma.chatThread.count({ where }),
  ])

  return (
    <div className="space-y-6">
      <header className="flex items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-foreground flex items-center gap-2">
            <Headphones className="h-6 w-6" />
            Live chat history
          </h1>
          <p className="text-sm text-muted-foreground">
            Every customer conversation, shared across all admin accounts.
          </p>
        </div>
      </header>

      <nav className="flex flex-wrap gap-2">
        {STATUS_OPTIONS.map((option) => {
          const active = status === option.value
          return (
            <Link
              key={option.value}
              href={`/admin/messages/live?status=${option.value}`}
              className={`rounded-full border px-3 py-1 text-sm ${
                active ? 'bg-foreground text-background border-foreground' : 'bg-card text-foreground hover:bg-muted'
              }`}
            >
              {option.label}
            </Link>
          )
        })}
      </nav>

      <div className="rounded-md border">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Visitor</TableHead>
              <TableHead>Status</TableHead>
              <TableHead>Source</TableHead>
              <TableHead>Started</TableHead>
              <TableHead>Last activity</TableHead>
              <TableHead>Last message</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {threads.length === 0 ? (
              <TableRow>
                <TableCell colSpan={6} className="text-center text-muted-foreground py-8">
                  <MessageSquare className="mx-auto mb-2 h-6 w-6" />
                  No chats yet.
                </TableCell>
              </TableRow>
            ) : (
              threads.map((thread) => (
                <TableRow key={thread.id}>
                  <TableCell>
                    <Link href={`/admin/messages/live/${thread.id}`} className="font-medium hover:underline">
                      {thread.customerName ?? 'Visitor'}
                    </Link>
                    <div className="text-xs text-muted-foreground">
                      {thread.customerEmail ?? '—'}
                    </div>
                  </TableCell>
                  <TableCell>
                    <Badge variant={STATUS_VARIANT[thread.status] ?? 'outline'}>{thread.status}</Badge>
                  </TableCell>
                  <TableCell className="text-sm text-muted-foreground">{thread.source ?? '—'}</TableCell>
                  <TableCell className="text-sm">{thread.startedAt.toLocaleString()}</TableCell>
                  <TableCell className="text-sm">{thread.lastMessageAt.toLocaleString()}</TableCell>
                  <TableCell className="max-w-xs truncate text-sm text-muted-foreground">
                    {thread.messages[0]?.content ?? '—'}
                  </TableCell>
                </TableRow>
              ))
            )}
          </TableBody>
        </Table>
      </div>

      <Pagination total={total} page={pageNumber} status={status} />
    </div>
  )
}

function Pagination({ total, page, status }: { total: number; page: number; status: string }) {
  const totalPages = Math.max(1, Math.ceil(total / PAGE_SIZE))
  if (totalPages <= 1) return null
  return (
    <div className="flex items-center justify-between text-sm">
      <span className="text-muted-foreground">
        Page {page} of {totalPages} • {total} total
      </span>
      <div className="space-x-2">
        {page > 1 ? (
          <Link className="underline" href={`/admin/messages/live?status=${status}&page=${page - 1}`}>
            Previous
          </Link>
        ) : null}
        {page < totalPages ? (
          <Link className="underline" href={`/admin/messages/live?status=${status}&page=${page + 1}`}>
            Next
          </Link>
        ) : null}
      </div>
    </div>
  )
}
