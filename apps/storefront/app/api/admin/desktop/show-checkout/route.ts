import { NextRequest, NextResponse } from 'next/server'
import { z } from 'zod'
import { prisma } from '@/lib/prisma'
import { getCurrentUser, hasPermission, isStaff } from '@/lib/rbac'
import { logAudit } from '@/lib/audit'
import { SECTION_PERMISSION } from '@/lib/admin-desktop/access'
import {
  checkoutLines,
  checkoutNote,
  mergeTaken,
  type CheckoutProduct,
  type CheckoutShow,
} from '@/lib/admin-desktop/show-checkout'
import { showCheckoutCodesHtml } from '@/lib/admin-desktop/show-checkout-codes'

/**
 * Show checkout: the shows to check salsa out for and the catalogue to match
 * case labels against (GET), and saving a scanned cart onto the show's packing
 * manifest (POST).
 *
 * A checkout is the show form filled in by scanning. A manifest still in
 * Draft holds the plan, so the first checkout replaces its quantities with
 * what was scanned; a manifest already Packed/Out (the first cart went to the
 * van earlier) has this cart added to it. Either way the manifest ends up
 * Packed/Out, with an expiration date on every salsa taken, as the form
 * requires.
 */

export const dynamic = 'force-dynamic'

/** Shows that started more than this long ago are not offered. */
const RECENT_DAYS = 14

async function staffWith(permission: string | null) {
  const user = await getCurrentUser()
  if (!user || !isStaff(user)) return { error: NextResponse.json({ error: 'Unauthorized' }, { status: 403 }) }
  if (permission && !(await hasPermission(user, permission))) {
    return { error: NextResponse.json({ error: 'Forbidden' }, { status: 403 }) }
  }
  return { user }
}

export async function GET() {
  const auth = await staffWith(SECTION_PERMISSION.events)
  if (auth.error) return auth.error

  try {
    const since = new Date(Date.now() - RECENT_DAYS * 24 * 60 * 60 * 1000)
    const [events, rows] = await Promise.all([
      prisma.featuredEvent.findMany({
        where: {
          OR: [{ startDate: { gte: since } }, { endDate: { gte: since } }],
          bookingStatus: { notIn: ['DECLINED', 'CANCELLED'] },
        },
        orderBy: { startDate: 'asc' },
        take: 60,
        select: {
          id: true,
          title: true,
          startDate: true,
          venue: true,
          location: true,
          city: true,
          state: true,
          manifest: {
            select: { status: true, items: { select: { productId: true, takenCases: true, takenJars: true } } },
          },
        },
      }),
      prisma.product.findMany({
        where: { isActive: true },
        orderBy: [{ category: { name: 'asc' } }, { name: 'asc' }],
        select: { id: true, name: true, sku: true, barcode: true, unitsPerCase: true, category: { select: { name: true } } },
      }),
    ])

    const shows: CheckoutShow[] = events.map((event) => ({
      id: event.id,
      title: event.title,
      startDate: event.startDate.toISOString(),
      location: [event.venue ?? event.location, [event.city, event.state].filter(Boolean).join(', ')]
        .filter(Boolean)
        .join(' · '),
      manifest: event.manifest,
    }))
    const products: CheckoutProduct[] = rows.map(({ category, ...product }) => ({
      ...product,
      category: category?.name ?? 'Other',
    }))

    return NextResponse.json(
      { shows, products, codesHtml: showCheckoutCodesHtml() },
      { headers: { 'Cache-Control': 'no-store' } },
    )
  } catch (error) {
    console.error('[admin-desktop] show checkout load failed:', error)
    return NextResponse.json({ error: 'Could not load shows and products' }, { status: 500 })
  }
}

const isoDate = z.string().regex(/^\d{4}-\d{2}-\d{2}$/, 'Dates are yyyy-mm-dd')

const Checkout = z.object({
  eventId: z.string().min(1, 'Pick the show'),
  checkedOutBy: z.string().trim().min(1, 'Enter your name').max(80),
  checkoutDate: isoDate,
  cases: z
    .array(z.object({ productId: z.string().min(1), half: z.boolean(), date: isoDate }))
    .min(1, 'Scan at least one case')
    .max(2000),
})

export async function POST(request: NextRequest) {
  const auth = await staffWith('events:write')
  if (auth.error) return auth.error

  const parsed = Checkout.safeParse(await request.json().catch(() => null))
  if (!parsed.success) {
    return NextResponse.json({ error: parsed.error.issues[0]?.message ?? 'That checkout is not valid' }, { status: 400 })
  }
  const input = parsed.data

  try {
    const [event, rows] = await Promise.all([
      prisma.featuredEvent.findUnique({
        where: { id: input.eventId },
        select: { id: true, title: true, manifest: { include: { items: true } } },
      }),
      prisma.product.findMany({
        where: { id: { in: [...new Set(input.cases.map((entry) => entry.productId))] } },
        select: { id: true, name: true, sku: true, barcode: true, unitsPerCase: true },
      }),
    ])
    if (!event) return NextResponse.json({ error: 'That show no longer exists' }, { status: 404 })
    if (event.manifest?.status === 'RETURNED') {
      return NextResponse.json(
        { error: `${event.title} is already marked Returned. Reopen its manifest before checking more salsa out.` },
        { status: 409 },
      )
    }
    if (rows.length !== new Set(input.cases.map((entry) => entry.productId)).size) {
      return NextResponse.json({ error: 'A scanned product no longer exists. Reload and scan again.' }, { status: 400 })
    }

    const products = rows.map((row) => ({ ...row, category: '' }))
    const lines = checkoutLines(
      products,
      input.cases.map((entry, index) => ({ ...entry, seq: index + 1 })),
    )
    const names = new Map(rows.map((row) => [row.id, row.name]))
    const perCase = new Map(rows.map((row) => [row.id, row.unitsPerCase]))
    const note = checkoutNote(input.checkedOutBy, input.checkoutDate, lines, names)

    // A draft manifest is the plan: the first checkout replaces it.
    const adding = event.manifest?.status === 'PACKED'
    const existing = new Map((adding ? event.manifest?.items ?? [] : []).map((item) => [item.productId, item]))

    const manifest = await prisma.$transaction(async (tx) => {
      const notes = [event.manifest?.notes, note].filter(Boolean).join('\n')
      const saved = await tx.eventManifest.upsert({
        where: { eventId: event.id },
        create: { eventId: event.id, status: 'PACKED', packedAt: new Date(), notes },
        update: { status: 'PACKED', packedAt: event.manifest?.packedAt ?? new Date(), notes },
      })
      if (!adding) await tx.eventManifestItem.deleteMany({ where: { manifestId: saved.id } })

      for (const line of lines) {
        const merged = mergeTaken(existing.get(line.productId), line, perCase.get(line.productId) ?? 12)
        await tx.eventManifestItem.upsert({
          where: { manifestId_productId: { manifestId: saved.id, productId: line.productId } },
          create: { manifestId: saved.id, productId: line.productId, ...merged },
          update: merged,
        })
      }
      return saved
    })

    const cases = input.cases.reduce((sum, entry) => sum + (entry.half ? 0.5 : 1), 0)
    await logAudit({
      userId: auth.user.id,
      action: 'events.show-checkout',
      entityType: 'eventManifest',
      entityId: manifest.id,
      changes: { eventId: event.id, checkedOutBy: input.checkedOutBy, cases, products: lines.length, added: adding },
    })

    return NextResponse.json({
      message: `${cases} ${cases === 1 ? 'case' : 'cases'} checked out for ${event.title}`,
      manifestId: manifest.id,
    })
  } catch (error) {
    console.error('[admin-desktop] show checkout save failed:', error)
    return NextResponse.json({ error: 'The checkout could not be saved. Nothing was changed; try again.' }, { status: 500 })
  }
}
