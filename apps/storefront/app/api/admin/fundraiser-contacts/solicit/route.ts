import { NextRequest } from 'next/server'
import { z } from 'zod'

import { requirePermission } from '@/lib/rbac'
import { ok, fail } from '@/lib/api'
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
 * `confirm: true` is mandatory on a real send. It exists so that a mis-wired client, a
 * replayed request, or a curious `curl` cannot mail anyone by accident — the caller has to
 * say, in the body, that this is deliberate. `dryRun` resolves and reports the same recipient
 * set without contacting the mail provider.
 */

const solicitSchema = z.object({
  contactIds: z.array(z.string().cuid()).min(1).max(2000),
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
    const err = error as { message?: string; status?: number }
    return fail(err.message ?? 'Solicitation failed', err.status ?? 500)
  }
}
