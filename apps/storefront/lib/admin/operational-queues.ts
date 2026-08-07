import type { Prisma } from '@prisma/client'

import { SETTLED_FULFILLMENT_STATUSES } from '@/lib/orders/fulfillment'
import { TERMINAL_RETURN_STATUSES } from '@/lib/orders/returns'
import { PAID_PAYMENT_STATUSES } from '@/lib/payments/status'

/**
 * The operational dashboard answers "what needs doing right now", which is a different
 * question from "how is the business performing" — that lives in /admin/analytics and
 * /admin/growth. Mixing them is what turns a dashboard into wallpaper.
 *
 * Every queue here is defined by the same `where` clause the destination page uses, so the
 * number on the card and the rows behind the link cannot disagree. Each one is a link into
 * a filtered list, never a bare statistic: "7 need shipping" has to be clickable, or the
 * reader has to go and find them by hand.
 */

export type QueueSeverity = 'critical' | 'attention' | 'info'

export interface OperationalQueue {
  key: string
  label: string
  /** What the operator should do about it, not what the number counts. */
  action: string
  href: string
  severity: QueueSeverity
  /** Counted as zero-is-good: a queue at zero is healthy and can be de-emphasised. */
  emptyIsGood: boolean
}

/** Orders that are paid but have not fully shipped. Mirrors the Needs Shipping saved view. */
export const needsShippingWhere: Prisma.OrderWhereInput = {
  paymentStatus: { in: PAID_PAYMENT_STATUSES },
  fulfillmentStatus: { notIn: SETTLED_FULFILLMENT_STATUSES },
  status: { notIn: ['CANCELLED', 'REFUNDED'] },
}

export const paymentFailedWhere: Prisma.OrderWhereInput = {
  paymentStatus: 'FAILED',
  status: { notIn: ['CANCELLED'] },
}

/** Orders taking payment but stuck before confirmation — usually a webhook that never landed. */
export const stuckPendingWhere = (olderThan: Date): Prisma.OrderWhereInput => ({
  status: 'PENDING',
  paymentStatus: { in: PAID_PAYMENT_STATUSES },
  createdAt: { lt: olderThan },
})

export const openReturnsWhere: Prisma.ReturnRequestWhereInput = {
  status: { notIn: TERMINAL_RETURN_STATUSES },
}

export const activeInventoryAlertsWhere: Prisma.InventoryAlertWhereInput = {
  status: { in: ['ACTIVE', 'ACKNOWLEDGED'] },
}

export const pendingFundraiserSignupsWhere: Prisma.FundraiserSignupRequestWhereInput = {
  status: 'PENDING',
}

export const pendingWholesaleWhere: Prisma.WholesaleAccountWhereInput = {
  status: 'PENDING',
}

/** How long a paid-but-unconfirmed order may sit before it is worth a human look. */
export const STUCK_PENDING_MINUTES = 30

export const OPERATIONAL_QUEUES: OperationalQueue[] = [
  {
    key: 'needsShipping',
    label: 'Needs shipping',
    action: 'Paid orders waiting to go out',
    href: '/admin/orders?view=needs-shipping',
    severity: 'attention',
    emptyIsGood: true,
  },
  {
    key: 'paymentFailed',
    label: 'Payment failed',
    action: 'Orders where payment did not go through',
    href: '/admin/orders?view=payment-failed',
    severity: 'critical',
    emptyIsGood: true,
  },
  {
    key: 'stuckPending',
    label: 'Stuck pending',
    action: `Paid but unconfirmed for over ${STUCK_PENDING_MINUTES} minutes`,
    href: '/admin/orders?status=PENDING',
    severity: 'critical',
    emptyIsGood: true,
  },
  {
    key: 'openReturns',
    label: 'Open returns',
    action: 'Return requests awaiting a decision',
    href: '/admin/returns',
    severity: 'attention',
    emptyIsGood: true,
  },
  {
    key: 'inventoryAlerts',
    label: 'Inventory alerts',
    action: 'Products at or below their threshold',
    href: '/admin/inventory',
    severity: 'attention',
    emptyIsGood: true,
  },
  {
    key: 'fundraiserSignups',
    label: 'Fundraiser signups',
    action: 'Applications awaiting review',
    href: '/admin/fundraisers/signups',
    severity: 'info',
    emptyIsGood: true,
  },
  {
    key: 'wholesaleApplications',
    label: 'Wholesale applications',
    action: 'Accounts awaiting approval',
    href: '/admin/wholesale',
    severity: 'info',
    emptyIsGood: true,
  },
]

export type QueueCounts = Record<string, number>

export interface QueueCard extends OperationalQueue {
  count: number
}

/**
 * Pair each queue with its count and order the result by what most needs attention:
 * non-empty before empty, then by severity, then by size. An operator reading top-to-bottom
 * should hit the thing that matters first without scanning.
 */
export function rankQueues(counts: QueueCounts): QueueCard[] {
  const severityRank: Record<QueueSeverity, number> = { critical: 0, attention: 1, info: 2 }

  return OPERATIONAL_QUEUES.map((queue) => ({ ...queue, count: counts[queue.key] ?? 0 })).sort(
    (a, b) => {
      const aEmpty = a.count === 0
      const bEmpty = b.count === 0
      if (aEmpty !== bEmpty) return aEmpty ? 1 : -1
      if (severityRank[a.severity] !== severityRank[b.severity]) {
        return severityRank[a.severity] - severityRank[b.severity]
      }
      return b.count - a.count
    }
  )
}

/** True when nothing anywhere needs a human. */
export function isAllClear(counts: QueueCounts): boolean {
  return OPERATIONAL_QUEUES.every((queue) => (counts[queue.key] ?? 0) === 0)
}

/** Total items awaiting action, for an at-a-glance headline. */
export function totalOutstanding(counts: QueueCounts): number {
  return OPERATIONAL_QUEUES.reduce((sum, queue) => sum + (counts[queue.key] ?? 0), 0)
}
