import { NextRequest } from 'next/server'
import { z } from 'zod'

import { requirePermission } from '@/lib/rbac'
import { ok, fail, failFromError } from '@/lib/api'
import { logAudit } from '@/lib/audit'
import { sendSolicitations } from '@/lib/fundraising/solicit'

/**
 * POST /api/admin/fundraiser-contacts/solicit
 *
 * Sends the re-signup solicitation to an explicit list of contacts.
 *
 * `content:write` is required rather than the `users:write` that governs editing the list:
 * changing a phone number and mailing several hundred former customers are not the same
 * privilege, and every other outbound-email route in the app gates on `content:write`.
 *
 * One request handles at most `MAX_CONTACTS_PER_REQUEST` contacts. Sends are serial and
 * rate-limited, so a whole-database selection would otherwise run for twenty minutes and be
 * killed mid-batch by the platform — with no way to tell which recipients had already been
 * mailed. The client sends chunks sequentially instead.
 *
 * `confirm: true` is mandatory on a real send. It exists so that a mis-wired client, a
 * replayed request, or a curious `curl` cannot mail anyone by accident — the caller has to
 * say, in the body, that this is deliberate. `dryRun` resolves and reports the same recipient
 * set without contacting the mail provider.
 */

/**
 * Sends run serially with a per-message delay to respect the mail provider's rate limit, so a
 * request's wall time scales with the batch. The cap keeps one request inside `maxDuration`;
 * the client chunks larger selections rather than asking for a longer-running function.
 */
const MAX_CONTACTS_PER_REQUEST = 200

export const maxDuration = 300

const solicitSchema = z.object({
  contactIds: z.array(z.string().cuid()).min(1).max(MAX_CONTACTS_PER_REQUEST),
  dryRun: z.boolean().optional().default(false),
  confirm: z.boolean().optional().default(false),
})

export async function POST(req: NextRequest) {
  try {
    const user = await requirePermission('content:write')

    const parsed = solicitSchema.safeParse(await req.json())
    if (!parsed.success) {
      return fail('Invalid solicitation request', 400, parsed.error.flatten())
    }

    const { contactIds, dryRun, confirm } = parsed.data

    if (!dryRun && !confirm) {
      return fail('Sending requires explicit confirmation', 400)
    }

    const result = await sendSolicitations({
      contactIds,
      sentById: user.id,
      dryRun,
    })

    if (!dryRun) {
      await logAudit({
        userId: user.id,
        action: 'fundraiser_contact.solicit',
        entityType: 'FundraiserContact',
        changes: {
          requested: contactIds.length,
          sent: result.sent,
          failed: result.failed,
          skippedSuppressed: result.skippedSuppressed,
          skippedNoEmail: result.skippedNoEmail,
          skippedDuplicate: result.skippedDuplicate,
        },
      })
    }

    return ok({ dryRun, result })
  } catch (error) {
    return failFromError(error, 'Solicitation failed')
  }
}
