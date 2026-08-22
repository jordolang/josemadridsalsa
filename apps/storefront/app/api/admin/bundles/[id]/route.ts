import { NextRequest } from 'next/server'
import prisma from '@/lib/prisma'
import { requirePermission } from '@/lib/rbac'
import { ok, fail, failFromError } from '@/lib/api'
import { logAudit } from '@/lib/audit'
import { z } from 'zod'
import { bundleProductRows, bundleComponentSchema, slugSchema } from '@/lib/bundles'

const bundleSchema = z.object({
  name: z.string().min(1),
  // Lenient here (validated conditionally below) so a bundle whose stored slug predates the
  // URL-safe rule can still be edited — the form resubmits the existing slug on every save.
  slug: z.string().min(1),
  description: z.string().nullable().optional(),
  image: z.string().url().nullable().optional(),
  price: z.number().nonnegative().max(1_000_000),
  isActive: z.boolean().optional(),
  sortOrder: z.number().int().optional(),
  metaTitle: z.string().nullable().optional(),
  metaDescription: z.string().nullable().optional(),
  ogImage: z.string().url().nullable().optional(),
  components: z.array(bundleComponentSchema).min(1, 'A bundle needs at least one product'),
})

export async function GET(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    await requirePermission('products:read')
    const { id } = await params
    const bundle = await prisma.bundle.findUnique({
      where: { id },
      include: {
        products: {
          orderBy: { sortOrder: 'asc' },
          include: {
            product: {
              select: { id: true, name: true, slug: true, sku: true, featuredImage: true, price: true },
            },
          },
        },
        _count: { select: { products: true } },
      },
    })
    if (!bundle) return fail('Bundle not found', 404)
    return ok({ bundle })
  } catch (error) {
    return failFromError(error, 'Failed to load bundle')
  }
}

export async function PATCH(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const user = await requirePermission('products:write')
    const body = await req.json()
    const { components, ...data } = bundleSchema.partial().parse(body)
    const { id } = await params

    const existing = await prisma.bundle.findUnique({ where: { id } })
    if (!existing) return fail('Bundle not found', 404)

    // Enforce the URL-safe slug rule only when the slug is actually being changed, so a legacy slug
    // that predates the rule doesn't block editing the rest of the bundle. Persist the parsed
    // (trimmed) value so the stored slug matches the /bundles/[slug] exact-match lookup.
    if (data.slug !== undefined && data.slug !== existing.slug) {
      const check = slugSchema.safeParse(data.slug)
      if (!check.success) return fail('Invalid bundle data', 400, check.error.issues)
      data.slug = check.data
    }

    // When the component set is supplied, replace it wholesale so the new order sticks; the scalar
    // fields update alongside it in one transaction. When omitted, only the scalar fields change.
    const bundle = await prisma.$transaction(async (tx) => {
      if (components) {
        await tx.bundleProduct.deleteMany({ where: { bundleId: id } })
      }
      return tx.bundle.update({
        where: { id },
        data: {
          ...data,
          ...(components ? { products: { create: bundleProductRows(components) } } : {}),
        },
      })
    })

    await logAudit({
      userId: user.id,
      action: 'UPDATE',
      entityType: 'Bundle',
      entityId: bundle.id,
      changes: { ...data, components },
    })

    return ok({ bundle })
  } catch (error: any) {
    if (error instanceof SyntaxError) return fail('Invalid JSON body', 400)
    if (error?.name === 'ZodError') return fail('Invalid bundle data', 400, error.issues)
    if (error.code === 'P2002') {
      return fail('A bundle with this name or slug already exists', 409)
    }
    if (error.code === 'P2003' || error.code === 'P2025') {
      return fail('One or more selected products could not be found', 400)
    }
    return failFromError(error, 'Failed to update bundle')
  }
}

export async function DELETE(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const user = await requirePermission('products:write')
    const { id } = await params

    const existing = await prisma.bundle.findUnique({ where: { id } })
    if (!existing) return fail('Bundle not found', 404)

    // A bundle is just a priced grouping — deleting it detaches its products (the join rows
    // cascade) and never touches the products themselves.
    await prisma.bundle.delete({ where: { id } })

    await logAudit({
      userId: user.id,
      action: 'DELETE',
      entityType: 'Bundle',
      entityId: id,
      changes: { name: existing.name },
    })

    return ok({ message: 'Bundle deleted' })
  } catch (error) {
    return failFromError(error, 'Failed to delete bundle')
  }
}
