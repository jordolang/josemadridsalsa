import { NextRequest, NextResponse } from 'next/server'
import { z } from 'zod'

import { prisma } from '@/lib/prisma'
import { getCurrentUser, hasPermission } from '@/lib/rbac'
import { logAuditWithRequest } from '@/lib/audit'
import {
  BulkProductRequestSchema,
  describeBulkAction,
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
    }

    const summary = describeBulkAction(operation, updated)

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
        },
      },
      request
    )

    return NextResponse.json({ success: true, updated, summary })
  } catch (error) {
    if (error instanceof z.ZodError) {
      return NextResponse.json({ error: error.issues[0].message }, { status: 400 })
    }
    console.error('Bulk product update error:', error)
    return NextResponse.json({ error: 'Bulk update failed' }, { status: 500 })
  }
}
