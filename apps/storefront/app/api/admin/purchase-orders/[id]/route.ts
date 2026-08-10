import { NextRequest, NextResponse } from 'next/server'
import { z } from 'zod'

import { prisma } from '@/lib/prisma'
import { getCurrentUser, hasPermission } from '@/lib/rbac'
import { logAuditWithRequest } from '@/lib/audit'

/**
 * Lifecycle transitions a person makes: submit a draft, or cancel.
 *
 * Deliberately cannot set PARTIALLY_RECEIVED or RECEIVED — those are derived from received
 * quantities by the receiving path and stamping them here would let the status disagree with
 * the line items, which is the failure this whole model was shaped to prevent.
 */
const UpdatePurchaseOrderSchema = z.object({
  action: z.enum(['submit', 'cancel']),
  notes: z.string().trim().max(2000).optional(),
})

export async function GET(
  _request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const user = await getCurrentUser()
  if (!user || !(await hasPermission(user, 'inventory:read'))) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  const { id } = await params
  const purchaseOrder = await prisma.purchaseOrder.findUnique({
    where: { id },
    include: {
      supplier: true,
      createdBy: { select: { id: true, name: true, email: true } },
      items: {
        include: { product: { select: { id: true, name: true, sku: true, inventory: true } } },
      },
      receipts: {
        orderBy: { receivedAt: 'desc' },
        include: {
          receivedBy: { select: { id: true, name: true } },
          items: { select: { id: true, purchaseOrderItemId: true, quantity: true } },
        },
      },
    },
  })

  if (!purchaseOrder) {
    return NextResponse.json({ error: 'Purchase order not found' }, { status: 404 })
  }

  return NextResponse.json({ purchaseOrder })
}

export async function PATCH(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const user = await getCurrentUser()
  if (!user || !(await hasPermission(user, 'products:write'))) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  try {
    const { id } = await params
    const body = UpdatePurchaseOrderSchema.parse(await request.json())

    const existing = await prisma.purchaseOrder.findUnique({
      where: { id },
      select: { id: true, poNumber: true, status: true, items: { select: { id: true } } },
    })

    if (!existing) {
      return NextResponse.json({ error: 'Purchase order not found' }, { status: 404 })
    }

    const now = new Date()

    if (body.action === 'submit') {
      if (existing.status !== 'DRAFT') {
        return NextResponse.json(
          { error: 'Only a draft purchase order can be submitted.' },
          { status: 400 }
        )
      }
      if (existing.items.length === 0) {
        return NextResponse.json(
          { error: 'A purchase order with no lines cannot be submitted.' },
          { status: 400 }
        )
      }
    }

    if (body.action === 'cancel') {
      // A received order is a historical fact — cancelling it would leave stock on the shelf
      // with no record of where it came from.
      if (existing.status === 'RECEIVED' || existing.status === 'PARTIALLY_RECEIVED') {
        return NextResponse.json(
          { error: 'Stock has already been received against this order, so it cannot be cancelled.' },
          { status: 400 }
        )
      }
      if (existing.status === 'CANCELLED') {
        return NextResponse.json({ error: 'That order is already cancelled.' }, { status: 400 })
      }
    }

    const purchaseOrder = await prisma.purchaseOrder.update({
      where: { id },
      data:
        body.action === 'submit'
          ? { status: 'SUBMITTED', submittedAt: now, ...(body.notes ? { notes: body.notes } : {}) }
          : { status: 'CANCELLED', cancelledAt: now, ...(body.notes ? { notes: body.notes } : {}) },
      include: { supplier: { select: { name: true } }, items: true },
    })

    await logAuditWithRequest(
      {
        userId: user.id,
        action: 'update',
        entityType: 'PurchaseOrder',
        entityId: purchaseOrder.id,
        changes: {
          poNumber: purchaseOrder.poNumber,
          from: existing.status,
          to: purchaseOrder.status,
        },
      },
      request
    )

    return NextResponse.json({ purchaseOrder })
  } catch (error) {
    if (error instanceof z.ZodError) {
      return NextResponse.json({ error: error.issues[0].message }, { status: 400 })
    }
    console.error('Update purchase order error:', error)
    return NextResponse.json({ error: 'Could not update the purchase order' }, { status: 500 })
  }
}
