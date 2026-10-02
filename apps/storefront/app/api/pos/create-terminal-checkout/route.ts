import { NextRequest, NextResponse } from 'next/server'
import { z } from 'zod'
import { requirePermission } from '@/lib/rbac'
import { createTerminalCheckout, TerminalCheckoutError } from '@/lib/pos/terminal-checkout'
import { PosTaxError, quotePosTaxCents } from '@/lib/pos/tax'

const TerminalCheckoutSchema = z.object({
  items: z
    .array(
      z.object({
        productId: z.string(),
        name: z.string(),
        sku: z.string().optional(),
        price: z.number().positive(),
        quantity: z.number().int().positive(),
      })
    )
    .min(1, 'Cart is empty'),
  total: z.number().int().positive(),
  deviceId: z.string().optional().default('default'),
})

export async function POST(request: NextRequest) {
  try {
    // POS requires admin/staff access
    await requirePermission('orders:write')

    const json = await request.json()
    const parsed = TerminalCheckoutSchema.safeParse(json)

    if (!parsed.success) {
      return NextResponse.json(
        { error: 'Invalid checkout payload', details: parsed.error.flatten() },
        { status: 400 }
      )
    }

    const { items, total, deviceId } = parsed.data
    const lineItems = items.map((item) => ({
      productId: item.productId,
      name: item.name,
      sku: item.sku,
      unitPriceCents: Math.round(item.price * 100),
      quantity: item.quantity,
    }))

    // Tax is computed here, never taken from the till. The till shows the same quote
    // (/api/pos/tax-quote), so a mismatch means the rate moved under the cashier.
    const taxCents = await quotePosTaxCents(lineItems)
    const totalCents =
      lineItems.reduce((sum, item) => sum + item.unitPriceCents * item.quantity, 0) + taxCents
    if (totalCents !== total) {
      return NextResponse.json(
        { error: 'The tax amount changed. Review the total and charge again.' },
        { status: 409 }
      )
    }

    const { checkoutId, orderNumber } = await createTerminalCheckout({
      items: lineItems,
      taxCents,
      totalCents,
      deviceId,
    })

    return NextResponse.json({ checkoutId, orderNumber })
  } catch (error) {
    if (error instanceof PosTaxError) {
      return NextResponse.json({ error: error.message }, { status: 503 })
    }
    if (error instanceof TerminalCheckoutError) {
      return NextResponse.json({ error: error.message }, { status: error.status })
    }
    if (error instanceof z.ZodError) {
      return NextResponse.json(
        { error: error.issues[0].message },
        { status: 400 }
      )
    }
    if (error instanceof Error && error.message.startsWith('Unauthorized')) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }
    if (error instanceof Error && error.message.startsWith('Forbidden')) {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
    }
    console.error('[POS] Create terminal checkout error:', error)
    return NextResponse.json(
      { error: 'Unable to create terminal checkout. Please try again.' },
      { status: 500 }
    )
  }
}
