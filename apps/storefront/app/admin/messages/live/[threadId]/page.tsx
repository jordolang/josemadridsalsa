import Link from 'next/link'
import { notFound } from 'next/navigation'
import { ArrowLeft, Headphones } from 'lucide-react'
import { prisma } from '@/lib/prisma'
import { requireAnyPermission } from '@/lib/rbac'
import { Badge } from '@/components/ui/badge'

export const dynamic = 'force-dynamic'

const STATUS_VARIANT: Record<string, 'default' | 'secondary' | 'destructive' | 'outline'> = {
  WAITING: 'destructive',
  ACTIVE: 'default',
  CLOSED: 'outline',
  OFFLINE: 'secondary',
}

export default async function LiveChatThreadDetailPage({
  params,
}: {
  params: Promise<{ threadId: string }>
}) {
  await requireAnyPermission(['messaging:read'])
  const { threadId } = await params
  const thread = await prisma.chatThread.findUnique({
    where: { id: threadId },
    include: {
      messages: { orderBy: { createdAt: 'asc' } },
    },
  })
  if (!thread) notFound()

  return (
    <div className="space-y-6">
      <Link href="/admin/messages/live" className="inline-flex items-center gap-1 text-sm text-muted-foreground hover:text-foreground">
        <ArrowLeft className="h-4 w-4" /> Back to chats
      </Link>

      <header className="flex flex-wrap items-start justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-foreground flex items-center gap-2">
            <Headphones className="h-6 w-6" />
            {thread.customerName ?? 'Visitor'}
          </h1>
          <p className="text-sm text-muted-foreground">
            {thread.customerEmail ?? 'No email on file'} • Started {thread.startedAt.toLocaleString()}
          </p>
          {thread.source ? (
            <p className="mt-1 text-xs text-muted-foreground">Source: {thread.source}</p>
          ) : null}
        </div>
        <Badge variant={STATUS_VARIANT[thread.status] ?? 'outline'}>{thread.status}</Badge>
      </header>

      <div className="space-y-3 rounded-lg border border-border bg-card p-4">
        {thread.messages.length === 0 ? (
          <p className="text-sm text-muted-foreground">No messages.</p>
        ) : (
          thread.messages.map((message) => {
            if (message.senderType === 'SYSTEM') {
              return (
                <div key={message.id} className="text-center">
                  <p className="inline-block rounded-full bg-muted px-3 py-1 text-[11px] uppercase tracking-wide text-muted-foreground">
                    {message.content}
                  </p>
                </div>
              )
            }
            const isAdmin = message.senderType === 'ADMIN'
            return (
              <div key={message.id} className={`flex ${isAdmin ? 'justify-end' : 'justify-start'}`}>
                <div className={`max-w-[80%] rounded-2xl px-3 py-2 ${isAdmin ? 'bg-salsa-600 text-white' : 'bg-muted text-foreground'}`}>
                  <p className="text-[10px] uppercase tracking-wide opacity-70">
                    {message.senderType === 'CUSTOMER'
                      ? message.senderLabel ?? thread.customerName ?? 'Visitor'
                      : message.senderType === 'AI'
                        ? 'AI assistant'
                        : message.senderLabel ?? 'Team'}
                    {' • '}
                    {message.createdAt.toLocaleString()}
                  </p>
                  <p className="whitespace-pre-wrap text-sm">{message.content}</p>
                </div>
              </div>
            )
          })
        )}
      </div>
    </div>
  )
}
