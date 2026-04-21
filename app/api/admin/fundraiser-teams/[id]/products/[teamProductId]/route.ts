import { NextRequest, NextResponse } from 'next/server'
import { z } from 'zod'
import { prisma as db } from '@/lib/prisma'
import { requireAdminSession } from '@/lib/admin-auth'

/**
 * Admin API: update or remove a single FundraiserTeamProduct row.
 *
 * PATCH  → price / sortOrder / isActive updates
 * DELETE → detach the product from the team (hard delete the link row)
 */

const UpdateSchema = z.object({
  price: z.number().positive().max(10_000).nullable().optional(),
  sortOrder: z.number().int().min(0).max(9999).optional(),
  isActive: z.boolean().optional(),
})

export async function PATCH(
  req: NextRequest,
  {
    params,
  }: { params: Promise<{ id: string; teamProductId: string }> },
) {
  try {
    await requireAdminSession()
  } catch {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }
  const { id: teamId, teamProductId } = await params

  let body: unknown
  try {
    body = await req.json()
  } catch {
    return NextResponse.json({ error: 'Invalid JSON' }, { status: 400 })
  }
  const parsed = UpdateSchema.safeParse(body)
  if (!parsed.success) {
    return NextResponse.json(
      { error: 'Invalid input', details: parsed.error.flatten() },
      { status: 400 },
    )
  }

  const existing = await db.fundraiserTeamProduct.findUnique({
    where: { id: teamProductId },
    select: { id: true, teamId: true },
  })
  if (!existing || existing.teamId !== teamId) {
    return NextResponse.json({ error: 'Not found' }, { status: 404 })
  }

  const row = await db.fundraiserTeamProduct.update({
    where: { id: teamProductId },
    data: {
      ...(parsed.data.price !== undefined ? { price: parsed.data.price } : {}),
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
  return NextResponse.json({ teamProduct: row })
}

export async function DELETE(
  _req: NextRequest,
  {
    params,
  }: { params: Promise<{ id: string; teamProductId: string }> },
) {
  try {
    await requireAdminSession()
  } catch {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }
  const { id: teamId, teamProductId } = await params

  const existing = await db.fundraiserTeamProduct.findUnique({
    where: { id: teamProductId },
    select: { id: true, teamId: true },
  })
  if (!existing || existing.teamId !== teamId) {
    return NextResponse.json({ error: 'Not found' }, { status: 404 })
  }

  await db.fundraiserTeamProduct.delete({ where: { id: teamProductId } })
  return NextResponse.json({ success: true })
}
