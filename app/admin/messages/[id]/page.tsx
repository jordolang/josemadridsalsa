import { notFound, redirect } from 'next/navigation'
import { revalidatePath } from 'next/cache'
import { ConversationStatus, MessageSenderType } from '@prisma/client'
import { prisma } from '@/lib/prisma'
import { getCurrentUser, hasPermission } from '@/lib/rbac'
import { Card } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Textarea } from '@/components/ui/textarea'
import { logAudit } from '@/lib/audit'
import { sendAdminReplyEmail } from '@/lib/email'

type PageProps = {
  params: Promise<{ id: string }>
}

async function replyToConversation(conversationId: string, formData: FormData) {
  'use server'

  const user = await getCurrentUser()
  if (!user) {
    throw new Error('Unauthorized')
  }

  const canReply = await hasPermission(user, 'messaging:reply')
  if (!canReply) {
    throw new Error('Forbidden')
  }

  const message = formData.get('message')

  if (typeof message !== 'string' || message.trim().length === 0) {
    throw new Error('Message content is required')
  }

  const trimmedMessage = message.trim()

  const conversation = await prisma.conversation.findUnique({
    where: { id: conversationId },
    select: {
      id: true,
      userId: true,
      email: true,
      subject: true,
    },
  })

  if (!conversation) {
    throw new Error('Conversation not found')
  }

  await prisma.message.create({
    data: {
      conversationId,
      senderType: MessageSenderType.ADMIN,
      body: trimmedMessage,
      readAt: new Date(),
    },
  })

  await prisma.conversation.update({
    where: { id: conversationId },
    data: {
      status: ConversationStatus.OPEN,
      updatedAt: new Date(),
    },
  })

  await logAudit({
    userId: user.id,
    action: 'conversation.reply',
    entityType: 'Conversation',
    entityId: conversationId,
  })

  const recipient = conversation.email
  if (recipient) {
    await sendAdminReplyEmail(
      recipient,
      conversation.subject || 'Reply from Jose Madrid Salsa',
      trimmedMessage
    )
  }

  revalidatePath(`/admin/messages/${conversationId}`)
}

async function updateConversationStatus(conversationId: string, formData: FormData) {
  'use server'

  const user = await getCurrentUser()
  if (!user) {
    throw new Error('Unauthorized')
  }

  const canReply = await hasPermission(user, 'messaging:reply')
  if (!canReply) {
    throw new Error('Forbidden')
  }

  const status = formData.get('status')
  if (status !== 'OPEN' && status !== 'CLOSED') {
    throw new Error('Invalid status')
  }

  await prisma.conversation.update({
    where: { id: conversationId },
    data: {
      status: status as ConversationStatus,
      updatedAt: new Date(),
    },
  })

  await logAudit({
    userId: user.id,
    action: 'conversation.status_change',
    entityType: 'Conversation',
    entityId: conversationId,
    changes: { status },
  })

  revalidatePath(`/admin/messages/${conversationId}`)
  revalidatePath('/admin/messages')
}

export default async function ConversationPage(props: PageProps) {
  const params = await props.params
  const conversationId = params.id

  const user = await getCurrentUser()

  if (!user || !(await hasPermission(user, 'messaging:read'))) {
    redirect('/admin')
  }

  await prisma.message.updateMany({
    where: {
      conversationId,
      senderType: MessageSenderType.USER,
      readAt: null,
    },
    data: {
      readAt: new Date(),
    },
  })

  const conversation = await prisma.conversation.findUnique({
    where: { id: conversationId },
    include: {
      user: {
        select: {
          id: true,
          email: true,
          name: true,
        },
      },
      messages: {
        orderBy: { createdAt: 'asc' },
      },
    },
  })

  if (!conversation) {
    notFound()
  }

  const canReply = await hasPermission(user, 'messaging:reply')

  const replyAction = replyToConversation.bind(null, conversationId)
  const statusAction = updateConversationStatus.bind(null, conversationId)

  return (
    <div className="space-y-6">
      <div className="flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between">
        <div>
          <div className="flex items-center gap-3">
            <h1 className="text-3xl font-bold">
              {conversation.subject || 'Conversation'}
            </h1>
            <Badge
              className={
                conversation.status === 'OPEN'
                  ? 'bg-blue-100 text-blue-700'
                  : 'bg-slate-100 text-slate-600'
              }
            >
              {conversation.status}
            </Badge>
          </div>
          <p className="mt-2 text-sm text-slate-600">
            Conversation opened {conversation.createdAt.toLocaleString()}
          </p>
        </div>

        <form action={statusAction} className="flex items-center gap-3">
          <input type="hidden" name="status" value={conversation.status === 'OPEN' ? 'CLOSED' : 'OPEN'} />
          <Button
            type="submit"
            variant={conversation.status === 'OPEN' ? 'outline' : 'default'}
            disabled={!canReply}
          >
            {conversation.status === 'OPEN' ? 'Close conversation' : 'Reopen conversation'}
          </Button>
        </form>
      </div>

      <div className="grid gap-4 lg:grid-cols-[2fr_1fr]">
        <Card className="p-6">
          <h2 className="text-lg font-semibold text-slate-900">Message history</h2>
          <div className="mt-4 space-y-4">
            {conversation.messages.length === 0 ? (
              <p className="text-sm text-slate-500">No messages in this conversation yet.</p>
            ) : (
              conversation.messages.map((message) => {
                const isAdmin = message.senderType === 'ADMIN'
                return (
                  <div
                    key={message.id}
                    className={`rounded-lg border p-4 ${
                      isAdmin ? 'border-blue-100 bg-blue-50' : 'border-slate-200 bg-white'
                    }`}
                  >
                    <div className="flex items-center justify-between">
                      <p className="text-sm font-medium text-slate-700">
                        {isAdmin ? 'Jose Madrid Salsa' : conversation.user?.name || conversation.email || 'Customer'}
                      </p>
                      <p className="text-xs text-slate-500">
                        {message.createdAt.toLocaleString()}
                      </p>
                    </div>
                    <p className="mt-3 whitespace-pre-wrap text-sm text-slate-700">
                      {message.body}
                    </p>
                  </div>
                )
              })
            )}
          </div>

          {canReply ? (
            <form action={replyAction} className="mt-6 space-y-4">
              <div>
                <label htmlFor="reply" className="text-sm font-medium text-slate-700">
                  Reply to customer
                </label>
                <Textarea
                  id="reply"
                  name="message"
                  rows={6}
                  placeholder="Write your response..."
                  className="mt-2"
                  required
                />
              </div>
              <div className="flex items-center justify-between text-xs text-slate-500">
                <p>The customer will receive an email notification with your reply.</p>
                <Button type="submit">Send reply</Button>
              </div>
            </form>
          ) : (
            <div className="mt-6 rounded-lg bg-amber-50 p-4 text-sm text-amber-700">
              You have read-only access to this conversation. Contact an administrator to respond on behalf of the team.
            </div>
          )}
        </Card>

        <Card className="space-y-4 p-6">
          <div>
            <h2 className="text-lg font-semibold text-slate-900">Customer details</h2>
            <div className="mt-3 space-y-2 text-sm text-slate-600">
              <p>
                <span className="font-medium text-slate-700">Name:</span>{' '}
                {conversation.user?.name || '—'}
              </p>
              <p>
                <span className="font-medium text-slate-700">Email:</span>{' '}
                {conversation.user?.email || conversation.email || '—'}
              </p>
              <p>
                <span className="font-medium text-slate-700">User ID:</span>{' '}
                {conversation.user?.id || 'Guest'}
              </p>
              <p>
                <span className="font-medium text-slate-700">Last updated:</span>{' '}
                {conversation.updatedAt.toLocaleString()}
              </p>
            </div>
          </div>
          <div className="rounded-lg bg-slate-50 p-4 text-sm text-slate-600">
            <p>
              All replies are logged and tracked. Closing the conversation will hide it from the active queue but keeps the full history available.
            </p>
          </div>
        </Card>
      </div>
    </div>
  )
}
