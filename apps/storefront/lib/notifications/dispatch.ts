import type { NotificationSeverity, NotificationType, Prisma } from '@prisma/client'

import { prisma } from '@/lib/prisma'

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
  paymentFailed: (orderId: string) => `payment-failed:${orderId}`,
  inventoryLow: (productId: string) => `inventory-low:${productId}`,
  inventoryOut: (productId: string) => `inventory-out:${productId}`,
  returnRequested: (returnId: string) => `return-requested:${returnId}`,
  integrationFailed: (integration: string) => `integration-failed:${integration}`,
}

export const NOTIFICATION_SEVERITY_BY_TYPE: Record<NotificationType, NotificationSeverity> = {
  ORDER_NEW: 'INFO',
  ORDER_STATUS_CHANGE: 'INFO',
  ORDER_HIGH_VALUE: 'INFO',
  ORDER_MODIFIED: 'INFO',
  SYSTEM: 'INFO',
  PAYMENT_FAILED: 'CRITICAL',
  INVENTORY_LOW: 'WARNING',
  INVENTORY_OUT_OF_STOCK: 'CRITICAL',
  RETURN_REQUESTED: 'WARNING',
  INTEGRATION_FAILED: 'CRITICAL',
}

export function severityFor(type: NotificationType): NotificationSeverity {
  return NOTIFICATION_SEVERITY_BY_TYPE[type] ?? 'INFO'
}

export async function markNotificationRead(id: string, userId: string): Promise<void> {
  await prisma.notification.updateMany({
    // Scoped by userId so one operator cannot clear another's list by guessing an id.
    where: { id, userId },
    data: { isRead: true, readAt: new Date() },
  })
}

export async function markAllNotificationsRead(userId: string): Promise<number> {
  const { count } = await prisma.notification.updateMany({
    where: { userId, isRead: false },
    data: { isRead: true, readAt: new Date() },
  })
  return count
}

export async function countUnreadNotifications(userId: string): Promise<number> {
  return prisma.notification.count({ where: { userId, isRead: false } }).catch(() => 0)
}
