import { NextRequest, NextResponse } from 'next/server'
import { z } from 'zod'
import { prisma as db } from '@/lib/prisma'
import { requireAdminSession } from '@/lib/admin-auth'
import { logAuditWithRequest } from '@/lib/audit'

const updateSchema = z.object({
  logoUrl: z.string().url().max(500).nullable().optional(),
  heroImageUrl: z.string().url().max(500).nullable().optional(),
  heroVideoUrl: z.string().url().max(500).nullable().optional(),
  campaignTitle: z.string().trim().min(1).max(120).nullable().optional(),
  tagline: z.string().trim().min(1).max(240).nullable().optional(),
  storyHtml: z.string().max(50_000).nullable().optional(),
})

export async function PATCH(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  let admin: Awaited<ReturnType<typeof requireAdminSession>>
  try {
    admin = await requireAdminSession()
  } catch {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  const { id } = await params
  let body: unknown
  try {
    body = await req.json()
  } catch {
    return NextResponse.json({ error: 'Invalid JSON' }, { status: 400 })
  }

  const parsed = updateSchema.safeParse(body)
  if (!parsed.success) {
    return NextResponse.json(
      { error: 'Invalid input', details: parsed.error.flatten() },
      { status: 400 },
    )
  }

  const data: Record<string, string | null> = {}
  for (const [key, value] of Object.entries(parsed.data)) {
    if (value !== undefined) data[key] = value === '' ? null : value
  }

  if (Object.keys(data).length === 0) {
    return NextResponse.json({ error: 'No fields to update' }, { status: 400 })
  }

  try {
    const team = await db.fundraiserTeam.update({
      where: { id },
      data,
      select: {
        id: true,
        slug: true,
        name: true,
        logoUrl: true,
        heroImageUrl: true,
        heroVideoUrl: true,
        campaignTitle: true,
        tagline: true,
        storyHtml: true,
      },
    })

    await logAuditWithRequest(
      {
        userId: admin.id,
        action: 'update',
        entityType: 'fundraiser_team',
        entityId: id,
        changes: { fields: Object.keys(data) },
      },
      req,
    )

    return NextResponse.json({ team })
  } catch (err: unknown) {
    if (
      err instanceof Error &&
      'code' in err &&
      (err as { code?: string }).code === 'P2025'
    ) {
      return NextResponse.json({ error: 'Team not found' }, { status: 404 })
    }
    return NextResponse.json({ error: 'Update failed' }, { status: 500 })
  }
}
