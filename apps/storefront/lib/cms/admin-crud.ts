import { NextRequest } from 'next/server'
import { z } from 'zod'
import { requirePermission } from '@/lib/rbac'
import { ok, fail } from '@/lib/api'
import { logAudit } from '@/lib/audit'

/**
 * Route-handler factory for the CMS's list/create and read/update/delete
 * endpoints.
 *
 * Eight CMS resources (banners, announcements, FAQs, redirects, ...) need the
 * same handler: check `content:*` permission, validate with Zod, call Prisma,
 * write an audit entry. Generating them from one definition keeps the
 * behaviour — especially the permission check and audit logging — identical
 * across all of them.
 */

/**
 * Structural view of a Prisma model delegate. Prisma generates a distinct,
 * deeply-generic type per model with no shared base, so the argument and
 * return types are intentionally loose here; every call site passes a real
 * delegate and validates its input with Zod first.
 */
export interface PrismaDelegate {
  findMany(args?: Record<string, unknown>): Promise<unknown[]>
  findUnique(args: Record<string, unknown>): Promise<unknown | null>
  create(args: Record<string, unknown>): Promise<unknown>
  update(args: Record<string, unknown>): Promise<unknown>
  delete(args: Record<string, unknown>): Promise<unknown>
}

export interface CrudOptions {
  /** Prisma delegate, e.g. `prisma.banner`. */
  delegate: PrismaDelegate
  /** Audit-log entity type and action prefix, e.g. `cms.banner`. */
  entityType: string
  /** Zod schema for create. */
  createSchema: z.ZodTypeAny
  /** Zod schema for update; defaults to a partial of the create schema. */
  updateSchema?: z.ZodTypeAny
  orderBy?: Record<string, unknown> | Record<string, unknown>[]
  include?: Record<string, unknown>
  /** Response key for the collection, e.g. `banners`. */
  collectionKey: string
  /** Response key for a single record, e.g. `banner`. */
  itemKey: string
}

function messageFor(error: unknown): { message: string; status: number } {
  if (error instanceof z.ZodError) {
    return { message: error.issues.map((i) => `${i.path.join('.')}: ${i.message}`).join('; '), status: 422 }
  }
  const err = error as { message?: string; status?: number; code?: string }
  // Prisma unique-constraint violation
  if (err?.code === 'P2002') {
    return { message: 'A record with that unique value already exists', status: 409 }
  }
  if (err?.code === 'P2025') {
    return { message: 'Not found', status: 404 }
  }
  return { message: err?.message ?? 'Request failed', status: err?.status ?? 500 }
}

/** GET (list) and POST (create) handlers for a collection route. */
export function createCollectionHandlers(options: CrudOptions) {
  const {
    delegate,
    entityType,
    createSchema,
    orderBy,
    include,
    collectionKey,
    itemKey,
  } = options

  async function GET() {
    try {
      await requirePermission('content:read')
      const records = await delegate.findMany({
        ...(orderBy ? { orderBy } : {}),
        ...(include ? { include } : {}),
      })
      return ok({ [collectionKey]: records })
    } catch (error) {
      const { message, status } = messageFor(error)
      return fail(message, status)
    }
  }

  async function POST(req: NextRequest) {
    try {
      const user = await requirePermission('content:write')
      const body = await req.json()
      const data = createSchema.parse(body)
      const record = await delegate.create({
        data: data as Record<string, unknown>,
        ...(include ? { include } : {}),
      })
      await logAudit({
        userId: user.id,
        action: `${entityType}.create`,
        entityType,
        entityId: (record as { id?: string })?.id,
        changes: data as Record<string, unknown>,
      })
      return ok({ [itemKey]: record }, 201)
    } catch (error) {
      const { message, status } = messageFor(error)
      return fail(message, status)
    }
  }

  return { GET, POST }
}

/** GET, PATCH and DELETE handlers for an item route. */
export function createItemHandlers(options: CrudOptions) {
  const { delegate, entityType, createSchema, updateSchema, include, itemKey } = options
  const patchSchema =
    updateSchema ??
    (createSchema instanceof z.ZodObject ? createSchema.partial() : createSchema)

  type Ctx = { params: Promise<{ id: string }> }

  async function GET(_req: NextRequest, ctx: Ctx) {
    try {
      await requirePermission('content:read')
      const { id } = await ctx.params
      const record = await delegate.findUnique({
        where: { id },
        ...(include ? { include } : {}),
      })
      if (!record) return fail('Not found', 404)
      return ok({ [itemKey]: record })
    } catch (error) {
      const { message, status } = messageFor(error)
      return fail(message, status)
    }
  }

  async function PATCH(req: NextRequest, ctx: Ctx) {
    try {
      const user = await requirePermission('content:write')
      const { id } = await ctx.params
      const body = await req.json()
      const data = patchSchema.parse(body)
      const record = await delegate.update({
        where: { id },
        data: data as Record<string, unknown>,
        ...(include ? { include } : {}),
      })
      await logAudit({
        userId: user.id,
        action: `${entityType}.update`,
        entityType,
        entityId: id,
        changes: data as Record<string, unknown>,
      })
      return ok({ [itemKey]: record })
    } catch (error) {
      const { message, status } = messageFor(error)
      return fail(message, status)
    }
  }

  async function DELETE(_req: NextRequest, ctx: Ctx) {
    try {
      const user = await requirePermission('content:write')
      const { id } = await ctx.params
      await delegate.delete({ where: { id } })
      await logAudit({
        userId: user.id,
        action: `${entityType}.delete`,
        entityType,
        entityId: id,
      })
      return ok({ success: true })
    } catch (error) {
      const { message, status } = messageFor(error)
      return fail(message, status)
    }
  }

  return { GET, PATCH, DELETE }
}
