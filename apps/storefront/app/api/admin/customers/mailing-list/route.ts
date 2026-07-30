import { NextRequest } from 'next/server'
import { z } from 'zod'
import prisma from '@/lib/prisma'
import { requirePermission } from '@/lib/rbac'
import { ok, fail } from '@/lib/api'
import { logAudit } from '@/lib/audit'
import {
  buildCustomerWhere,
  subscriberStatusFor,
} from '@/lib/customers/customer-list'

/**
 * POST /api/admin/customers/mailing-list
 *
 * Builds a `MailingList` from the customer list — either everything matching
 * the current filters, or an explicit set of ticked rows.
 *
 * Unsubscribes travel with the data: a customer whose `emailStatus` is not
 * recognisably mailable is still added, but as UNSUBSCRIBED with an
 * `unsubscribedAt`, so campaigns skip them and a later import can't quietly
 * resurrect them as subscribed.
 */

const bodySchema = z.object({
  name: z.string().trim().min(1).max(200),
  description: z.string().trim().max(1000).optional(),
  /** Tick-selected rows. When present, filters are ignored. */
  customerIds: z.array(z.string().min(1)).max(50000).optional(),
  filters: z
    .object({
      search: z.string().optional(),
      source: z.string().optional(),
      accountType: z.string().optional(),
    })
    .optional(),
})

const SELECT_BATCH = 5000
const INSERT_BATCH = 1000

export async function POST(req: NextRequest) {
  try {
    // Creating a list reads the customer book and writes to email marketing, so
    // it needs both permissions rather than whichever is looser.
    const user = await requirePermission('users:read')
    await requirePermission('content:write')

    const body = await req.json().catch(() => null)
    const parsed = bodySchema.safeParse(body)
    if (!parsed.success) {
      return fail('Invalid request', 400, parsed.error.flatten())
    }
    const { name, description, customerIds, filters } = parsed.data

    const where =
      customerIds && customerIds.length > 0
        ? { id: { in: customerIds } }
        : buildCustomerWhere(filters ?? {})

    const total = await prisma.customer.count({ where })
    if (total === 0) {
      return fail('No customers match — nothing to build a list from', 400)
    }

    const list = await prisma.mailingList.create({
      data: {
        name,
        description: description || null,
        createdById: user.id,
      },
    })

    let added = 0
    let unsubscribed = 0
    let cursor: string | undefined

    // Paged with a cursor rather than skip/take: at 22k+ rows an offset scan
    // gets slower every page, and rows must not be missed.
    for (;;) {
      const batch = await prisma.customer.findMany({
        where,
        select: {
          id: true,
          email: true,
          firstName: true,
          lastName: true,
          phone: true,
          emailStatus: true,
          accountType: true,
          sourceName: true,
        },
        orderBy: { id: 'asc' },
        take: SELECT_BATCH,
        ...(cursor ? { cursor: { id: cursor }, skip: 1 } : {}),
      })
      if (batch.length === 0) break
      cursor = batch[batch.length - 1].id

      const rows = batch.map((c) => {
        const status = subscriberStatusFor(c.emailStatus)
        if (status !== 'SUBSCRIBED') unsubscribed++
        return {
          listId: list.id,
          email: c.email,
          firstName: c.firstName,
          lastName: c.lastName,
          phone: c.phone,
          status,
          unsubscribedAt: status === 'UNSUBSCRIBED' ? new Date() : null,
          source: 'customer-list',
          // The account type and organization are what make this list
          // segmentable once it lands in email marketing.
          tags: [c.accountType, ...(c.sourceName ? [c.sourceName] : [])],
        }
      })

      for (let i = 0; i < rows.length; i += INSERT_BATCH) {
        const res = await prisma.mailingListSubscriber.createMany({
          data: rows.slice(i, i + INSERT_BATCH),
          // `@@unique([listId, email])` — a duplicate address just collapses.
          skipDuplicates: true,
        })
        added += res.count
      }

      if (batch.length < SELECT_BATCH) break
    }

    await logAudit({
      userId: user.id,
      action: 'customers.mailingList.create',
      entityType: 'mailingList',
      entityId: list.id,
      changes: {
        name,
        matched: total,
        added,
        unsubscribed,
        scope: customerIds?.length ? 'selection' : 'filters',
      },
    })

    return ok({
      list: { id: list.id, name: list.name },
      matched: total,
      added,
      unsubscribed,
    })
  } catch (error: any) {
    console.error('[POST /api/admin/customers/mailing-list] Error:', error)
    return fail(error.message || 'Failed to create mailing list', error.status ?? 500)
  }
}
