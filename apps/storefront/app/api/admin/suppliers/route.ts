import { NextRequest, NextResponse } from 'next/server'
import { z } from 'zod'

import { prisma } from '@/lib/prisma'
import { getCurrentUser, hasPermission } from '@/lib/rbac'
import { logAuditWithRequest } from '@/lib/audit'

const SupplierSchema = z.object({
  name: z.string().trim().min(1).max(200),
  contactName: z.string().trim().max(200).optional(),
  email: z.string().email().optional().or(z.literal('')),
  phone: z.string().trim().max(50).optional(),
  address1: z.string().trim().max(200).optional(),
  address2: z.string().trim().max(200).optional(),
  city: z.string().trim().max(100).optional(),
  state: z.string().trim().max(100).optional(),
  postalCode: z.string().trim().max(20).optional(),
  country: z.string().trim().max(100).optional(),
  notes: z.string().trim().max(2000).optional(),
})

export async function GET(request: NextRequest) {
  const user = await getCurrentUser()
  if (!user || !(await hasPermission(user, 'inventory:read'))) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  const includeInactive = request.nextUrl.searchParams.get('includeInactive') === 'true'
  const suppliers = await prisma.supplier.findMany({
    where: includeInactive ? {} : { isActive: true },
    orderBy: { name: 'asc' },
    include: { _count: { select: { purchaseOrders: true } } },
  })

  return NextResponse.json({ suppliers })
}

export async function POST(request: NextRequest) {
  const user = await getCurrentUser()
  if (!user || !(await hasPermission(user, 'products:write'))) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  try {
    const body = SupplierSchema.parse(await request.json())

    const supplier = await prisma.supplier.create({
      data: {
        ...body,
        // An empty string from a cleared form field is absence, not a value.
        email: body.email || null,
      },
    })

    await logAuditWithRequest(
      {
        userId: user.id,
        action: 'create',
        entityType: 'Supplier',
        entityId: supplier.id,
        changes: { name: supplier.name },
      },
      request
    )

    return NextResponse.json({ supplier }, { status: 201 })
  } catch (error) {
    if (error instanceof z.ZodError) {
      return NextResponse.json({ error: error.issues[0].message }, { status: 400 })
    }
    console.error('Create supplier error:', error)
    return NextResponse.json({ error: 'Could not create the supplier' }, { status: 500 })
  }
}
