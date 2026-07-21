import { NextRequest } from 'next/server'
import { prisma } from '@/lib/prisma'
import { requirePermission } from '@/lib/rbac'
import { ok, fail } from '@/lib/api'
import { logAudit } from '@/lib/audit'
import { soldUnits, toCasesAndJars } from '@/lib/events/manifest-calc'

interface ItemInput {
  productId: string
  expirationDate?: string | null
  takenCases?: number
  takenJars?: number
  returnedCases?: number
  returnedJars?: number
}

const toInt = (v: unknown): number => {
  const n = Math.trunc(Number(v))
  return Number.isFinite(n) && n > 0 ? n : 0
}

const hasQuantity = (i: ItemInput): boolean =>
  toInt(i.takenCases) > 0 ||
  toInt(i.takenJars) > 0 ||
  toInt(i.returnedCases) > 0 ||
  toInt(i.returnedJars) > 0

/**
 * GET /api/admin/events/[id]/manifest
 *
 * Returns the manifest (creating an in-memory shell if none exists yet) plus a
 * row for every active product, with the saved quantities merged in and units
 * sold computed. Products are ordered by category then name so salsas and chips
 * group together.
 */
export async function GET(
  _req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    await requirePermission('events:read')
    const { id } = await params

    const event = await prisma.featuredEvent.findUnique({
      where: { id },
      include: { manifest: { include: { items: true } } },
    })
    if (!event) {
      return fail('Event not found', 404)
    }

    const products = await prisma.product.findMany({
      where: { isActive: true },
      select: {
        id: true,
        name: true,
        sku: true,
        unitsPerCase: true,
        category: { select: { name: true } },
      },
      orderBy: [{ category: { name: 'asc' } }, { name: 'asc' }],
    })

    const itemsByProduct = new Map(
      (event.manifest?.items ?? []).map((i) => [i.productId, i])
    )

    const lines = products.map((p) => {
      const saved = itemsByProduct.get(p.id)
      const takenCases = saved?.takenCases ?? 0
      const takenJars = saved?.takenJars ?? 0
      const returnedCases = saved?.returnedCases ?? 0
      const returnedJars = saved?.returnedJars ?? 0
      const sold = soldUnits({
        takenCases,
        takenJars,
        returnedCases,
        returnedJars,
        unitsPerCase: p.unitsPerCase,
      })
      return {
        productId: p.id,
        productName: p.name,
        sku: p.sku,
        category: p.category?.name ?? 'Other',
        unitsPerCase: p.unitsPerCase,
        expirationDate: saved?.expirationDate ?? null,
        takenCases,
        takenJars,
        returnedCases,
        returnedJars,
        soldUnits: sold,
        soldBreakdown: toCasesAndJars(sold, p.unitsPerCase),
      }
    })

    return ok({
      manifest: event.manifest
        ? {
            id: event.manifest.id,
            status: event.manifest.status,
            packedAt: event.manifest.packedAt,
            returnedAt: event.manifest.returnedAt,
            notes: event.manifest.notes,
          }
        : { id: null, status: 'DRAFT', packedAt: null, returnedAt: null, notes: null },
      event: { id: event.id, title: event.title, startDate: event.startDate },
      lines,
    })
  } catch (error: any) {
    console.error('[GET /api/admin/events/[id]/manifest] Error:', error)
    return fail(error.message || 'Failed to fetch manifest', 500)
  }
}

/**
 * PUT /api/admin/events/[id]/manifest
 *
 * Upserts the manifest and replaces its line items with the supplied rows.
 * Only rows that carry a quantity or an expiration date are stored. When the
 * status is set to PACKED or RETURNED, every packed-out product must have an
 * expiration date on file.
 */
export async function PUT(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const user = await requirePermission('events:write')
    const { id } = await params

    const event = await prisma.featuredEvent.findUnique({ where: { id } })
    if (!event) {
      return fail('Event not found', 404)
    }

    const body = await req.json()
    const status: 'DRAFT' | 'PACKED' | 'RETURNED' = ['DRAFT', 'PACKED', 'RETURNED'].includes(
      body.status
    )
      ? body.status
      : 'DRAFT'
    const notes: string | null =
      typeof body.notes === 'string' && body.notes.trim().length > 0 ? body.notes.trim() : null

    const rawItems: ItemInput[] = Array.isArray(body.items) ? body.items : []
    const items = rawItems.filter(
      (i) => i.productId && (hasQuantity(i) || i.expirationDate)
    )

    // Expiration is mandatory once product is committed as packed/returned.
    if (status === 'PACKED' || status === 'RETURNED') {
      const missing = items.filter(
        (i) => (toInt(i.takenCases) > 0 || toInt(i.takenJars) > 0) && !i.expirationDate
      )
      if (missing.length > 0) {
        return fail(
          `Expiration date is required for every product taken (${missing.length} missing).`,
          400
        )
      }
    }

    const manifest = await prisma.$transaction(async (tx) => {
      const existing = await tx.eventManifest.findUnique({ where: { eventId: id } })

      const m = existing
        ? await tx.eventManifest.update({
            where: { eventId: id },
            data: {
              status,
              notes,
              packedAt:
                status !== 'DRAFT' && !existing.packedAt ? new Date() : existing.packedAt,
              returnedAt:
                status === 'RETURNED' && !existing.returnedAt
                  ? new Date()
                  : status === 'RETURNED'
                    ? existing.returnedAt
                    : null,
            },
          })
        : await tx.eventManifest.create({
            data: {
              eventId: id,
              status,
              notes,
              packedAt: status !== 'DRAFT' ? new Date() : null,
              returnedAt: status === 'RETURNED' ? new Date() : null,
            },
          })

      await tx.eventManifestItem.deleteMany({ where: { manifestId: m.id } })

      for (const i of items) {
        await tx.eventManifestItem.create({
          data: {
            manifestId: m.id,
            productId: i.productId,
            expirationDate: i.expirationDate ? new Date(i.expirationDate) : null,
            takenCases: toInt(i.takenCases),
            takenJars: toInt(i.takenJars),
            returnedCases: toInt(i.returnedCases),
            returnedJars: toInt(i.returnedJars),
          },
        })
      }

      return m
    })

    await logAudit({
      userId: user.id,
      action: 'events.manifest-save',
      entityType: 'eventManifest',
      entityId: manifest.id,
      changes: { status, lineCount: items.length },
    })

    return ok({ manifest })
  } catch (error: any) {
    console.error('[PUT /api/admin/events/[id]/manifest] Error:', error)
    return fail(error.message || 'Failed to save manifest', 500)
  }
}
