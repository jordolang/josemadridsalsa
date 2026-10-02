import { NextRequest, NextResponse } from 'next/server'
import { z } from 'zod'
import { requirePermission } from '@/lib/rbac'
import { createTerminalCheckout, TerminalCheckoutError } from '@/lib/pos/terminal-checkout'

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
  taxAmount: z.number().int().min(0).optional().default(0),
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

    const { items, total, taxAmount, deviceId } = parsed.data

    const { checkoutId, orderNumber } = await createTerminalCheckout({
      items: items.map((item) => ({
        productId: item.productId,
        name: item.name,
        sku: item.sku,
        unitPriceCents: Math.round(item.price * 100),
        quantity: item.quantity,
      })),
      taxCents: taxAmount,
      totalCents: total,
      deviceId,
    })

    return NextResponse.json({ checkoutId, orderNumber })
  } catch (error) {
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
