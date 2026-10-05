import { NextRequest } from 'next/server'
import { z } from 'zod'

import { ok, fail, failFromError } from '@/lib/api'
import { logAuditWithRequest } from '@/lib/audit'
import { saveDraft, sendMail } from '@/lib/inbox/mailbox'
import { openMailbox } from '@/lib/inbox/mailbox-session'

export const dynamic = 'force-dynamic'

const Addresses = z.array(z.string().trim().email()).max(50).default([])
/** Vercel caps a request body at 4.5 MB; base64 inflates by a third. */
const MAX_ATTACHMENT_BASE64 = 4_000_000

const SendSchema = z
  .object({
    mode: z.enum(['send', 'draft']),
    to: Addresses,
    cc: Addresses,
    bcc: Addresses,
    subject: z.string().max(998).default(''),
    body: z.string().max(200_000).default(''),
    threadId: z.string().regex(/^[0-9a-f]{1,32}$/i).optional(),
    inReplyTo: z.string().max(998).nullable().optional(),
    references: z.string().max(8000).nullable().optional(),
    attachments: z
      .array(
        z.object({
          filename: z.string().min(1).max(255),
          mimeType: z.string().min(1).max(255),
          data: z.string().regex(/^[A-Za-z0-9+/=\s]*$/),
        }),
      )
      .max(10)
      .default([]),
  })
  .refine((mail) => mail.mode === 'draft' || mail.to.length + mail.cc.length + mail.bcc.length > 0, {
    message: 'Add at least one recipient',
    path: ['to'],
  })
  .refine((mail) => mail.attachments.reduce((sum, a) => sum + a.data.length, 0) <= MAX_ATTACHMENT_BASE64, {
    message: 'Attachments are too large to send from here (about 3 MB total)',
    path: ['attachments'],
  })

/** POST /api/admin/mailbox/send — send (or save as a draft) a new mail, reply or forward. */
export async function POST(req: NextRequest) {
  try {
    const { user, connection, accessToken } = await openMailbox()
    const parsed = SendSchema.safeParse(await req.json().catch(() => ({})))
    if (!parsed.success) return fail(parsed.error.issues[0]?.message ?? 'Invalid message', 400, parsed.error.flatten())

    const { mode, ...mail } = parsed.data
    if (mode === 'draft') return ok({ draftId: await saveDraft(accessToken, connection.mailbox, mail) }, 201)

    const messageId = await sendMail(accessToken, connection.mailbox, mail)
    await logAuditWithRequest(
      {
        userId: user.id,
        action: 'MAILBOX_MESSAGE_SENT',
        entityType: 'GmailConnection',
        entityId: connection.id,
        changes: { messageId, to: mail.to, cc: mail.cc, subject: mail.subject },
      },
      req,
    )
    return ok({ messageId }, 201)
  } catch (error) {
    return failFromError(error, 'Could not send the message')
  }
}
