import { NextRequest } from 'next/server'
import { prisma } from '@/lib/prisma'
import { requirePermission } from '@/lib/rbac'
import { ok, fail } from '@/lib/api'
import { logAudit } from '@/lib/audit'
import { soldUnits } from '@/lib/events/manifest-calc'
import {
  ShowFinancialsInputSchema,
  computeShowFinancials,
  estimateManifestRevenue,
} from '@/lib/events/show-financials'

const num = (v: unknown): number | null => (v === null || v === undefined ? null : Number(v))

/**
 * The estimated retail value of what the manifest says sold, and the unit count behind it.
 *
 * Read once here so both the GET response and its cross-check share a single definition of "sold"
 * — units taken minus units returned, priced at the catalogue price.
 */
async function manifestSummary(eventId: string): Promise<{ unitsSold: number; estimatedRevenue: number }> {
  const manifest = await prisma.eventManifest.findUnique({
    where: { eventId },
    include: { items: { include: { product: { select: { price: true, unitsPerCase: true } } } } },
  })

  if (!manifest) return { unitsSold: 0, estimatedRevenue: 0 }

  let unitsSold = 0
  const lines = manifest.items.map((i) => {
    const sold = soldUnits({
      takenCases: i.takenCases,
      takenJars: i.takenJars,
      returnedCases: i.returnedCases,
      returnedJars: i.returnedJars,
      unitsPerCase: i.product.unitsPerCase,
    })
    unitsSold += sold
    return { soldUnits: sold, unitPrice: i.product.price ? Number(i.product.price) : null }
  })

  return { unitsSold, estimatedRevenue: estimateManifestRevenue(lines) }
}

/**
 * GET /api/admin/events/[id]/financials
 *
 * The show's entered financials, the break-even they compute to, and — as a cross-check, not a
 * substitute — the estimated retail value of the units its manifest says sold.
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
      select: {
        id: true,
        title: true,
        startDate: true,
        boothFee: true,
        costOfFuel: true,
        lodging: true,
        meals: true,
        otherExpenses: true,
        otherExpensesNote: true,
        cashSales: true,
        cardSales: true,
      },
    })
    if (!event) {
      return fail('Event not found', 404)
    }

    const financials = {
      boothFee: num(event.boothFee),
      costOfFuel: num(event.costOfFuel),
      lodging: num(event.lodging),
      meals: num(event.meals),
      otherExpenses: num(event.otherExpenses),
      otherExpensesNote: event.otherExpensesNote ?? null,
      cashSales: num(event.cashSales),
      cardSales: num(event.cardSales),
    }

    return ok({
      event: { id: event.id, title: event.title, startDate: event.startDate },
      financials,
      summary: computeShowFinancials(financials),
      manifest: await manifestSummary(id),
    })
  } catch (error: any) {
    console.error('[GET /api/admin/events/[id]/financials] Error:', error)
    return fail(error.message || 'Failed to fetch show financials', 500)
  }
}

/**
 * PUT /api/admin/events/[id]/financials
 *
 * Save the hand-entered costs and sales. Only the financial columns are touched — the manifest,
 * staff, and booking fields are owned by their own endpoints.
 */
export async function PUT(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const user = await requirePermission('events:write')
    const { id } = await params

    const event = await prisma.featuredEvent.findUnique({ where: { id }, select: { id: true } })
    if (!event) {
      return fail('Event not found', 404)
    }

    const parsed = ShowFinancialsInputSchema.safeParse(await req.json())
    if (!parsed.success) {
      return fail(parsed.error.issues[0]?.message || 'Invalid financials', 400)
    }
    const data = parsed.data

    const updated = await prisma.featuredEvent.update({
      where: { id },
      data: {
        boothFee: data.boothFee ?? null,
        costOfFuel: data.costOfFuel ?? null,
        lodging: data.lodging ?? null,
        meals: data.meals ?? null,
        otherExpenses: data.otherExpenses ?? null,
        otherExpensesNote: data.otherExpensesNote?.trim() || null,
        cashSales: data.cashSales ?? null,
        cardSales: data.cardSales ?? null,
      },
      select: {
        boothFee: true,
        costOfFuel: true,
        lodging: true,
        meals: true,
        otherExpenses: true,
        otherExpensesNote: true,
        cashSales: true,
        cardSales: true,
      },
    })

    const financials = {
      boothFee: num(updated.boothFee),
      costOfFuel: num(updated.costOfFuel),
      lodging: num(updated.lodging),
      meals: num(updated.meals),
      otherExpenses: num(updated.otherExpenses),
      otherExpensesNote: updated.otherExpensesNote ?? null,
      cashSales: num(updated.cashSales),
      cardSales: num(updated.cardSales),
    }

    const summary = computeShowFinancials(financials)

    await logAudit({
      userId: user.id,
      action: 'events.financials-save',
      entityType: 'featuredEvent',
      entityId: id,
      changes: { totalExpenses: summary.totalExpenses, totalSales: summary.totalSales },
    })

    return ok({ financials, summary, manifest: await manifestSummary(id) })
  } catch (error: any) {
    console.error('[PUT /api/admin/events/[id]/financials] Error:', error)
    return fail(error.message || 'Failed to save show financials', 500)
  }
}
