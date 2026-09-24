import type { NotificationSeverity, NotificationType, Prisma } from '@prisma/client'

import { prisma } from '@/lib/prisma'
import { canClearNotification, UnresolvedEmailError } from '@/lib/inbox/resolution'

/**
 * In-app notifications for the people running the shop.
 *
 * Two properties matter more than the delivery itself. Notifications are **deduplicated**
 * on a caller-supplied key, so a condition that is re-observed on every page load or cron
 * tick updates one row instead of burying the list; and dispatch **never throws**, because
 * it runs after the thing it describes has already happened — failing to tell someone about
 * a captured payment must not roll the payment back.
 */

export interface NotificationSpec {
  type: NotificationType
  severity?: NotificationSeverity
  title: string
  message: string
  entityType?: string | null
  entityId?: string | null
  /** Where the operator should land. Keep it a filtered list, not a bare page. */
  link?: string | null
  /**
   * Stable identity for the underlying fact — `inventory-low:<productId>`,
   * `payment-failed:<orderId>`. Omit only for genuinely one-off messages.
   */
  dedupeKey?: string | null
}

/** Roles that run the business day to day and should see operational problems. */
const OPERATOR_ROLES: Prisma.UserWhereInput['role'] = { in: ['ADMIN', 'DEVELOPER', 'STAFF'] }

/**
 * Send a notification to every operator.
 *
 * Returns the number of recipients, mostly so callers can log it; a zero here means nobody
 * is configured to receive operational alerts, which is worth noticing.
 */
export async function notifyOperators(spec: NotificationSpec): Promise<number> {
  try {
    const operators = await prisma.user.findMany({
      where: { role: OPERATOR_ROLES },
      select: { id: true },
    })

    if (operators.length === 0) {
      console.warn('[notifications] No operators to notify for', spec.type)
      return 0
    }

    for (const operator of operators) {
      await upsertNotification(operator.id, spec)
    }

    return operators.length
  } catch (error) {
    console.warn('[notifications] Dispatch failed:', spec.type, error)
    return 0
  }
}

/**
 * Create or refresh one operator's notification.
 *
 * A repeat of an already-unread condition refreshes its message and timestamp. A repeat of
 * one that was already **read** is surfaced again — if stock went low, was acknowledged,
 * recovered, and went low a second time, that is genuinely new information.
 */
export async function upsertNotification(
  userId: string,
  spec: NotificationSpec
): Promise<void> {
  const data = {
    type: spec.type,
    severity: spec.severity ?? 'INFO',
    title: spec.title,
    message: spec.message,
    entityType: spec.entityType ?? null,
    entityId: spec.entityId ?? null,
    link: spec.link ?? null,
  }

  try {
    if (!spec.dedupeKey) {
      await prisma.notification.create({ data: { ...data, userId, dedupeKey: null } })
      return
    }

    await prisma.notification.upsert({
      where: { userId_dedupeKey: { userId, dedupeKey: spec.dedupeKey } },
      create: { ...data, userId, dedupeKey: spec.dedupeKey },
      update: { ...data, isRead: false, readAt: null, createdAt: new Date() },
    })
  } catch (error) {
    console.warn('[notifications] Could not write notification:', spec.type, error)
  }
}

/** Deterministic dedupe keys, so the same fact always collapses onto the same row. */
export const dedupeKeys = {
  newOrder: (orderId: string) => `new-order:${orderId}`,
  highValueOrder: (orderId: string) => `high-value-order:${orderId}`,
  paymentFailed: (orderId: string) => `payment-failed:${orderId}`,
  inventoryLow: (productId: string) => `inventory-low:${productId}`,
  inventoryOut: (productId: string) => `inventory-out:${productId}`,
  returnRequested: (returnId: string) => `return-requested:${returnId}`,
  integrationFailed: (integration: string) => `integration-failed:${integration}`,
  customerEmail: (emailId: string) => `customer-email:${emailId}`,
}

export const NOTIFICATION_SEVERITY_BY_TYPE: Record<NotificationType, NotificationSeverity> = {
  // Overridden per message by the classifier's own reading — a broken jar and a question
  // about heat level are both CUSTOMER_EMAIL and are not equally urgent.
  CUSTOMER_EMAIL: 'WARNING',
  ORDER_NEW: 'INFO',
  ORDER_STATUS_CHANGE: 'INFO',
  ORDER_HIGH_VALUE: 'INFO',
  ORDER_MODIFIED: 'INFO',
  SYSTEM: 'INFO',
  PAYMENT_FAILED: 'CRITICAL',
  INVENTORY_LOW: 'WARNING',
  INVENTORY_OUT_OF_STOCK: 'CRITICAL',
  RETURN_REQUESTED: 'WARNING',
  RETURN_AGING: 'WARNING',
  INTEGRATION_FAILED: 'CRITICAL',
  ORDER_UNFULFILLED_STALE: 'WARNING',
}

export function severityFor(type: NotificationType): NotificationSeverity {
  return NOTIFICATION_SEVERITY_BY_TYPE[type] ?? 'INFO'
}

/**
 * Mark one notification read.
 *
 * Most notifications clear on being seen. A customer-email alert does not: it clears only
 * once the work attached to it is done, which is checked by `lib/inbox/resolution.ts` and
 * refused here. The refusal is an exception rather than a silent no-op, because an operator
 * who clicks "clear" and sees nothing happen will assume the panel is broken.
 */
export async function markNotificationRead(id: string, userId: string): Promise<void> {
  const notification = await prisma.notification.findFirst({
    // Scoped by userId so one operator cannot clear another's list by guessing an id.
    where: { id, userId },
    select: { id: true, entityType: true, entityId: true },
  })

  if (!notification) return

  const verdict = await canClearNotification(notification)
  if (!verdict.allowed) {
    throw new UnresolvedEmailError(verdict.reason, verdict.outstanding)
  }

  await prisma.notification.update({
    where: { id: notification.id },
    data: { isRead: true, readAt: new Date() },
  })
}

/**
 * Clear everything clearable.
 *
 * "Mark all read" deliberately leaves blocked customer-email alerts behind rather than
 * failing outright — the operator asked to tidy the list, and the whole point of those
 * alerts is that they survive a tidy-up.
 */
export async function markAllNotificationsRead(userId: string): Promise<number> {
  const unread = await prisma.notification.findMany({
    where: { userId, isRead: false },
    select: { id: true, entityType: true, entityId: true },
  })

  const clearable: string[] = []
  for (const notification of unread) {
    const verdict = await canClearNotification(notification)
    if (verdict.allowed) clearable.push(notification.id)
  }

  if (clearable.length === 0) return 0

  const { count } = await prisma.notification.updateMany({
    where: { userId, id: { in: clearable }, isRead: false },
    data: { isRead: true, readAt: new Date() },
  })
  return count
}

export async function countUnreadNotifications(userId: string): Promise<number> {
  return prisma.notification.count({ where: { userId, isRead: false } }).catch(() => 0)
}
