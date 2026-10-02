import { NextRequest, NextResponse } from 'next/server'
import { z } from 'zod'
import { requirePermission } from '@/lib/rbac'
import { PosTaxError, quotePosTaxCents } from '@/lib/pos/tax'

const TaxQuoteSchema = z.object({
  items: z
    .array(
      z.object({
        productId: z.string().min(1),
        price: z.number().nonnegative(),
        quantity: z.number().int().positive(),
      })
    )
    .max(200),
})

/** POST /api/pos/tax-quote — the till's live tax line, from Stripe Tax at the store address. */
export async function POST(request: NextRequest) {
  try {
    await requirePermission('orders:write')
  } catch (error) {
    const forbidden = error instanceof Error && error.message.startsWith('Forbidden')
    return NextResponse.json({ error: forbidden ? 'Forbidden' : 'Unauthorized' }, { status: forbidden ? 403 : 401 })
  }

  const parsed = TaxQuoteSchema.safeParse(await request.json().catch(() => null))
  if (!parsed.success) {
    return NextResponse.json({ error: 'Invalid cart' }, { status: 400 })
  }

  try {
    const taxCents = await quotePosTaxCents(
      parsed.data.items.map((item) => ({
        productId: item.productId,
        unitPriceCents: Math.round(item.price * 100),
        quantity: item.quantity,
      }))
    )
    return NextResponse.json({ taxCents })
  } catch (error) {
    if (error instanceof PosTaxError) {
      return NextResponse.json({ error: error.message }, { status: 503 })
    }
    console.error('[POS] Tax quote failed:', error)
    return NextResponse.json({ error: 'Tax service unavailable. Try again.' }, { status: 502 })
  }
}
