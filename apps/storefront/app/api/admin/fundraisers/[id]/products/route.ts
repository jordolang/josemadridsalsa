import { NextRequest, NextResponse } from 'next/server'
import { z } from 'zod'
import { getCurrentUser, hasPermission } from '@/lib/rbac'
import { createChangeSnapshot, logAuditWithRequest } from '@/lib/audit'
import prisma from '@/lib/prisma'

const ProductSelectionSchema = z.object({
  selections: z.array(
    z.object({
      productId: z.string(),
      included: z.boolean(),
      price: z.number().nullable().optional(),
      isActive: z.boolean().optional(),
    })
  ),
})

/**
 * PUT /api/admin/fundraisers/[id]/products
 * Upsert FundraiserProduct records — include/exclude products with optional custom pricing
 */
export async function PUT(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const user = await getCurrentUser()
    if (!user || !(await hasPermission(user, 'orders:write'))) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 403 })
    }

    const { id: fundraiserId } = await params
    const body = await req.json()
    const parsed = ProductSelectionSchema.safeParse(body)

    if (!parsed.success) {
      return NextResponse.json({ error: 'Validation failed', details: parsed.error.issues }, { status: 400 })
    }

    const { selections } = parsed.data

    // Process each selection
    const results = await prisma.$transaction(
      selections.map((sel) => {
        if (sel.included) {
          return prisma.fundraiserProduct.upsert({
            where: {
              fundraiserId_productId: {
                fundraiserId,
                productId: sel.productId,
              },
            },
            create: {
              fundraiserId,
              productId: sel.productId,
              price: sel.price ?? null,
              isActive: sel.isActive ?? true,
            },
            update: {
              price: sel.price !== undefined ? sel.price : undefined,
              isActive: sel.isActive !== undefined ? sel.isActive : undefined,
            },
          })
        } else {
          // Remove from fundraiser
          return prisma.fundraiserProduct.deleteMany({
            where: { fundraiserId, productId: sel.productId },
          })
        }
      })
    )

    await logAuditWithRequest(
      {
        userId: user.id,
        action: 'update',
        entityType: 'fundraiser',
        entityId: fundraiserId,
        changes: { productSelections: parsed.data.selections },
      },
      req
    )

    return NextResponse.json({ success: true, count: results.length })
  } catch (error: unknown) {
    const msg = error instanceof Error ? error.message : 'Unknown error'
    return NextResponse.json({ error: 'Failed to update products', details: msg }, { status: 500 })
  }
}
