import { NextRequest } from 'next/server'
import { z } from 'zod'
import prisma from '@/lib/prisma'
import { requirePermission } from '@/lib/rbac'
import { ok, fail } from '@/lib/api'
import { logAudit } from '@/lib/audit'
import { pageCreateSchema } from '@/lib/cms/schemas'

/**
 * GET /api/admin/cms/pages — list pages, newest first within each kind.
 */
export async function GET(req: NextRequest) {
  try {
    await requirePermission('content:read')
    const { searchParams } = new URL(req.url)
    const kind = searchParams.get('kind')

    const pages = await prisma.page.findMany({
      where: kind === 'SYSTEM' || kind === 'LANDING' ? { kind } : {},
      orderBy: [{ kind: 'asc' }, { updatedAt: 'desc' }],
      include: { _count: { select: { sections: true } } },
    })
    return ok({ pages })
  } catch (error) {
    const err = error as { message?: string; status?: number }
    return fail(err.message ?? 'Failed to list pages', err.status ?? 500)
  }
}

/**
 * POST /api/admin/cms/pages — create a page and its sections in one write.
 */
export async function POST(req: NextRequest) {
  try {
    const user = await requirePermission('content:write')
    const body = await req.json()
    const input = pageCreateSchema.parse(body)
    const { sections, ...pageData } = input

    const page = await prisma.page.create({
      data: {
        ...pageData,
        createdById: user.id,
        sections: {
          create: sections.map((section, index) => ({
            type: section.type,
            sortOrder: section.sortOrder ?? index,
            isVisible: section.isVisible,
            data: section.data as object,
            reusableSectionId: section.reusableSectionId ?? null,
          })),
        },
      },
      include: { sections: { orderBy: { sortOrder: 'asc' } } },
    })

    await logAudit({
      userId: user.id,
      action: 'cms.page.create',
      entityType: 'cms.page',
      entityId: page.id,
      changes: { slug: page.slug, kind: page.kind, status: page.status },
    })

    return ok({ page }, 201)
  } catch (error) {
    if (error instanceof z.ZodError) {
      return fail(
        error.issues.map((i) => `${i.path.join('.')}: ${i.message}`).join('; '),
        422
      )
    }
    const err = error as { message?: string; status?: number; code?: string }
    if (err.code === 'P2002') return fail('A page with that slug already exists', 409)
    return fail(err.message ?? 'Failed to create page', err.status ?? 500)
  }
}
