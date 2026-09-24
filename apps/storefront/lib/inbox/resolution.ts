/**
 * The rule that an alert cannot be cleared until the concern has actually been addressed.
 *
 * Everywhere else in the notification centre, "read" means "seen". For a customer email it
 * means "done": the notification stays unread, and keeps counting against the bell, until
 * every required step on the email carries a completion. That is the whole point of the
 * feature — a customer email that is dismissed without being handled is precisely the
 * failure this was built to make impossible.
 *
 * Both surfaces go through here: the web panel's PATCH and the desktop shell's write. There
 * is no second copy of the rule to fall out of step.
 */

import type { InboundEmail, InboundEmailStep } from '@prisma/client'

import { prisma } from '@/lib/prisma'

/** `entityType` on the notifications this feature raises. */
export const INBOUND_EMAIL_ENTITY = 'InboundEmail'

export class UnresolvedEmailError extends Error {
  constructor(
    message: string,
    /** What is still outstanding, so the caller can show it rather than just refusing. */
    readonly outstanding: string[],
  ) {
    super(message)
    this.name = 'UnresolvedEmailError'
  }
}

/** Steps that block resolution: required, and not yet done. */
export function outstandingSteps(steps: InboundEmailStep[]): InboundEmailStep[] {
  return steps.filter((step) => !step.isOptional && step.completedAt === null)
}

export function isResolvable(steps: InboundEmailStep[]): boolean {
  return outstandingSteps(steps).length === 0
}

/**
 * Whether this notification may be marked read.
 *
 * Notifications that are not about a customer email are unaffected — the ordinary
 * "seen is enough" behaviour is the right one for a low-stock warning.
 */
export async function canClearNotification(notification: {
  entityType: string | null
  entityId: string | null
}): Promise<{ allowed: true } | { allowed: false; reason: string; outstanding: string[] }> {
  if (notification.entityType !== INBOUND_EMAIL_ENTITY || !notification.entityId) {
    return { allowed: true }
  }

  const email = await prisma.inboundEmail.findUnique({
    where: { id: notification.entityId },
    include: { steps: { orderBy: { position: 'asc' } } },
  })

  // A notification whose email has been deleted is just a stale row; refusing to clear it
  // would strand it in the list forever.
  if (!email) return { allowed: true }

  if (email.status === 'RESOLVED' || email.status === 'AUTO_ANSWERED' || email.status === 'IGNORED') {
    return { allowed: true }
  }

  const outstanding = outstandingSteps(email.steps)
  if (outstanding.length === 0) return { allowed: true }

  return {
    allowed: false,
    reason: `${outstanding.length} step${outstanding.length === 1 ? '' : 's'} still open on this customer email. Work them off before clearing the alert.`,
    outstanding: outstanding.map((step) => step.instruction),
  }
}

/**
 * Tick one step off.
 *
 * Returns the email with its steps, and resolves the whole email when that was the last
 * required one — an operator should not have to complete the work and then separately
 * declare it complete.
 */
export async function completeStep(params: {
  stepId: string
  userId: string
  note?: string | null
}): Promise<InboundEmail & { steps: InboundEmailStep[] }> {
  const step = await prisma.inboundEmailStep.findUnique({
    where: { id: params.stepId },
    select: { id: true, emailId: true, completedAt: true },
  })
  if (!step) throw new Error('That step no longer exists.')

  if (!step.completedAt) {
    await prisma.inboundEmailStep.update({
      where: { id: step.id },
      data: {
        completedAt: new Date(),
        completedById: params.userId,
        note: params.note?.trim() || null,
      },
    })
  }

  return settleEmail(step.emailId, params.userId)
}

/** Undo a tick, which re-opens the email and the alert with it. */
export async function reopenStep(params: {
  stepId: string
  userId: string
}): Promise<InboundEmail & { steps: InboundEmailStep[] }> {
  const step = await prisma.inboundEmailStep.findUnique({
    where: { id: params.stepId },
    select: { id: true, emailId: true },
  })
  if (!step) throw new Error('That step no longer exists.')

  await prisma.inboundEmailStep.update({
    where: { id: step.id },
    data: { completedAt: null, completedById: null, note: null },
  })

  return settleEmail(step.emailId, params.userId)
}

/**
 * Bring the email's status into line with its steps.
 *
 * Called after every step change so status is derived, never asserted: an email is RESOLVED
 * exactly when nothing required is outstanding, and drops back to IN_PROGRESS the moment
 * something is re-opened.
 */
async function settleEmail(
  emailId: string,
  userId: string,
): Promise<InboundEmail & { steps: InboundEmailStep[] }> {
  const current = await prisma.inboundEmail.findUnique({
    where: { id: emailId },
    include: { steps: { orderBy: { position: 'asc' } } },
  })
  if (!current) throw new Error('That email no longer exists.')

  // AUTO_ANSWERED and IGNORED are terminal verdicts about what the message was, not
  // progress through a checklist, so step activity does not move them.
  if (current.status === 'AUTO_ANSWERED' || current.status === 'IGNORED') return current

  const done = isResolvable(current.steps)
  const anyProgress = current.steps.some((step) => step.completedAt !== null)

  const status = done ? 'RESOLVED' : anyProgress ? 'IN_PROGRESS' : 'NEEDS_ACTION'

  const updated = await prisma.inboundEmail.update({
    where: { id: emailId },
    data: {
      status,
      resolvedAt: done ? (current.resolvedAt ?? new Date()) : null,
      resolvedById: done ? (current.resolvedById ?? userId) : null,
    },
    include: { steps: { orderBy: { position: 'asc' } } },
  })

  // Clearing the alert is the operator's action, not a side effect — but once the work is
  // genuinely done the alert must stop blocking, so the notifications are released here.
  if (done) {
    await prisma.notification
      .updateMany({
        where: { entityType: INBOUND_EMAIL_ENTITY, entityId: emailId, isRead: false },
        data: { isRead: true, readAt: new Date() },
      })
      .catch(() => undefined)
  }

  return updated
}
