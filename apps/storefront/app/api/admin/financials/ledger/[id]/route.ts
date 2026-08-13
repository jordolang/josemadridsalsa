import { NextRequest } from 'next/server'

import { prisma } from '@/lib/prisma'
import { requirePermission } from '@/lib/rbac'
import { ok, fail, failFromError } from '@/lib/api'
import { logAudit } from '@/lib/audit'
import {
  CATEGORY_DIRECTION,
  ManualLedgerEntrySchema,
  dollarsToCents,
} from '@/lib/financials/ledger'
import { z } from 'zod'

/** A derived row (from an order, refund, or show) may only have its note edited — everything else
 * would be overwritten by the next backfill. */
const DerivedEditSchema = z.object({ memo: z.string().trim().max(1000).nullable().optional() })

/**
 * PATCH /api/admin/financials/ledger/[id]
 * Edit an entry. Manual rows are fully editable; derived rows accept only a memo.
 */
export async function PATCH(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const user = await requirePermission('financials:write')
    const { id } = await params

    const existing = await prisma.ledgerEntry.findUnique({ where: { id } })
    if (!existing) return fail('Entry not found', 404)

    const body = await req.json()

    if (!existing.isManual) {
      const parsed = DerivedEditSchema.safeParse(body)
      if (!parsed.success) return fail('Only the note can be edited on a derived entry', 400)
      const entry = await prisma.ledgerEntry.update({
        where: { id },
        data: { memo: parsed.data.memo?.trim() || null },
      })
      await logAudit({
        userId: user.id,
        action: 'financials.ledger-annotate',
        entityType: 'ledgerEntry',
        entityId: id,
        changes: { memo: entry.memo },
      })
      return ok({ entry })
    }

    const parsed = ManualLedgerEntrySchema.safeParse(body)
    if (!parsed.success) return fail(parsed.error.issues[0]?.message || 'Invalid entry', 400)
    const input = parsed.data

    const entry = await prisma.ledgerEntry.update({
      where: { id },
      data: {
        date: new Date(input.date),
        direction: CATEGORY_DIRECTION[input.category],
        amountCents: dollarsToCents(input.amountDollars),
        category: input.category,
        description: input.description,
        counterparty: input.counterparty?.trim() || null,
        paymentMethod: input.paymentMethod?.trim() || null,
        memo: input.memo?.trim() || null,
        enteredById: user.id,
      },
    })

    await logAudit({
      userId: user.id,
      action: 'financials.ledger-update',
      entityType: 'ledgerEntry',
      entityId: id,
      changes: { category: entry.category, amountCents: entry.amountCents },
    })

    return ok({ entry })
  } catch (error: any) {
    console.error('[PATCH /api/admin/financials/ledger/[id]] Error:', error)
    return failFromError(error, 'Failed to update entry')
  }
}

/**
 * DELETE /api/admin/financials/ledger/[id]
 * Delete a manual entry. Derived rows cannot be deleted — the backfill would recreate them; edit
 * the source record instead.
 */
export async function DELETE(_req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const user = await requirePermission('financials:write')
    const { id } = await params

    const existing = await prisma.ledgerEntry.findUnique({ where: { id } })
    if (!existing) return fail('Entry not found', 404)
    if (!existing.isManual) {
      return fail('Derived entries cannot be deleted; edit the order, refund, or show instead.', 400)
    }

    await prisma.ledgerEntry.delete({ where: { id } })

    await logAudit({
      userId: user.id,
      action: 'financials.ledger-delete',
      entityType: 'ledgerEntry',
      entityId: id,
      changes: { category: existing.category, amountCents: existing.amountCents },
    })

    return ok({ deleted: true })
  } catch (error: any) {
    console.error('[DELETE /api/admin/financials/ledger/[id]] Error:', error)
    return failFromError(error, 'Failed to delete entry')
  }
}
