import { NextRequest } from 'next/server'
import { prisma } from '@/lib/prisma'
import { requirePermission } from '@/lib/rbac'
import { ok, fail } from '@/lib/api'
import { logAudit } from '@/lib/audit'

/**
 * POST /api/admin/customers/sync
 *
 * Builds/refreshes the unified customer list from the rest of the system:
 *   1. every registered `User` (linked via `userId`)
 *   2. every distinct guest-checkout email that never became an account
 * then recomputes order rollups (count, spend, last order) for all customers.
 *
 * Idempotent: keyed on lowercased email, so re-running links and refreshes
 * rather than duplicating. Imported email-only contacts are preserved; if one
 * later places an order or registers, this attaches the history to it.
 */
export async function POST(_req: NextRequest) {
  try {
    const user = await requirePermission('users:write')

    let created = 0
    let linked = 0

    // 1. Registered users -> customer, linked by userId.
    const users = await prisma.user.findMany({
      select: { id: true, email: true, name: true, phone: true },
    })

    for (const u of users) {
      if (!u.email) continue
      const email = u.email.toLowerCase()
      const parts = (u.name ?? '').trim().split(/\s+/).filter(Boolean)
      const firstName = parts.length > 0 ? parts[0] : null
      const lastName = parts.length > 1 ? parts.slice(1).join(' ') : null

      const existing = await prisma.customer.findUnique({
        where: { email },
        select: { userId: true },
      })

      if (!existing) {
        await prisma.customer.create({
          data: {
            email,
            firstName,
            lastName,
            phone: u.phone,
            userId: u.id,
            source: 'REGISTERED',
          },
        })
        created++
      } else if (existing.userId !== u.id) {
        // Attach the account to a contact we already had (e.g. from an import).
        await prisma.customer.update({
          where: { email },
          data: { userId: u.id },
        })
        linked++
      }
    }

    // 2. Guest-checkout emails with no account.
    const guests = await prisma.order.findMany({
      where: { userId: null, guestEmail: { not: null } },
      select: { guestEmail: true },
      distinct: ['guestEmail'],
    })

    for (const g of guests) {
      const email = g.guestEmail!.toLowerCase()
      const existing = await prisma.customer.findUnique({
        where: { email },
        select: { id: true },
      })
      if (!existing) {
        await prisma.customer.create({
          data: { email, source: 'GUEST_ORDER' },
        })
        created++
      }
    }

    // 3. Recompute order rollups from both linkage paths.
    const [byUser, byGuest] = await Promise.all([
      prisma.order.groupBy({
        by: ['userId'],
        where: { userId: { not: null } },
        _count: true,
        _sum: { total: true },
        _max: { createdAt: true },
      }),
      prisma.order.groupBy({
        by: ['guestEmail'],
        where: { userId: null, guestEmail: { not: null } },
        _count: true,
        _sum: { total: true },
        _max: { createdAt: true },
      }),
    ])

    const userAgg = new Map(byUser.map((r) => [r.userId as string, r]))
    const guestAgg = new Map(
      byGuest.map((r) => [(r.guestEmail as string).toLowerCase(), r])
    )

    const customers = await prisma.customer.findMany({
      select: { id: true, email: true, userId: true },
    })

    let updated = 0
    for (const c of customers) {
      const u = c.userId ? userAgg.get(c.userId) : undefined
      const g = guestAgg.get(c.email)
      const totalOrders = (u?._count ?? 0) + (g?._count ?? 0)
      if (totalOrders === 0) continue

      const totalSpent =
        Number(u?._sum.total ?? 0) + Number(g?._sum.total ?? 0)
      const dates = [u?._max.createdAt, g?._max.createdAt].filter(
        (d): d is Date => Boolean(d)
      )
      const lastOrderAt = dates.length
        ? new Date(Math.max(...dates.map((d) => d.getTime())))
        : null

      await prisma.customer.update({
        where: { id: c.id },
        data: { totalOrders, totalSpent, lastOrderAt },
      })
      updated++
    }

    await logAudit({
      userId: user.id,
      action: 'customers.sync',
      entityType: 'customer',
      entityId: 'bulk',
      changes: { created, linked, updated },
    })

    return ok({ created, linked, updated })
  } catch (error: any) {
    console.error('[POST /api/admin/customers/sync] Error:', error)
    return fail(error.message || 'Failed to sync customers', 500)
  }
}
