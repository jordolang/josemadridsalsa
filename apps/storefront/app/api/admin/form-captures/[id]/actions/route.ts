import { NextRequest } from 'next/server'
import { z } from 'zod'
import { requirePermission } from '@/lib/rbac'
import { ok, fail } from '@/lib/api'
import { logAudit } from '@/lib/audit'
import { approveAndPost, rejectCapture, runExtraction } from '@/lib/form-capture/service'

/**
 * POST /api/admin/form-captures/[id]/actions
 *
 * The three things a reviewer can do with a form: approve it (which posts it), reject it, or ask
 * for it to be read again. One route because they are mutually exclusive decisions on one object.
 */

const actionSchema = z.object({
  action: z.enum(['approve', 'reject', 'reextract']),
  reviewNotes: z.string().trim().max(2000).nullable().optional(),
})

export async function POST(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const user = await requirePermission('financials:write')
    const { id } = await params

    const body = await req.json().catch(() => null)
    const parsed = actionSchema.safeParse(body)
    if (!parsed.success) return fail('Invalid action', 400, parsed.error.flatten())

    const { action, reviewNotes } = parsed.data

    if (action === 'approve') {
      const { alreadyPosted, result } = await approveAndPost({
        captureId: id,
        reviewerId: user.id,
        reviewNotes,
      })

      await logAudit({
        userId: user.id,
        action: 'form_capture.approve',
        entityType: 'FormCapture',
        entityId: id,
        changes: { ledgerEntryIds: result.ledgerEntryIds, alreadyPosted },
      })

      return ok({
        posted: result.postedLineIds.length,
        skipped: result.skippedLineIds.length,
        ledgerEntryIds: result.ledgerEntryIds,
        alreadyPosted,
      })
    }

    if (action === 'reject') {
      const capture = await rejectCapture({ captureId: id, reviewerId: user.id, reviewNotes })
      await logAudit({
        userId: user.id,
        action: 'form_capture.reject',
        entityType: 'FormCapture',
        entityId: id,
        changes: { reviewNotes },
      })
      return ok({ capture })
    }

    const capture = await runExtraction(id)
    await logAudit({
      userId: user.id,
      action: 'form_capture.reextract',
      entityType: 'FormCapture',
      entityId: id,
    })
    return ok({ capture })
  } catch (error: any) {
    return fail(error.message, error.status ?? 500)
  }
}
