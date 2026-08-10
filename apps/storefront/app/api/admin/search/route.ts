import { NextRequest, NextResponse } from 'next/server'

import { prisma } from '@/lib/prisma'
import { getCurrentUser, hasPermission } from '@/lib/rbac'
import {
  classifyQuery,
  digitsOnly,
  isSearchable,
  MATCH_SCORES,
  rankResults,
  scoreTextMatch,
  searchTargets,
  type SearchEntity,
  type SearchResult,
} from '@/lib/admin/global-search'

const PER_ENTITY_LIMIT = 8

/**
 * One search box over the whole admin.
 *
 * Each entity is queried directly and results are merged — see lib/admin/global-search.ts
 * for why this is federated rather than indexed. Only the entities the query shape could
 * plausibly match are queried, and each is permission-gated, so a staff member without
 * product access never sees products in their results.
 */
export async function GET(request: NextRequest) {
  const user = await getCurrentUser()
  if (!user) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  const query = (request.nextUrl.searchParams.get('q') ?? '').trim()
  if (!isSearchable(query)) {
    return NextResponse.json({ results: [], shape: null })
  }

  const shape = classifyQuery(query)
  const targets = new Set(searchTargets(shape))

  // Permissions are resolved once so an entity is only queried if its results could be
  // shown, rather than filtering them out after the database work is already done.
  const [canOrders, canProducts, canCustomers, canContent] = await Promise.all([
    hasPermission(user, 'orders:read'),
    hasPermission(user, 'products:read'),
    hasPermission(user, 'users:read'),
    hasPermission(user, 'content:read'),
  ])

  const allowed: Record<SearchEntity, boolean> = {
    order: canOrders,
    return: canOrders,
    customer: canCustomers,
    product: canProducts,
    fundraiser: canOrders,
    discount: canContent,
  }

  const wants = (entity: SearchEntity) => targets.has(entity) && allowed[entity]
  const contains = { contains: query, mode: 'insensitive' as const }

  const tasks: Promise<SearchResult[]>[] = []

  if (wants('order')) {
    tasks.push(
      prisma.order
        .findMany({
          where: {
            OR: [
              { orderNumber: contains },
              { trackingNumber: contains },
              { guestEmail: contains },
              { user: { OR: [{ email: contains }, { name: contains }] } },
              ...(shape === 'phone' ? [{ guestPhone: { contains: digitsOnly(query) } }] : []),
            ],
          },
          take: PER_ENTITY_LIMIT,
          orderBy: { createdAt: 'desc' },
          select: {
            id: true,
            orderNumber: true,
            total: true,
            status: true,
            guestEmail: true,
            trackingNumber: true,
            user: { select: { name: true, email: true } },
          },
        })
        .then((orders) =>
          orders.map((order) => ({
            entity: 'order' as const,
            id: order.id,
            title: order.orderNumber,
            subtitle: `${order.user?.name ?? order.guestEmail ?? 'Guest'} · $${Number(order.total).toFixed(2)} · ${order.status.toLowerCase()}`,
            href: `/admin/orders/${order.id}`,
            score:
              order.orderNumber.toLowerCase() === query.toLowerCase()
                ? MATCH_SCORES.exactIdentifier
                : order.trackingNumber?.toLowerCase() === query.toLowerCase()
                  ? MATCH_SCORES.trackingNumber
                  : scoreTextMatch(order.orderNumber, query) || MATCH_SCORES.nameContains,
          }))
        )
        .catch(() => [])
    )
  }

  if (wants('return')) {
    tasks.push(
      prisma.returnRequest
        .findMany({
          where: {
            OR: [{ rmaNumber: contains }, { order: { orderNumber: contains } }],
          },
          take: PER_ENTITY_LIMIT,
          orderBy: { createdAt: 'desc' },
          select: {
            id: true,
            rmaNumber: true,
            status: true,
            order: { select: { orderNumber: true } },
          },
        })
        .then((returns) =>
          returns.map((r) => ({
            entity: 'return' as const,
            id: r.id,
            title: r.rmaNumber,
            subtitle: `Order ${r.order.orderNumber} · ${r.status.toLowerCase()}`,
            href: `/admin/returns/${r.id}`,
            score:
              r.rmaNumber.toLowerCase() === query.toLowerCase()
                ? MATCH_SCORES.exactIdentifier
                : MATCH_SCORES.nameContains,
          }))
        )
        .catch(() => [])
    )
  }

  if (wants('customer')) {
    tasks.push(
      prisma.customer
        .findMany({
          where: {
            OR: [
              { email: contains },
              { firstName: contains },
              { lastName: contains },
              { sourceName: contains },
              ...(shape === 'phone' ? [{ phone: { contains: digitsOnly(query) } }] : []),
            ],
          },
          take: PER_ENTITY_LIMIT,
          select: {
            id: true,
            firstName: true,
            lastName: true,
            email: true,
            sourceName: true,
            totalOrders: true,
          },
        })
        .then((customers) =>
          customers.map((c) => {
            const name = [c.firstName, c.lastName].filter(Boolean).join(' ')
            return {
              entity: 'customer' as const,
              id: c.id,
              title: name || c.email,
              subtitle: `${c.email}${c.sourceName ? ` · ${c.sourceName}` : ''} · ${c.totalOrders} order${c.totalOrders === 1 ? '' : 's'}`,
              href: `/admin/customers?search=${encodeURIComponent(c.email)}`,
              score:
                c.email.toLowerCase() === query.toLowerCase()
                  ? MATCH_SCORES.exactEmail
                  : scoreTextMatch(name || c.email, query) || MATCH_SCORES.nameContains,
            }
          })
        )
        .catch(() => [])
    )
  }

  if (wants('product')) {
    tasks.push(
      prisma.product
        .findMany({
          where: { OR: [{ name: contains }, { sku: contains }, { barcode: contains }] },
          take: PER_ENTITY_LIMIT,
          select: { id: true, name: true, sku: true, inventory: true },
        })
        .then((products) =>
          products.map((p) => ({
            entity: 'product' as const,
            id: p.id,
            title: p.name,
            subtitle: `${p.sku} · ${p.inventory} in stock`,
            href: `/admin/products/${p.id}`,
            score:
              p.sku.toLowerCase() === query.toLowerCase()
                ? MATCH_SCORES.sku
                : scoreTextMatch(p.name, query) || MATCH_SCORES.nameContains,
          }))
        )
        .catch(() => [])
    )
  }

  if (wants('fundraiser')) {
    tasks.push(
      prisma.fundraiser
        .findMany({
          where: {
            OR: [{ name: contains }, { organizationName: contains }, { contactEmail: contains }],
          },
          take: PER_ENTITY_LIMIT,
          select: { id: true, name: true, organizationName: true, status: true },
        })
        .then((fundraisers) =>
          fundraisers.map((f) => ({
            entity: 'fundraiser' as const,
            id: f.id,
            title: f.name,
            subtitle: `${f.organizationName} · ${f.status.toLowerCase()}`,
            href: `/admin/fundraisers/${f.id}`,
            score: scoreTextMatch(f.name, query) || MATCH_SCORES.nameContains,
          }))
        )
        .catch(() => [])
    )
  }

  if (wants('discount')) {
    tasks.push(
      prisma.discountCode
        .findMany({
          where: { OR: [{ code: contains }, { description: contains }] },
          take: PER_ENTITY_LIMIT,
          select: { id: true, code: true, type: true, value: true, isActive: true },
        })
        .then((codes) =>
          codes.map((d) => ({
            entity: 'discount' as const,
            id: d.id,
            title: d.code,
            subtitle: `${d.type.toLowerCase().replace(/_/g, ' ')} ${d.value} · ${d.isActive ? 'active' : 'inactive'}`,
            href: `/admin/settings/discount-codes`,
            score:
              d.code.toLowerCase() === query.toLowerCase()
                ? MATCH_SCORES.exactIdentifier
                : MATCH_SCORES.nameContains,
          }))
        )
        .catch(() => [])
    )
  }

  const results = (await Promise.all(tasks)).flat()

  return NextResponse.json({ results: rankResults(results), shape })
}
