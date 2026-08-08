import { NextRequest, NextResponse } from 'next/server'
import { z } from 'zod'

import { prisma } from '@/lib/prisma'
import { getCurrentUser, hasPermission } from '@/lib/rbac'
import { logAuditWithRequest } from '@/lib/audit'
import { generatePoNumber, purchaseOrderSubtotalCents } from '@/lib/purchasing/receiving'

const CreatePurchaseOrderSchema = z.object({
  supplierId: z.string().cuid(),
  expectedAt: z.coerce.date().optional(),
  shippingCost: z.number().min(0).max(100_000).default(0),
  notes: z.string().trim().max(2000).optional(),
  items: z
    .array(
      z.object({
        productId: z.string().cuid(),
        quantityOrdered: z.number().int().positive().max(100_000),
        unitCost: z.number().min(0).max(100_000),
      })
    )
    .min(1, 'A purchase order needs at least one line'),
  /** Submit immediately rather than saving a draft. */
  submit: z.boolean().default(false),
})

export async function GET(request: NextRequest) {
  const user = await getCurrentUser()
  if (!user || !(await hasPermission(user, 'inventory:read'))) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  const status = request.nextUrl.searchParams.get('status')
  const supplierId = request.nextUrl.searchParams.get('supplierId')

  const purchaseOrders = await prisma.purchaseOrder.findMany({
    where: {
      ...(status && status !== 'all' ? { status: status as never } : {}),
      ...(supplierId ? { supplierId } : {}),
    },
    orderBy: [{ createdAt: 'desc' }],
    take: 200,
    include: {
      supplier: { select: { id: true, name: true } },
      items: {
        select: {
          id: true,
          quantityOrdered: true,
          quantityReceived: true,
          unitCost: true,
          product: { select: { id: true, name: true, sku: true } },
        },
      },
    },
  })

  return NextResponse.json({ purchaseOrders })
}

export async function POST(request: NextRequest) {
  const user = await getCurrentUser()
  if (!user || !(await hasPermission(user, 'products:write'))) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  try {
    const body = CreatePurchaseOrderSchema.parse(await request.json())

    // One line per product: the unique index enforces it, but failing here gives a usable
    // message instead of a constraint violation.
    const productIds = body.items.map((item) => item.productId)
    if (new Set(productIds).size !== productIds.length) {
      return NextResponse.json(
        { error: 'The same product appears on more than one line. Combine them.' },
        { status: 400 }
      )
    }

    const products = await prisma.product.findMany({
      where: { id: { in: productIds } },
      select: { id: true },
    })
    if (products.length !== productIds.length) {
      return NextResponse.json({ error: 'One or more products could not be found.' }, { status: 400 })
    }

    const supplier = await prisma.supplier.findUnique({
      where: { id: body.supplierId },
      select: { id: true, name: true, isActive: true },
    })
    if (!supplier) {
      return NextResponse.json({ error: 'Supplier not found' }, { status: 404 })
    }

    const now = new Date()
    const purchaseOrder = await prisma.purchaseOrder.create({
      data: {
        poNumber: generatePoNumber(now),
        supplierId: supplier.id,
        status: body.submit ? 'SUBMITTED' : 'DRAFT',
        submittedAt: body.submit ? now : null,
        expectedAt: body.expectedAt ?? null,
        shippingCost: body.shippingCost,
        notes: body.notes ?? null,
        createdById: user.id,
        items: {
          create: body.items.map((item) => ({
            productId: item.productId,
            quantityOrdered: item.quantityOrdered,
            unitCost: item.unitCost,
          })),
        },
      },
      include: { items: true, supplier: { select: { name: true } } },
    })

    await logAuditWithRequest(
      {
        userId: user.id,
        action: 'create',
        entityType: 'PurchaseOrder',
        entityId: purchaseOrder.id,
        changes: {
          poNumber: purchaseOrder.poNumber,
          supplier: supplier.name,
          status: purchaseOrder.status,
          lines: purchaseOrder.items.length,
          subtotalCents: purchaseOrderSubtotalCents(
            body.items.map((i) => ({ quantityOrdered: i.quantityOrdered, unitCost: i.unitCost }))
          ),
        },
      },
      request
    )

    return NextResponse.json({ purchaseOrder }, { status: 201 })
  } catch (error) {
    if (error instanceof z.ZodError) {
      return NextResponse.json({ error: error.issues[0].message }, { status: 400 })
    }
    console.error('Create purchase order error:', error)
    return NextResponse.json({ error: 'Could not create the purchase order' }, { status: 500 })
  }
}
