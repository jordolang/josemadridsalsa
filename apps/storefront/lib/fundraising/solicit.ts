/**
 * Sends the fundraiser re-signup solicitation and records what happened to every contact.
 *
 * Four rules shape this:
 *
 *   1. Nothing is sent without an explicit list of contact ids from the admin. There is no
 *      "send to everyone" path and no scheduled trigger — a mistake here mails hundreds of
 *      real people and cannot be recalled.
 *   2. Every real attempt produces a `FundraiserOutreachLog` row, including the skips. A
 *      contact that was suppressed needs to read as "we deliberately did not mail this one",
 *      not as an absence that invites a retry. A `dryRun` writes nothing at all — it is a
 *      preflight, and logging it would leave a record of sends that never happened.
 *   3. Who is eligible is decided in exactly one place, `resolveRecipients`. The admin dialog
 *      resolves the whole selection up front and then sends only the ids that survived, in
 *      chunks. That matters because `FundraiserContact.email` is not unique — one coordinator
 *      can run two groups — and a per-request dedup would let the same address through twice
 *      when the two rows landed in different chunks.
 *   4. Suppression is looked up in batch rather than per address. A 2,000-contact selection
 *      would otherwise cost 4,000 sequential round trips before the first email went out.
 */

import prisma from '@/lib/prisma'
import { sendEmail } from '@/lib/email/sender'
import {
  SOLICITATION_REPLY_TO,
  buildSolicitationEmail,
  type SolicitationRecipient,
} from './solicitation-email'

/** Resend's default account limit is 2 requests/second; stay comfortably under it. */
const DELAY_MS = 600

export type SkipReason = 'INELIGIBLE' | 'NO_EMAIL' | 'DUPLICATE' | 'SUPPRESSED'

export interface ResolvedRecipient {
  contactId: string
  email: string
  organizationName: string
  contactName: string | null
  totalJars: number
  years: number[]
  status: string
}

export interface SkippedContact {
  contactId: string
  email: string
  reason: SkipReason
}

export interface Resolution {
  /** Distinct ids asked for, before any filtering. */
  requested: number
  recipients: ResolvedRecipient[]
  skipped: SkippedContact[]
}

export interface SolicitResult {
  requested: number
  attempted: number
  sent: number
  failed: number
  skippedSuppressed: number
  skippedNoEmail: number
  skippedDuplicate: number
  /**
   * Selected contacts the eligibility query excluded outright — inactive, or marked
   * do-not-contact. Counted rather than left implicit: without it the dialog would report
   * "0 skipped" while silently discarding most of a selection.
   */
  skippedIneligible: number
  errors: { organizationName: string; email: string; error: string }[]
}

export interface SolicitOptions {
  contactIds: string[]
  sentById?: string | null
  /**
   * Resolve and report every recipient without calling the mail provider and without writing
   * outreach rows.
   */
  dryRun?: boolean
}

const sleep = (ms: number) => new Promise((resolve) => setTimeout(resolve, ms))

const normalize = (email: string | null | undefined) => email?.trim().toLowerCase() ?? ''

/**
 * Decides who out of a selection actually gets mailed.
 *
 * Pure resolution — it sends nothing and writes nothing — so the admin dialog can call it
 * across the entire selection in one request, then hand the surviving ids back in chunks.
 * Duplicate addresses are collapsed here, once, against the whole set.
 */
export async function resolveRecipients(contactIds: string[]): Promise<Resolution> {
  const uniqueIds = [...new Set(contactIds)]
  if (uniqueIds.length === 0) return { requested: 0, recipients: [], skipped: [] }

  const contacts = await prisma.fundraiserContact.findMany({
    where: {
      id: { in: uniqueIds },
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
    // Stable order so which row of a duplicate pair is kept does not vary between the
    // preflight and the send.
    orderBy: { id: 'asc' },
  })

  const skipped: SkippedContact[] = []

  const eligibleIds = new Set(contacts.map((c) => c.id))
  for (const id of uniqueIds) {
    if (!eligibleIds.has(id)) skipped.push({ contactId: id, email: '', reason: 'INELIGIBLE' })
  }

  const withEmail: { contact: (typeof contacts)[number]; email: string }[] = []
  const seen = new Set<string>()
  for (const contact of contacts) {
    const email = normalize(contact.email)
    if (!email) {
      skipped.push({ contactId: contact.id, email: '', reason: 'NO_EMAIL' })
      continue
    }
    if (seen.has(email)) {
      skipped.push({ contactId: contact.id, email, reason: 'DUPLICATE' })
      continue
    }
    seen.add(email)
    withEmail.push({ contact, email })
  }

  // One query per suppression source rather than two per address.
  const addresses = withEmail.map((row) => row.email)
  const [suppressions, unsubscribes] = await Promise.all([
    prisma.emailSuppression.findMany({
      where: { email: { in: addresses } },
      select: { email: true },
    }),
    prisma.unsubscribePreference.findMany({
      where: { email: { in: addresses }, unsubscribeAll: true },
      select: { email: true },
    }),
  ])
  const blocked = new Set([
    ...suppressions.map((row) => row.email),
    ...unsubscribes.map((row) => row.email),
  ])

  const recipients: ResolvedRecipient[] = []
  for (const { contact, email } of withEmail) {
    if (blocked.has(email)) {
      skipped.push({ contactId: contact.id, email, reason: 'SUPPRESSED' })
      continue
    }
    recipients.push({
      contactId: contact.id,
      email,
      organizationName: contact.organizationName,
      contactName: contact.contactName,
      totalJars: contact.totalJars,
      years: contact.years,
      status: contact.status,
    })
  }

  return { requested: uniqueIds.length, recipients, skipped }
}

/** Rolls a `Resolution` up into the counts the admin UI reports. */
export function summarize(resolution: Resolution): SolicitResult {
  const count = (reason: SkipReason) =>
    resolution.skipped.filter((s) => s.reason === reason).length

  return {
    requested: resolution.requested,
    attempted: resolution.recipients.length + resolution.skipped.length,
    sent: 0,
    failed: 0,
    skippedSuppressed: count('SUPPRESSED'),
    skippedNoEmail: count('NO_EMAIL'),
    skippedDuplicate: count('DUPLICATE'),
    skippedIneligible: count('INELIGIBLE'),
    errors: [],
  }
}

const SKIP_LOG_STATUS: Record<SkipReason, 'SKIPPED_SUPPRESSED' | 'SKIPPED_NO_EMAIL'> = {
  // The log enum has no ineligible/duplicate members; both are recorded as suppressed with
  // the specific reason in `error`, which is what the admin actually reads.
  INELIGIBLE: 'SKIPPED_SUPPRESSED',
  DUPLICATE: 'SKIPPED_SUPPRESSED',
  SUPPRESSED: 'SKIPPED_SUPPRESSED',
  NO_EMAIL: 'SKIPPED_NO_EMAIL',
}

const SKIP_REASON_TEXT: Record<SkipReason, string> = {
  INELIGIBLE: 'Contact is inactive or marked do-not-contact',
  DUPLICATE: 'Duplicate address already mailed in this selection',
  SUPPRESSED: 'Address is suppressed or unsubscribed',
  NO_EMAIL: 'Contact has no email address',
}

export async function sendSolicitations(options: SolicitOptions): Promise<SolicitResult> {
  const { contactIds, sentById = null, dryRun = false } = options

  const resolution = await resolveRecipients(contactIds)
  const result = summarize(resolution)
  if (resolution.requested === 0) return result

  if (!dryRun) {
    for (const skip of resolution.skipped) {
      await logOutreach(skip.contactId, skip.email, SKIP_LOG_STATUS[skip.reason], sentById, {
        error: SKIP_REASON_TEXT[skip.reason],
      })
    }
  }

  for (const recipient of resolution.recipients) {
    const message = buildSolicitationEmail(recipient as SolicitationRecipient)

    if (dryRun) {
      result.sent += 1
      continue
    }

    const send = await sendEmail({
      to: recipient.email,
      subject: message.subject,
      html: message.html,
      text: message.text,
      replyTo: SOLICITATION_REPLY_TO,
      headers: message.headers,
    })

    if (send.success) {
      result.sent += 1
      await logOutreach(recipient.contactId, recipient.email, 'SENT', sentById, {
        subject: message.subject,
        messageId: send.messageId,
      })
      await prisma.fundraiserContact.update({
        where: { id: recipient.contactId },
        data: {
          lastSolicitedAt: new Date(),
          solicitationCount: { increment: 1 },
          // Only NEW advances. A contact that already replied or converted keeps that
          // status — a follow-up mail is not a downgrade of what we know about them.
          ...(recipient.status === 'NEW' ? { status: 'CONTACTED' as const } : {}),
        },
      })
    } else {
      result.failed += 1
      result.errors.push({
        organizationName: recipient.organizationName,
        email: recipient.email,
        error: send.error ?? 'Unknown send failure',
      })
      await logOutreach(recipient.contactId, recipient.email, 'FAILED', sentById, {
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
