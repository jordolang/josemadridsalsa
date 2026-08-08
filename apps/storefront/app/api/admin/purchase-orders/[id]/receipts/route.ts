import { NextRequest, NextResponse } from 'next/server'
import { z } from 'zod'

import { getCurrentUser, hasPermission } from '@/lib/rbac'
import { logAuditWithRequest } from '@/lib/audit'
import { receivePurchaseOrder } from '@/lib/purchasing/receive-purchase-order'

const ReceiveSchema = z.object({
  lines: z
    .array(
      z.object({
        purchaseOrderItemId: z.string().cuid(),
        // Zero is allowed and filtered out downstream, so a receiving form can post every
        // line without the operator having to clear the untouched ones.
        quantity: z.number().int().min(0).max(100_000),
      })
    )
    .min(1),
  /** Packing slip or supplier invoice number. */
  reference: z.string().trim().max(120).optional(),
  notes: z.string().trim().max(2000).optional(),
})

/**
 * Record a delivery against a purchase order.
 *
 * All the work — validation, the receipt rows, the incremented rollup and the stock movement
 * — is in `receivePurchaseOrder`, which is the single writer for received quantities. This
 * route only authenticates, parses, and reports.
 */
export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const user = await getCurrentUser()
  if (!user || !(await hasPermission(user, 'products:write'))) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  try {
    const { id } = await params
    const body = ReceiveSchema.parse(await request.json())

    const result = await receivePurchaseOrder({
      purchaseOrderId: id,
      lines: body.lines,
      reference: body.reference ?? null,
      notes: body.notes ?? null,
      receivedById: user.id,
    })

    if (!result.ok) {
      const status = result.error.code === 'not_receivable' ? 409 : 400
      return NextResponse.json({ error: result.error.message, code: result.error.code }, { status })
    }

    await logAuditWithRequest(
      {
        userId: user.id,
        action: 'create',
        entityType: 'PurchaseOrderReceipt',
        entityId: result.receiptId,
        changes: {
          purchaseOrderId: id,
          reference: body.reference ?? null,
          status: result.status,
          productsRestocked: result.movedProducts,
          lines: body.lines.filter((line) => line.quantity > 0),
        },
      },
      request
    )

    return NextResponse.json(result, { status: 201 })
  } catch (error) {
    if (error instanceof z.ZodError) {
      return NextResponse.json({ error: error.issues[0].message }, { status: 400 })
    }
    console.error('Receive purchase order error:', error)
    return NextResponse.json({ error: 'Could not record the receipt' }, { status: 500 })
  }
}
