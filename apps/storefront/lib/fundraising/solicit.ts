/**
 * Sends the fundraiser re-signup solicitation and records what happened to every contact.
 *
 * Three rules shape this:
 *
 *   1. Nothing is sent without an explicit list of contact ids from the admin. There is no
 *      "send to everyone" path and no scheduled trigger — a mistake here mails hundreds of
 *      real people and cannot be recalled.
 *   2. Every real attempt produces a `FundraiserOutreachLog` row, including the skips. A
 *      contact that was suppressed needs to read as "we deliberately did not mail this one",
 *      not as an absence that invites a retry. A `dryRun` writes nothing at all — it is a
 *      preflight the admin dialog runs to count recipients, and logging it would leave a
 *      record of sends that never happened.
 *   3. Addresses are deduplicated before sending. `FundraiserContact.email` is not unique —
 *      one coordinator can run two groups — and mailing the same person twice in one batch is
 *      the fastest way to earn a spam complaint.
 */

import prisma from '@/lib/prisma'
import { sendEmail } from '@/lib/email/sender'
import { checkSuppression } from '@/lib/email/suppression'
import {
  SOLICITATION_REPLY_TO,
  buildSolicitationEmail,
  type SolicitationRecipient,
} from './solicitation-email'

/** Resend's default account limit is 2 requests/second; stay comfortably under it. */
const DELAY_MS = 600

export interface SolicitResult {
  /** Ids handed in by the caller, before any filtering. */
  requested: number
  attempted: number
  sent: number
  failed: number
  skippedSuppressed: number
  skippedNoEmail: number
  skippedDuplicate: number
  /**
   * Selected contacts the query excluded outright — inactive, or marked do-not-contact.
   *
   * Counted rather than left implicit: the query drops these before the loop sees them, so
   * without this the dialog would report "0 skipped" while silently discarding most of a
   * selection, and an operator would read that as "everything I picked is being mailed".
   */
  skippedIneligible: number
  errors: { organizationName: string; email: string; error: string }[]
}

export interface SolicitOptions {
  contactIds: string[]
  sentById?: string | null
  /**
   * Resolve and log every recipient without calling the mail provider. Used by the admin
   * dialog's preflight so the operator sees exactly who would be mailed, and by tests.
   */
  dryRun?: boolean
}

const sleep = (ms: number) => new Promise((resolve) => setTimeout(resolve, ms))

export async function sendSolicitations(options: SolicitOptions): Promise<SolicitResult> {
  const { contactIds, sentById = null, dryRun = false } = options

  const result: SolicitResult = {
    requested: contactIds.length,
    attempted: 0,
    sent: 0,
    failed: 0,
    skippedSuppressed: 0,
    skippedNoEmail: 0,
    skippedDuplicate: 0,
    skippedIneligible: 0,
    errors: [],
  }

  if (contactIds.length === 0) return result

  const contacts = await prisma.fundraiserContact.findMany({
    where: {
      id: { in: contactIds },
      isActive: true,
      status: { not: 'DO_NOT_CONTACT' },
    },
    select: {
      id: true,
      organizationName: true,
      contactName: true,
      email: true,
      totalJars: true,
      years: true,
      status: true,
    },
  })

  // Whatever the id list asked for but the eligibility query did not return.
  result.skippedIneligible = new Set(contactIds).size - contacts.length

  const seen = new Set<string>()

  for (const contact of contacts) {
    result.attempted += 1

    const email = contact.email?.trim().toLowerCase()
    if (!email) {
      result.skippedNoEmail += 1
      if (!dryRun) {
        await logOutreach(contact.id, '', 'SKIPPED_NO_EMAIL', sentById, {
          error: 'Contact has no email address',
        })
      }
      continue
    }

    if (seen.has(email)) {
      // Logged as suppressed-for-duplicate rather than silently dropped, so the second group
      // run by the same coordinator still shows why it was not mailed.
      result.skippedDuplicate += 1
      if (!dryRun) {
        await logOutreach(contact.id, email, 'SKIPPED_SUPPRESSED', sentById, {
          error: 'Duplicate address already mailed in this batch',
        })
      }
      continue
    }
    seen.add(email)

    if (await checkSuppression(email)) {
      result.skippedSuppressed += 1
      if (!dryRun) {
        await logOutreach(contact.id, email, 'SKIPPED_SUPPRESSED', sentById, {
          error: 'Address is suppressed or unsubscribed',
        })
      }
      continue
    }

    const recipient: SolicitationRecipient = {
      organizationName: contact.organizationName,
      contactName: contact.contactName,
      email,
      totalJars: contact.totalJars,
      years: contact.years,
    }
    const message = buildSolicitationEmail(recipient)

    if (dryRun) {
      result.sent += 1
      continue
    }

    const send = await sendEmail({
      to: email,
      subject: message.subject,
      html: message.html,
      text: message.text,
      replyTo: SOLICITATION_REPLY_TO,
      headers: message.headers,
    })

    if (send.success) {
      result.sent += 1
      await logOutreach(contact.id, email, 'SENT', sentById, {
        subject: message.subject,
        messageId: send.messageId,
      })
      await prisma.fundraiserContact.update({
        where: { id: contact.id },
        data: {
          lastSolicitedAt: new Date(),
          solicitationCount: { increment: 1 },
          // Only NEW advances. A contact that already replied or converted keeps that
          // status — a follow-up mail is not a downgrade of what we know about them.
          ...(contact.status === 'NEW' ? { status: 'CONTACTED' as const } : {}),
        },
      })
    } else {
      result.failed += 1
      result.errors.push({
        organizationName: contact.organizationName,
        email,
        error: send.error ?? 'Unknown send failure',
      })
      await logOutreach(contact.id, email, 'FAILED', sentById, {
        subject: message.subject,
        error: send.error,
      })
    }

    await sleep(DELAY_MS)
  }

  return result
}

async function logOutreach(
  contactId: string,
  email: string,
  status: 'SENT' | 'FAILED' | 'SKIPPED_SUPPRESSED' | 'SKIPPED_NO_EMAIL',
  sentById: string | null,
  extra: { subject?: string; messageId?: string; error?: string | null } = {},
) {
  await prisma.fundraiserOutreachLog
    .create({
      data: {
        contactId,
        email,
        subject: extra.subject ?? 'Run another salsa fundraiser with Jose Madrid?',
        status,
        messageId: extra.messageId ?? null,
        error: extra.error ?? null,
        sentById,
      },
    })
    // A logging failure must not abort a send loop that is part-way through a real batch.
    .catch((error) => console.warn('Outreach log failed:', error))
}
