import { NextRequest } from 'next/server'
import { z } from 'zod'

import prisma from '@/lib/prisma'
import { requirePermission } from '@/lib/rbac'
import { ok, fail } from '@/lib/api'
import { logAudit } from '@/lib/audit'

/**
 * POST /api/admin/fundraiser-contacts/bulk
 *
 * Applies one action to a set of selected contacts — the on/off switch and status changes
 * that would otherwise take hundreds of individual edits.
 *
 * Ids are always explicit. There is no "apply to everything matching the filter" form,
 * because a filter that resolves differently on the server than it rendered on screen would
 * silently deactivate rows the operator never saw.
 */

const bulkSchema = z.object({
  ids: z.array(z.string().cuid()).min(1).max(5000),
  action: z.enum(['activate', 'deactivate', 'setStatus']),
  status: z.enum(['NEW', 'CONTACTED', 'RESPONDED', 'CONVERTED', 'DO_NOT_CONTACT']).optional(),
})

export async function POST(req: NextRequest) {
  try {
    const user = await requirePermission('users:write')

    const parsed = bulkSchema.safeParse(await req.json())
    if (!parsed.success) {
      return fail('Invalid bulk request', 400, parsed.error.flatten())
    }

    const { ids, action, status } = parsed.data
    if (action === 'setStatus' && !status) {
      return fail('A status is required for this action', 400)
    }

    const data =
      action === 'activate'
        ? { isActive: true }
        : action === 'deactivate'
          ? { isActive: false }
          : { status }

    const { count } = await prisma.fundraiserContact.updateMany({
      where: { id: { in: ids } },
      data,
    })

    await logAudit({
      userId: user.id,
      action: `fundraiser_contact.bulk.${action}`,
      entityType: 'FundraiserContact',
      changes: { count, ids: ids.length, ...data },
    })

    return ok({ updated: count })
  } catch (error) {
    const err = error as { message?: string; status?: number }
    return fail(err.message ?? 'Bulk update failed', err.status ?? 500)
  }
}
