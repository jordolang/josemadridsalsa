import { NextRequest, NextResponse } from 'next/server'
import { z } from 'zod'
import { prisma as db } from '@/lib/prisma'
import { requireAdminSession } from '@/lib/admin-auth'
import { logAuditWithRequest } from '@/lib/audit'

/**
 * Admin API: list + attach products for a FundraiserTeam.
 *
 * GET  → current catalog rows, ordered by sortOrder
 * POST → attach a product (idempotent via unique(teamId, productId))
 */

const AttachSchema = z.object({
  productId: z.string().min(1).max(40),
  price: z.number().positive().max(10_000).nullable().optional(),
  sortOrder: z.number().int().min(0).max(9999).optional(),
  isActive: z.boolean().optional(),
})

export async function GET(
  _req: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  let admin: Awaited<ReturnType<typeof requireAdminSession>>
  try {
    admin = await requireAdminSession()
  } catch {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }
  const { id } = await params

  const rows = await db.fundraiserTeamProduct.findMany({
    where: { teamId: id },
    orderBy: [{ sortOrder: 'asc' }, { createdAt: 'asc' }],
    include: {
      product: {
        select: {
          id: true,
          name: true,
          slug: true,
          price: true,
          isActive: true,
          featuredImage: true,
        },
      },
    },
  })
  return NextResponse.json({ products: rows })
}

export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  let admin: Awaited<ReturnType<typeof requireAdminSession>>
  try {
    admin = await requireAdminSession()
  } catch {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }
  const { id: teamId } = await params

  let body: unknown
  try {
    body = await req.json()
  } catch {
    return NextResponse.json({ error: 'Invalid JSON' }, { status: 400 })
  }
  const parsed = AttachSchema.safeParse(body)
  if (!parsed.success) {
    return NextResponse.json(
      { error: 'Invalid input', details: parsed.error.flatten() },
      { status: 400 },
    )
  }

  const [team, product] = await Promise.all([
    db.fundraiserTeam.findUnique({ where: { id: teamId }, select: { id: true } }),
    db.product.findUnique({
      where: { id: parsed.data.productId },
      select: { id: true },
    }),
  ])
  if (!team) {
    return NextResponse.json({ error: 'Team not found' }, { status: 404 })
  }
  if (!product) {
    return NextResponse.json({ error: 'Product not found' }, { status: 404 })
  }

  try {
    const row = await db.fundraiserTeamProduct.upsert({
      where: {
        teamId_productId: {
          teamId,
          productId: parsed.data.productId,
        },
      },
      create: {
        teamId,
        productId: parsed.data.productId,
        price: parsed.data.price ?? null,
        sortOrder: parsed.data.sortOrder ?? 0,
        isActive: parsed.data.isActive ?? true,
      },
      update: {
        price: parsed.data.price ?? null,
        ...(parsed.data.sortOrder !== undefined
          ? { sortOrder: parsed.data.sortOrder }
          : {}),
        ...(parsed.data.isActive !== undefined
          ? { isActive: parsed.data.isActive }
          : {}),
      },
      include: {
        product: {
          select: {
            id: true,
            name: true,
            slug: true,
            price: true,
            isActive: true,
            featuredImage: true,
          },
        },
      },
    })

    await logAuditWithRequest(
      {
        userId: admin.id,
        action: 'update',
        entityType: 'fundraiser_team_product',
        entityId: row.id,
        changes: { teamId, productId: parsed.data.productId, price: parsed.data.price ?? null },
      },
      req,
    )

    return NextResponse.json({ teamProduct: row })
  } catch (err) {
    console.error('Attach team product failed:', err)
    return NextResponse.json(
      { error: 'Could not attach product' },
      { status: 500 },
    )
  }
}
