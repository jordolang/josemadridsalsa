import { NextRequest } from 'next/server'

import { prisma } from '@/lib/prisma'
import { requirePermission } from '@/lib/rbac'
import { ok, fail, failFromError } from '@/lib/api'
import { logAudit } from '@/lib/audit'
import { CATEGORY_DIRECTION, ManualLedgerEntrySchema, dollarsToCents } from '@/lib/financials/ledger'
import { buildLedgerWhere } from '@/lib/financials/ledger-filters'

const PAGE_SIZE = 100

/**
 * GET /api/admin/financials/ledger
 * A page of entries plus totals (income, expense, net) over the whole filtered set.
 */
export async function GET(req: NextRequest) {
  try {
    await requirePermission('financials:read')
    const params = req.nextUrl.searchParams
    const where = buildLedgerWhere(params)
    const parsedPage = Number.parseInt(params.get('page') ?? '1', 10)
    const page = Number.isFinite(parsedPage) && parsedPage > 0 ? parsedPage : 1

    const [entries, totalCount, byDirection] = await Promise.all([
      prisma.ledgerEntry.findMany({
        where,
        orderBy: [{ date: 'desc' }, { createdAt: 'desc' }],
        skip: (page - 1) * PAGE_SIZE,
        take: PAGE_SIZE,
      }),
      prisma.ledgerEntry.count({ where }),
      prisma.ledgerEntry.groupBy({ by: ['direction'], where, _sum: { amountCents: true } }),
    ])

    const incomeCents = byDirection.find((g) => g.direction === 'INCOME')?._sum.amountCents ?? 0
    const expenseCents = byDirection.find((g) => g.direction === 'EXPENSE')?._sum.amountCents ?? 0

    return ok({
      entries,
      page,
      pageSize: PAGE_SIZE,
      totalCount,
      summary: { incomeCents, expenseCents, netCents: incomeCents - expenseCents },
    })
  } catch (error: any) {
    console.error('[GET /api/admin/financials/ledger] Error:', error)
    return failFromError(error, 'Failed to load ledger')
  }
}

/**
 * POST /api/admin/financials/ledger
 * Add a hand-entered ledger row. Direction is derived from the category; money is entered in
 * dollars and stored as cents. Manual rows carry no dedupe key, so the backfill never touches them.
 */
export async function POST(req: NextRequest) {
  try {
    const user = await requirePermission('financials:write')

    const parsed = ManualLedgerEntrySchema.safeParse(await req.json())
    if (!parsed.success) {
      return fail(parsed.error.issues[0]?.message || 'Invalid entry', 400)
    }
    const input = parsed.data

    const entry = await prisma.ledgerEntry.create({
      data: {
        date: new Date(input.date),
        direction: CATEGORY_DIRECTION[input.category],
        amountCents: dollarsToCents(input.amountDollars),
        category: input.category,
        source: 'MANUAL',
        description: input.description,
        counterparty: input.counterparty?.trim() || null,
        paymentMethod: input.paymentMethod?.trim() || null,
        memo: input.memo?.trim() || null,
        isManual: true,
        enteredById: user.id,
      },
    })

    await logAudit({
      userId: user.id,
      action: 'financials.ledger-create',
      entityType: 'ledgerEntry',
      entityId: entry.id,
      changes: { category: entry.category, amountCents: entry.amountCents },
    })

    return ok({ entry })
  } catch (error: any) {
    console.error('[POST /api/admin/financials/ledger] Error:', error)
    return failFromError(error, 'Failed to create entry')
  }
}
