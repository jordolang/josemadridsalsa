import { NextRequest, NextResponse } from 'next/server'
import { z } from 'zod'
import { requirePermission } from '@/lib/rbac'
import { recordCashSale, CashSaleError } from '@/lib/pos/cash-sale'
import { PosTaxError } from '@/lib/pos/tax'

const CashSaleSchema = z.object({
  items: z
    .array(
      z.object({
        productId: z.string(),
        quantity: z.number().int().positive(),
      })
    )
    .min(1, 'Cart is empty'),
  total: z.number().int().positive(),
  tendered: z.number().int().positive(),
  attemptId: z.string().uuid(),
})

/**
 * POST /api/pos/cash-sale
 * Records a completed cash sale: order, payment and stock deduction. Amounts are cents.
 * Prices come from the product records; `attemptId` makes a retried request return the same sale.
 */
export async function POST(request: NextRequest) {
  try {
    const user = await requirePermission('orders:write')

    const parsed = CashSaleSchema.safeParse(await request.json())
    if (!parsed.success) {
      return NextResponse.json(
        { error: 'Invalid cash sale payload', details: parsed.error.flatten() },
        { status: 400 }
      )
    }

    const { items, total, tendered, attemptId } = parsed.data
    const result = await recordCashSale({
      items,
      totalCents: total,
      tenderedCents: tendered,
      attemptId,
      userId: user.id,
    })

    return NextResponse.json(result, { status: 201 })
  } catch (error) {
    if (error instanceof PosTaxError) {
      return NextResponse.json({ error: error.message }, { status: 503 })
    }
    if (error instanceof CashSaleError) {
      return NextResponse.json({ error: error.message }, { status: error.status })
    }
    if (error instanceof Error && error.message.startsWith('Unauthorized')) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }
    if (error instanceof Error && error.message.startsWith('Forbidden')) {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
    }
    console.error('[POS] Cash sale error:', error)
    return NextResponse.json({ error: 'Unable to record cash sale. Please try again.' }, { status: 500 })
  }
}
