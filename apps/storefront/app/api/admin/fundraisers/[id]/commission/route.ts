import { NextRequest, NextResponse } from 'next/server'
import { z } from 'zod'
import { getCurrentUser, hasPermission } from '@/lib/rbac'
import prisma from '@/lib/prisma'

const CommissionSchema = z.object({
  commissionRate: z.number().min(0).max(100),
})

/**
 * PUT /api/admin/fundraisers/[id]/commission
 * Update commission rate
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

    const { id } = await params
    const body = await req.json()
    const parsed = CommissionSchema.safeParse(body)

    if (!parsed.success) {
      return NextResponse.json({ error: 'Validation failed', details: parsed.error.issues }, { status: 400 })
    }

    const existing = await prisma.fundraiser.findUnique({ where: { id } })
    if (!existing) {
      return NextResponse.json({ error: 'Fundraiser not found' }, { status: 404 })
    }

    const updated = await prisma.fundraiser.update({
      where: { id },
      data: { commissionRate: parsed.data.commissionRate },
    })

    return NextResponse.json(updated)
  } catch (error: unknown) {
    const msg = error instanceof Error ? error.message : 'Unknown error'
    return NextResponse.json({ error: 'Failed to update commission', details: msg }, { status: 500 })
  }
}
