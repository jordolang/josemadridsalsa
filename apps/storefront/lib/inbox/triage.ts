/**
 * One pass over the mailbox.
 *
 * The order of operations matters and is the same for every message: **record first, act
 * second**. The row is written before a reply is sent or a notification raised, so a crash
 * halfway through leaves a visible, unhandled email rather than a customer who was answered
 * by a system that then forgot it had done so. `gmailMessageId` is unique, so a message the
 * sweep has already seen is skipped on the next tick and can never be answered twice.
 */

import type { GmailConnection, InboundEmail } from '@prisma/client'

import { prisma } from '@/lib/prisma'
import { notifyOperators } from '@/lib/notifications/dispatch'

import { classifyEmail } from './classifier'
import { buildEmailContext } from './context'
import {
  addLabel,
  buildReplyMime,
  createDraft,
  ensureLabel,
  getGmailAccessToken,
  getMessage,
  gmailThreadUrl,
  listMessages,
  sendReply,
  type GmailMessage,
} from './gmail'
import { decideReply, gmailLabelFor, humaniseCategory, stepsFor } from './policy'
import { INBOUND_EMAIL_ENTITY } from '@/lib/inbox/resolution'

/** Messages read per tick. Enough to clear a normal morning, small enough to finish. */
const SWEEP_LIMIT = 25

/** Body text kept on the row, so an operator can read the message without leaving the panel. */
const MAX_STORED_BODY = 20_000

export interface SweepResult {
  scanned: number
  triaged: number
  autoAnswered: number
  drafted: number
  needsAction: number
  ignored: number
  errors: string[]
}

/**
 * Mail this automation must not act on.
 *
 * Without this the sweep answers its own replies, argues with mailer-daemon, and thanks
 * Stripe for its receipts.
 */
export function shouldSkip(message: GmailMessage, mailbox: string): boolean {
  const from = message.fromEmail.toLowerCase()
  if (!from) return true

  // Our own mail, including the replies this system just sent.
  if (from === mailbox.toLowerCase()) return true
  if (message.labelIds.includes('SENT') || message.labelIds.includes('DRAFT')) return true

  // Bounces and auto-responders. Replying to these achieves nothing and can loop.
  const noReply = /^(no-?reply|do-?not-?reply|mailer-daemon|postmaster|bounces?|notifications?)@/i
  if (noReply.test(from)) return true

  return false
}

export async function sweepMailbox(connection: GmailConnection): Promise<SweepResult> {
  const result: SweepResult = {
    scanned: 0,
    triaged: 0,
    autoAnswered: 0,
    drafted: 0,
    needsAction: 0,
    ignored: 0,
    errors: [],
  }

  const accessToken = await getGmailAccessToken(connection)
  const refs = await listMessages(accessToken, connection.searchQuery, SWEEP_LIMIT)
  result.scanned = refs.length

  if (refs.length === 0) {
    await markSwept(connection.id, 0)
    return result
  }

  // One round trip for what has already been handled, rather than one per message.
  const seen = await prisma.inboundEmail.findMany({
    where: { gmailMessageId: { in: refs.map((ref) => ref.id) } },
    select: { gmailMessageId: true },
  })
  const seenIds = new Set(seen.map((row) => row.gmailMessageId))

  for (const ref of refs) {
    if (seenIds.has(ref.id)) continue

    try {
      const handled = await triageMessage(connection, accessToken, ref.id)
      if (!handled) continue

      result.triaged += 1
      if (handled.status === 'AUTO_ANSWERED') result.autoAnswered += 1
      else if (handled.status === 'REPLY_DRAFTED') result.drafted += 1
      else if (handled.status === 'IGNORED') result.ignored += 1
      else result.needsAction += 1
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error)
      console.error('[inbox] Failed to triage message', ref.id, error)
      result.errors.push(`${ref.id}: ${message}`)
    }
  }

  await markSwept(connection.id, result.triaged)
  return result
}

async function markSwept(connectionId: string, count: number): Promise<void> {
  await prisma.gmailConnection
    .update({
      where: { id: connectionId },
      data: { lastSweepAt: new Date(), lastSweepCount: count },
    })
    .catch(() => undefined)
}

async function triageMessage(
  connection: GmailConnection,
  accessToken: string,
  messageId: string,
): Promise<InboundEmail | null> {
  const message = await getMessage(accessToken, messageId)
  if (!message) return null
  if (shouldSkip(message, connection.mailbox)) return null

  const context = await buildEmailContext(message.fromEmail, `${message.subject}\n${message.body}`)

  const classification = await classifyEmail({
    fromEmail: message.fromEmail,
    fromName: message.fromName,
    subject: message.subject,
    body: message.body,
    context,
    sessionId: message.id,
    deviceId: `inbox:${connection.id}`,
  })

  const decision = decideReply({
    classification,
    autoReplyEnabled: connection.autoReplyEnabled,
    autoReplyMinConfidence: connection.autoReplyMinConfidence,
  })

  // Written before anything leaves the building. If the send below fails, this row still
  // exists and still says a human is owed something.
  const email = await prisma.inboundEmail.create({
    data: {
      connectionId: connection.id,
      gmailMessageId: message.id,
      gmailThreadId: message.threadId,
      fromEmail: message.fromEmail,
      fromName: message.fromName,
      subject: message.subject,
      snippet: message.snippet.slice(0, 500),
      body: message.body.slice(0, MAX_STORED_BODY),
      receivedAt: message.receivedAt,
      category: classification.category,
      severity: classification.severity,
      status: decision.status,
      confidence: classification.confidence,
      summary: classification.summary,
      actionSummary: classification.actionSummary ?? decision.reason,
      draftedReply: decision.send ? null : classification.replyBody,
      customerId: context.customer?.id ?? null,
      orderId: context.orders[0]?.id ?? null,
      fundraiserId: context.fundraiser?.id ?? null,
      steps:
        decision.status === 'AUTO_ANSWERED' || decision.status === 'IGNORED'
          ? undefined
          : {
              create: stepsFor(classification, decision).map((step, index) => ({
                position: index,
                instruction: step.instruction,
                isOptional: step.isOptional,
              })),
            },
    },
  })

  if (decision.status === 'IGNORED') {
    return email
  }

  const mime =
    classification.replyBody &&
    buildReplyMime({
      fromMailbox: connection.mailbox,
      toEmail: message.fromEmail,
      subject: message.subject,
      body: classification.replyBody,
      inReplyTo: message.rfcMessageId,
      references: message.references,
    })

  let sent = false
  if (decision.send && mime) {
    try {
      await sendReply(accessToken, message.threadId, mime)
      sent = true
      await prisma.inboundEmail.update({
        where: { id: email.id },
        data: {
          autoReplySent: true,
          autoReplyBody: classification.replyBody,
          autoReplyAt: new Date(),
        },
      })
    } catch (error) {
      // A failed send is not a quiet failure: the email drops back to needing a person,
      // and the alert below says so.
      console.error('[inbox] Auto-reply failed to send', email.id, error)
      await prisma.inboundEmail.update({
        where: { id: email.id },
        data: {
          status: 'NEEDS_ACTION',
          draftedReply: classification.replyBody,
          actionSummary:
            'The automatic reply could not be sent. Read the drafted reply, correct it if needed, and send it yourself.',
          steps: {
            create: [
              {
                position: 0,
                instruction: 'Send the reply to the customer manually — the automatic send failed.',
                isOptional: false,
              },
            ],
          },
        },
      })
    }
  } else if (decision.draft && mime) {
    await createDraft(accessToken, message.threadId, mime).catch((error) => {
      console.warn('[inbox] Could not leave a draft', email.id, error)
    })
  }

  const final = await prisma.inboundEmail.findUniqueOrThrow({
    where: { id: email.id },
    include: { steps: { orderBy: { position: 'asc' } } },
  })

  await applyLabel(accessToken, message.id, final.status, email.id)
  await raiseAlert(final, decision.reason, sent)

  return final
}

async function applyLabel(
  accessToken: string,
  messageId: string,
  status: InboundEmail['status'],
  emailId: string,
): Promise<void> {
  const labelName = gmailLabelFor(status)
  if (!labelName) return

  try {
    const labelId = await ensureLabel(accessToken, labelName)
    if (!labelId) return
    await addLabel(accessToken, messageId, labelId)
    await prisma.inboundEmail.update({ where: { id: emailId }, data: { gmailLabel: labelName } })
  } catch (error) {
    // Labelling is how the mailbox mirrors the panel; failing to do it is untidy, not
    // dangerous, and must never cost us the alert that follows.
    console.warn('[inbox] Could not label message', messageId, error)
  }
}

/**
 * The alert itself.
 *
 * An auto-answered email still raises a notification — the requirement is that nothing is
 * *unseen*, not merely that nothing is unanswered — but it carries no steps, so it clears
 * with one click. Everything else carries the instructions and cannot be cleared until they
 * are done.
 */
async function raiseAlert(
  email: InboundEmail & { steps: Array<{ instruction: string; isOptional: boolean }> },
  reason: string,
  sent: boolean,
): Promise<void> {
  const who = email.fromName ? `${email.fromName} <${email.fromEmail}>` : email.fromEmail

  const lines = [
    `From ${who}`,
    `Subject: ${email.subject}`,
    '',
    email.summary,
    '',
    sent ? `Answered automatically. ${reason}` : reason,
  ]

  if (email.steps.length > 0) {
    lines.push('', 'Before this alert can be cleared:')
    email.steps.forEach((step, index) => {
      lines.push(`${index + 1}. ${step.instruction}${step.isOptional ? ' (optional)' : ''}`)
    })
  }

  lines.push('', `Read the thread in Gmail: ${gmailThreadUrl(email.gmailThreadId)}`)

  await notifyOperators({
    type: 'CUSTOMER_EMAIL',
    severity: email.severity,
    title: sent
      ? `Answered: ${humaniseCategory(email.category)} from ${email.fromName ?? email.fromEmail}`
      : `${humaniseCategory(email.category)} from ${email.fromName ?? email.fromEmail}`,
    message: lines.join('\n'),
    entityType: INBOUND_EMAIL_ENTITY,
    entityId: email.id,
    link: `/admin/inbox/${email.id}`,
    dedupeKey: `customer-email:${email.id}`,
  })
}
