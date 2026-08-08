import { NextRequest, NextResponse } from 'next/server'
import { z } from 'zod'

import { prisma } from '@/lib/prisma'
import { getCurrentUser, hasPermission } from '@/lib/rbac'
import { logAuditWithRequest } from '@/lib/audit'
import {
  BulkProductRequestSchema,
  describeBulkAction,
  planCostFromPurchases,
  planPriceAdjustment,
  uniformUpdateFor,
} from '@/lib/admin/bulk-products'

/**
 * Apply one edit across a selection of products.
 *
 * Flag and category changes are a single updateMany. A percentage price change cannot be —
 * each row's new price derives from its own current price — so those are planned first and
 * written in one transaction, which keeps the catalogue from being left half-repriced.
 */
export async function POST(request: NextRequest) {
  try {
    const user = await getCurrentUser()
    if (!user || !(await hasPermission(user, 'products:write'))) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const { productIds, operation } = BulkProductRequestSchema.parse(await request.json())

    const existing = await prisma.product.findMany({
      where: { id: { in: productIds } },
      select: { id: true, price: true },
    })

    if (existing.length === 0) {
      return NextResponse.json({ error: 'No matching products' }, { status: 404 })
    }

    let updated = 0
    let skipped = 0
    let priceChanges: { id: string; from: number; to: number }[] = []

    const uniform = uniformUpdateFor(operation)

    if (uniform) {
      const result = await prisma.product.updateMany({
        where: { id: { in: existing.map((p) => p.id) } },
        data: uniform,
      })
      updated = result.count
    } else if (operation.action === 'adjust-price') {
      priceChanges = planPriceAdjustment(
        existing.map((p) => ({ id: p.id, price: Number(p.price) })),
        operation.percent
      )

      // One transaction: a partially applied price change across a catalogue is worse than
      // none at all, because there is no way to tell which rows moved.
      await prisma.$transaction(
        priceChanges.map((change) =>
          prisma.product.update({ where: { id: change.id }, data: { price: change.to } })
        )
      )
      updated = priceChanges.length
    } else if (operation.action === 'apply-latest-purchase-cost') {
      // Most recent purchase order line per product. Ordered newest-first and de-duplicated
      // in code rather than with a correlated subquery, because the selection is capped at
      // 200 products and clarity is worth more here than a clever query.
      const lines = await prisma.purchaseOrderItem.findMany({
        where: { productId: { in: existing.map((p) => p.id) } },
        select: { productId: true, unitCost: true, purchaseOrder: { select: { createdAt: true } } },
        orderBy: { purchaseOrder: { createdAt: 'desc' } },
      })

      const seen = new Set<string>()
      const latest: Array<{ productId: string; unitCost: number }> = []
      for (const line of lines) {
        if (seen.has(line.productId)) continue
        seen.add(line.productId)
        latest.push({ productId: line.productId, unitCost: Number(line.unitCost) })
      }

      const plan = planCostFromPurchases(existing.map((p) => p.id), latest)

      await prisma.$transaction(
        plan.updates.map((change) =>
          prisma.product.update({ where: { id: change.id }, data: { costPrice: change.cost } })
        )
      )
      updated = plan.updates.length
      skipped = plan.skipped.length
    }

    const summary = skipped
      ? `${describeBulkAction(operation, updated)} — ${skipped} skipped with no purchase history`
      : describeBulkAction(operation, updated)

    await logAuditWithRequest(
      {
        userId: user.id,
        action: 'update',
        entityType: 'product',
        changes: {
          bulk: operation.action,
          productIds: existing.map((p) => p.id),
          count: updated,
          // Before/after is recorded for price changes specifically, since that is the one
          // action that cannot be reconstructed from the action name alone.
          ...(priceChanges.length ? { priceChanges } : {}),
          // No silent caps: a run that only covered part of the selection says so.
          ...(skipped ? { skippedNoPurchaseHistory: skipped } : {}),
        },
      },
      request
    )

    return NextResponse.json({ success: true, updated, skipped, summary })
  } catch (error) {
    if (error instanceof z.ZodError) {
      return NextResponse.json({ error: error.issues[0].message }, { status: 400 })
    }
    console.error('Bulk product update error:', error)
    return NextResponse.json({ error: 'Bulk update failed' }, { status: 500 })
  }
}
