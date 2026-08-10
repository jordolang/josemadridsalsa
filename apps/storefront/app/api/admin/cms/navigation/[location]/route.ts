import { NextRequest } from 'next/server'
import { z } from 'zod'
import prisma from '@/lib/prisma'
import { requirePermission } from '@/lib/rbac'
import { ok, fail } from '@/lib/api'
import { logAudit } from '@/lib/audit'
import { navigationItemSchema } from '@/lib/cms/schemas'

type Ctx = { params: Promise<{ location: string }> }

const locationSchema = z.enum(['HEADER', 'FOOTER', 'MOBILE', 'UTILITY'])

/**
 * The editor submits a flat list where each item's `parentId` refers to
 * another item's client-side `id`. Ids are remapped to database ids on save,
 * so a menu can be rebuilt from scratch in a single request.
 */
const putSchema = z.object({
  name: z.string().min(1).max(120).optional(),
  items: z.array(navigationItemSchema).default([]),
})

export async function GET(_req: NextRequest, ctx: Ctx) {
  try {
    await requirePermission('content:read')
    const { location } = await ctx.params
    const parsed = locationSchema.safeParse(location.toUpperCase())
    if (!parsed.success) return fail('Unknown navigation location', 400)

    const menu = await prisma.navigationMenu.findUnique({
      where: { location: parsed.data },
      include: { items: { orderBy: { sortOrder: 'asc' } } },
    })
    return ok({ menu })
  } catch (error) {
    const err = error as { message?: string; status?: number }
    return fail(err.message ?? 'Failed to load navigation', err.status ?? 500)
  }
}

export async function PUT(req: NextRequest, ctx: Ctx) {
  try {
    const user = await requirePermission('content:write')
    const { location } = await ctx.params
    const parsed = locationSchema.safeParse(location.toUpperCase())
    if (!parsed.success) return fail('Unknown navigation location', 400)

    const body = await req.json()
    const { name, items } = putSchema.parse(body)

    // Reject parent references that point outside the submitted list, and any
    // cycle, before writing — a self-referencing item would make the public
    // tree builder drop the whole branch.
    const submittedIds = new Set(items.map((item) => item.id).filter(Boolean) as string[])
    for (const item of items) {
      if (item.parentId && !submittedIds.has(item.parentId)) {
        return fail(`Menu item "${item.label}" has an unknown parent`, 422)
      }
      if (item.parentId && item.parentId === item.id) {
        return fail(`Menu item "${item.label}" cannot be its own parent`, 422)
      }
    }

    const menu = await prisma.$transaction(async (tx) => {
      const existing = await tx.navigationMenu.upsert({
        where: { location: parsed.data },
        create: { location: parsed.data, name: name ?? `${parsed.data} menu` },
        update: name ? { name } : {},
      })

      await tx.navigationItem.deleteMany({ where: { menuId: existing.id } })

      // Two passes: create every item parentless to obtain database ids, then
      // wire up the parent links using the client-id → database-id mapping.
      const idMap = new Map<string, string>()
      for (const [index, item] of items.entries()) {
        const created = await tx.navigationItem.create({
          data: {
            menuId: existing.id,
            label: item.label,
            href: item.href,
            description: item.description ?? null,
            iconName: item.iconName ?? null,
            sortOrder: item.sortOrder ?? index,
            isVisible: item.isVisible,
            openInNewTab: item.openInNewTab,
          },
        })
        if (item.id) idMap.set(item.id, created.id)
        else idMap.set(`__index_${index}`, created.id)
      }

      for (const [index, item] of items.entries()) {
        if (!item.parentId) continue
        const childId = idMap.get(item.id ?? `__index_${index}`)
        const parentId = idMap.get(item.parentId)
        if (childId && parentId) {
          await tx.navigationItem.update({ where: { id: childId }, data: { parentId } })
        }
      }

      return tx.navigationMenu.findUnique({
        where: { id: existing.id },
        include: { items: { orderBy: { sortOrder: 'asc' } } },
      })
    })

    await logAudit({
      userId: user.id,
      action: 'cms.navigation.update',
      entityType: 'cms.navigation',
      entityId: parsed.data,
      changes: { itemCount: items.length },
    })

    return ok({ menu })
  } catch (error) {
    if (error instanceof z.ZodError) {
      return fail(
        error.issues.map((i) => `${i.path.join('.')}: ${i.message}`).join('; '),
        422
      )
    }
    const err = error as { message?: string; status?: number }
    return fail(err.message ?? 'Failed to save navigation', err.status ?? 500)
  }
}
