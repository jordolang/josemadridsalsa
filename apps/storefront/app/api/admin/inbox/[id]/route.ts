import { NextRequest } from 'next/server'
import { z } from 'zod'

import { prisma } from '@/lib/prisma'
import { requirePermission } from '@/lib/rbac'
import { ok, fail, failFromError } from '@/lib/api'
import { logAuditWithRequest } from '@/lib/audit'
import { completeStep, reopenStep } from '@/lib/inbox/resolution'

/**
 * PATCH /api/admin/inbox/[id]
 *
 * Ticks one step of a customer email off, or puts it back.
 *
 * Deliberately the only way the panel moves an email's status: `status` is derived from the
 * steps by `lib/inbox/resolution.ts`, never set directly, so "resolved" can never mean
 * anything other than "every required step was completed by somebody".
 */

const PatchSchema = z.object({
  stepId: z.string().cuid(),
  action: z.enum(['complete', 'reopen']),
  /** What the operator actually did. Kept on the step as the record of the work. */
  note: z.string().trim().max(1000).optional(),
})

export async function PATCH(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const user = await requirePermission('messaging:reply')
    const { id } = await params

    const parsed = PatchSchema.safeParse(await req.json().catch(() => ({})))
    if (!parsed.success) {
      return fail('Invalid step update', 400, parsed.error.flatten())
    }

    const step = await prisma.inboundEmailStep.findUnique({
      where: { id: parsed.data.stepId },
      select: { id: true, emailId: true },
    })

    // The step must belong to the email in the URL, or one operator could tick off a step
    // on an email they never opened by guessing an id.
    if (!step || step.emailId !== id) return fail('Step not found on this email', 404)

    const email =
      parsed.data.action === 'complete'
        ? await completeStep({ stepId: step.id, userId: user.id, note: parsed.data.note })
        : await reopenStep({ stepId: step.id, userId: user.id })

    await logAuditWithRequest(
      {
        userId: user.id,
        action: parsed.data.action === 'complete' ? 'INBOX_STEP_COMPLETED' : 'INBOX_STEP_REOPENED',
        entityType: 'InboundEmail',
        entityId: id,
        changes: { stepId: step.id, status: email.status },
      },
      req,
    )

    return ok({
      status: email.status,
      resolvedAt: email.resolvedAt,
      steps: email.steps,
    })
  } catch (error) {
    return failFromError(error, 'Failed to update that step')
  }
}
