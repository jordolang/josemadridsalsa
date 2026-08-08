import { NextRequest } from 'next/server'
import { z } from 'zod'
import prisma from '@/lib/prisma'
import { requirePermission } from '@/lib/rbac'
import { ok, fail } from '@/lib/api'
import { logAudit } from '@/lib/audit'
import { pageUpdateSchema } from '@/lib/cms/schemas'

type Ctx = { params: Promise<{ id: string }> }

export async function GET(_req: NextRequest, ctx: Ctx) {
  try {
    await requirePermission('content:read')
    const { id } = await ctx.params
    const page = await prisma.page.findUnique({
      where: { id },
      include: {
        sections: {
          orderBy: { sortOrder: 'asc' },
          include: { reusableSection: { select: { id: true, name: true, type: true } } },
        },
      },
    })
    if (!page) return fail('Not found', 404)
    return ok({ page })
  } catch (error) {
    const err = error as { message?: string; status?: number }
    return fail(err.message ?? 'Failed to load page', err.status ?? 500)
  }
}

/**
 * PATCH /api/admin/cms/pages/[id]
 *
 * When `sections` is present the page's section list is replaced wholesale
 * inside a transaction — the editor always submits the complete, ordered list,
 * so a diff would add complexity without changing the result.
 */
export async function PATCH(req: NextRequest, ctx: Ctx) {
  try {
    const user = await requirePermission('content:write')
    const { id } = await ctx.params
    const body = await req.json()
    const input = pageUpdateSchema.parse(body)
    const { sections, ...pageData } = input

    const page = await prisma.$transaction(async (tx) => {
      if (sections) {
        await tx.pageSection.deleteMany({ where: { pageId: id } })
        await tx.pageSection.createMany({
          data: sections.map((section, index) => ({
            pageId: id,
            type: section.type,
            sortOrder: section.sortOrder ?? index,
            isVisible: section.isVisible,
            data: section.data as object,
            reusableSectionId: section.reusableSectionId ?? null,
          })),
        })
      }
      return tx.page.update({
        where: { id },
        data: pageData,
        include: { sections: { orderBy: { sortOrder: 'asc' } } },
      })
    })

    await logAudit({
      userId: user.id,
      action: 'cms.page.update',
      entityType: 'cms.page',
      entityId: id,
      changes: { ...pageData, sectionCount: sections?.length },
    })

    return ok({ page })
  } catch (error) {
    if (error instanceof z.ZodError) {
      return fail(
        error.issues.map((i) => `${i.path.join('.')}: ${i.message}`).join('; '),
        422
      )
    }
    const err = error as { message?: string; status?: number; code?: string }
    if (err.code === 'P2002') return fail('A page with that slug already exists', 409)
    if (err.code === 'P2025') return fail('Not found', 404)
    return fail(err.message ?? 'Failed to update page', err.status ?? 500)
  }
}

export async function DELETE(_req: NextRequest, ctx: Ctx) {
  try {
    const user = await requirePermission('content:write')
    const { id } = await ctx.params

    const page = await prisma.page.findUnique({ where: { id }, select: { kind: true, slug: true } })
    if (!page) return fail('Not found', 404)
    // SYSTEM pages back a hard-coded route; deleting the record would silently
    // strip its overrides. Archive it from the editor instead.
    if (page.kind === 'SYSTEM') {
      return fail('System pages cannot be deleted — set the status to Archived instead', 400)
    }

    await prisma.page.delete({ where: { id } })
    await logAudit({
      userId: user.id,
      action: 'cms.page.delete',
      entityType: 'cms.page',
      entityId: id,
      changes: { slug: page.slug },
    })
    return ok({ success: true })
  } catch (error) {
    const err = error as { message?: string; status?: number }
    return fail(err.message ?? 'Failed to delete page', err.status ?? 500)
  }
}
