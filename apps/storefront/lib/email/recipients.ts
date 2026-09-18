/**
 * Materialising a campaign's recipients.
 *
 * Lifted out of `app/admin/email-campaigns/actions.ts` so the desktop admin
 * shell writes the same recipient snapshot the campaign page does. A campaign
 * row on its own is not a campaign: the cron picks it up on its scheduled time,
 * moves it to SENDING, finds no PENDING recipients and leaves it stuck there
 * having sent nothing. The rows have to exist before a campaign may be
 * scheduled, so the code that writes them cannot live behind `'use server'`.
 */

import { prisma } from '@/lib/prisma'
import {
  resolveVariablesForRecipient,
  type DiscountCodeMap,
  type SubscriberLike,
  type VariableMappings,
} from '@/lib/email/variable-mapping'

/**
 * Rows moved per round trip when a campaign is built from a mailing list.
 *
 * A list built from the customer database runs to tens of thousands of
 * contacts. Loading them all into this action's memory — and then into a single
 * nested `create` — is the shape that overran the serverless function on the
 * list page, so both the read and the write are paged.
 */
export const RECIPIENT_BATCH_SIZE = 1000

export type NewRecipient = {
  email: string
  name?: string
  variables?: Record<string, string>
}

/** Insert an already-materialised recipient list in bounded batches. */
export async function insertRecipients(
  campaignId: string,
  recipients: NewRecipient[],
): Promise<number> {
  for (let i = 0; i < recipients.length; i += RECIPIENT_BATCH_SIZE) {
    await prisma.emailRecipient.createMany({
      data: recipients.slice(i, i + RECIPIENT_BATCH_SIZE).map((r) => ({
        campaignId,
        email: r.email,
        name: r.name,
        variables: r.variables,
        status: 'PENDING' as const,
      })),
    })
  }
  return recipients.length
}

/**
 * Page through a mailing list's subscribers, writing each batch out as
 * recipients before reading the next. Returns the number actually inserted,
 * which can differ from a count taken beforehand if someone unsubscribes
 * mid-run.
 */
export async function insertRecipientsFromList(
  campaignId: string,
  listId: string,
  mappings: VariableMappings,
  discountCodes: DiscountCodeMap,
): Promise<number> {
  const hasMappings = Object.keys(mappings).length > 0
  // `customFields` is the importer's dumping ground for every unmapped column
  // of the source CSV, so it is only worth fetching when a mapping reads it.
  const needsCustomFields = Object.values(mappings).some(
    (m) => m.source === 'customField',
  )

  let inserted = 0
  let cursorEmail: string | undefined

  for (;;) {
    const batch = await prisma.mailingListSubscriber.findMany({
      where: {
        listId,
        status: 'SUBSCRIBED',
        // Keyset, not a Prisma `cursor`: a cursor has to locate the boundary
        // row, so an admin removing that subscriber between pages would end the
        // read early and silently drop everyone after it. `(listId, email)` is
        // unique, so email totally orders a single list and this predicate
        // rides the index the filter already uses. `createdAt` cannot page: a
        // CSV import stamps thousands of rows with the same value.
        ...(cursorEmail === undefined ? {} : { email: { gt: cursorEmail } }),
      },
      orderBy: { email: 'asc' },
      take: RECIPIENT_BATCH_SIZE,
      select: {
        email: true,
        firstName: true,
        lastName: true,
        phone: true,
        customFields: needsCustomFields,
      },
    })

    if (batch.length === 0) break

    await prisma.emailRecipient.createMany({
      data: batch.map((s) => {
        const subscriber: SubscriberLike = {
          email: s.email,
          firstName: s.firstName,
          lastName: s.lastName,
          phone: s.phone,
          customFields: (s.customFields as Record<string, unknown> | null) ?? null,
        }
        return {
          campaignId,
          email: s.email,
          name: [s.firstName, s.lastName].filter(Boolean).join(' ') || undefined,
          variables: hasMappings
            ? resolveVariablesForRecipient(mappings, subscriber, { discountCodes })
            : {},
          status: 'PENDING' as const,
        }
      }),
    })
    inserted += batch.length

    if (batch.length < RECIPIENT_BATCH_SIZE) break
    cursorEmail = batch[batch.length - 1].email
  }

  return inserted
}
