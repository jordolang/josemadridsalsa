import { NextRequest, NextResponse } from 'next/server'
import { z } from 'zod'

import { getCurrentUser, hasPermission } from '@/lib/rbac'
import { logAuditWithRequest } from '@/lib/audit'
import { adjustInventory } from '@/lib/inventory-manager'
import { MAX_BULK_PRODUCTS } from '@/lib/admin/bulk-products'

const BulkInventorySchema = z.object({
  adjustments: z
    .array(
      z.object({
        productId: z.string().cuid(),
        // Signed: negative writes stock off, positive restocks.
        quantity: z.number().int(),
      })
    )
    .min(1)
    .max(MAX_BULK_PRODUCTS),
  type: z.enum(['RESTOCK', 'ADJUSTMENT', 'DAMAGED', 'SAMPLE']).default('ADJUSTMENT'),
  reason: z.string().trim().min(1).max(200),
})

/**
 * Adjust stock across several products at once.
 *
 * Each adjustment goes through `adjustInventory` rather than a bulk write, so every change
 * still produces an InventoryTransaction and still evaluates low-stock alerts — a bulk path
 * that skipped those would silently create the blind spot the alerting exists to prevent.
 * Failures are collected per product rather than aborting the batch, so one bad id does not
 * discard the rest of a stock count.
 */
export async function POST(request: NextRequest) {
  try {
    const user = await getCurrentUser()
    if (!user || !(await hasPermission(user, 'products:write'))) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const { adjustments, type, reason } = BulkInventorySchema.parse(await request.json())

    const applied: string[] = []
    const failed: { productId: string; error: string }[] = []

    for (const adjustment of adjustments) {
      if (adjustment.quantity === 0) continue
      try {
        await adjustInventory({
          productId: adjustment.productId,
          quantity: adjustment.quantity,
          type,
          reason,
          userId: user.id,
        })
        applied.push(adjustment.productId)
      } catch (error) {
        failed.push({
          productId: adjustment.productId,
          error: error instanceof Error ? error.message : 'Adjustment failed',
        })
      }
    }

    await logAuditWithRequest(
      {
        userId: user.id,
        action: 'update',
        entityType: 'inventory',
        changes: { bulk: type, reason, applied: applied.length, failed: failed.length, adjustments },
      },
      request
    )

    return NextResponse.json({ success: true, applied: applied.length, failed })
  } catch (error) {
    if (error instanceof z.ZodError) {
      return NextResponse.json({ error: error.issues[0].message }, { status: 400 })
    }
    console.error('Bulk inventory error:', error)
    return NextResponse.json({ error: 'Bulk adjustment failed' }, { status: 500 })
  }
}
