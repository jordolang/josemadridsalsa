import { NextRequest } from 'next/server'
import { z } from 'zod'

import { ok, fail, failFromError } from '@/lib/api'
import { logAuditWithRequest } from '@/lib/audit'
import { applyThreadAction, getThread, modifyThread, THREAD_ACTIONS } from '@/lib/inbox/mailbox'
import { openMailbox } from '@/lib/inbox/mailbox-session'

export const dynamic = 'force-dynamic'

const ThreadId = z.string().regex(/^[0-9a-f]{1,32}$/i)

/** GET /api/admin/mailbox/threads/[id] — the whole conversation. */
export async function GET(_req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const { accessToken } = await openMailbox()
    const id = ThreadId.safeParse((await params).id)
    if (!id.success) return fail('Invalid conversation id', 400)
    const thread = await getThread(accessToken, id.data)
    return thread ? ok(thread) : fail('Conversation not found', 404)
  } catch (error) {
    return failFromError(error, 'Could not open the conversation')
  }
}

const LabelId = z.string().min(1).max(200)
const ActionSchema = z.union([
  z.object({
    action: z.enum([...(Object.keys(THREAD_ACTIONS) as [keyof typeof THREAD_ACTIONS]), 'trash', 'untrash']),
  }),
  z.object({
    action: z.literal('label'),
    add: z.array(LabelId).max(20).default([]),
    remove: z.array(LabelId).max(20).default([]),
  }),
])

/** POST /api/admin/mailbox/threads/[id] — archive, trash, star, read, move to a folder… */
export async function POST(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const { user, connection, accessToken } = await openMailbox()
    const id = ThreadId.safeParse((await params).id)
    if (!id.success) return fail('Invalid conversation id', 400)
    const parsed = ActionSchema.safeParse(await req.json().catch(() => ({})))
    if (!parsed.success) return fail('Invalid action', 400, parsed.error.flatten())

    const body = parsed.data
    if (body.action === 'label') {
      await modifyThread(accessToken, id.data, { add: body.add, remove: body.remove })
    } else {
      await applyThreadAction(accessToken, id.data, body.action)
    }

    if (body.action === 'trash' || body.action === 'spam') {
      await logAuditWithRequest(
        {
          userId: user.id,
          action: body.action === 'trash' ? 'MAILBOX_THREAD_TRASHED' : 'MAILBOX_THREAD_SPAM',
          entityType: 'GmailConnection',
          entityId: connection.id,
          changes: { threadId: id.data },
        },
        req,
      )
    }
    return ok({ ok: true })
  } catch (error) {
    return failFromError(error, 'Could not update the conversation')
  }
}
