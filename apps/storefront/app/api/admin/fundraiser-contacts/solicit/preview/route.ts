import { NextRequest } from 'next/server'
import { z } from 'zod'

import { requirePermission } from '@/lib/rbac'
import { ok, fail, failFromError } from '@/lib/api'
import { resolveRecipients, summarize } from '@/lib/fundraising/solicit'

/**
 * POST /api/admin/fundraiser-contacts/solicit/preview
 *
 * Resolves who a selection would actually mail, without sending anything.
 *
 * Separate from `POST /solicit` with `dryRun` because the two have opposite shapes. Sending is
 * serial and rate-limited, so it is capped at a couple of hundred contacts per request;
 * resolution is three set-based queries and can answer for the whole selection at once. That
 * difference is the point: the client resolves everything here, then sends only the returned
 * ids in chunks. Deduplicating per send-request instead would mail a coordinator twice when
 * their two organizations landed in different chunks.
 *
 * Gated on `content:write` rather than a read permission: it enumerates exactly who is about
 * to receive marketing email, which is the send decision in all but name.
 */

export const maxDuration = 60

const previewSchema = z.object({
  // Matches the ids endpoint's cap, so any selection the list can produce can be previewed.
  contactIds: z.array(z.string().cuid()).min(1).max(10_000),
})

export async function POST(req: NextRequest) {
  try {
    await requirePermission('content:write')

    const parsed = previewSchema.safeParse(await req.json())
    if (!parsed.success) {
      return fail('Invalid preview request', 400, parsed.error.flatten())
    }

    const resolution = await resolveRecipients(parsed.data.contactIds)
    const counts = summarize(resolution)

    return ok({
      /**
       * Deduplicated and eligible, in send order. The client mails exactly these — resolving
       * again per chunk is what would reintroduce duplicates.
       */
      recipientIds: resolution.recipients.map((r) => r.contactId),
      counts: { ...counts, sent: resolution.recipients.length },
    })
  } catch (error) {
    return failFromError(error, 'Could not resolve the recipient list')
  }
}
