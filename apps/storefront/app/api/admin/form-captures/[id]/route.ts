import { NextRequest } from 'next/server'
import { z } from 'zod'
import prisma from '@/lib/prisma'
import { requirePermission } from '@/lib/rbac'
import { ok, fail } from '@/lib/api'
import { logAudit } from '@/lib/audit'
import { reconcile } from '@/lib/form-capture/parse'
import type { ClassifiedLine } from '@/lib/form-capture/types'

/**
 * GET   /api/admin/form-captures/[id] — one form with its lines.
 * PATCH /api/admin/form-captures/[id] — a reviewer's corrections.
 *
 * Corrections never touch `rawExtraction`: what the machine read stays on the record next to what
 * the person decided it should be, so a disputed figure can always be traced.
 */

const LEDGER_CATEGORIES = [
  'PRODUCT_SALES',
  'SHIPPING_INCOME',
  'SALES_TAX_COLLECTED',
  'SHOW_SALES',
  'OTHER_INCOME',
  'COGS',
  'PROCESSOR_FEES',
  'SHIPPING_COST',
  'SHOW_EXPENSES',
  'REFUNDS',
  'DISCOUNTS',
  'BOOTH_FEE',
  'TRAVEL',
  'MEALS',
  'SUPPLIES',
  'PAYROLL',
  'OTHER_EXPENSE',
] as const

const patchSchema = z.object({
  capturedOn: z.coerce.date().nullable().optional(),
  eventId: z.string().trim().min(1).nullable().optional(),
  reviewNotes: z.string().trim().max(2000).nullable().optional(),
  lines: z
    .array(
      z.object({
        id: z.string().min(1),
        label: z.string().trim().min(1).max(200).optional(),
        direction: z.enum(['INCOME', 'EXPENSE']).optional(),
        category: z.enum(LEDGER_CATEGORIES).optional(),
        amountCents: z.number().int().min(0).max(100_000_000).optional(),
        quantity: z.number().int().min(0).max(1_000_000).nullable().optional(),
        excluded: z.boolean().optional(),
      })
    )
    .max(100)
    .optional(),
})

export async function GET(_req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    await requirePermission('financials:read')
    const { id } = await params

    const capture = await prisma.formCapture.findUnique({
      where: { id },
      include: { lines: { orderBy: { lineNumber: 'asc' } } },
    })
    if (!capture) return fail('Capture not found', 404)

    return ok({ capture })
  } catch (error: any) {
    return fail(error.message, error.status ?? 500)
  }
}

export async function PATCH(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const user = await requirePermission('financials:write')
    const { id } = await params

    const body = await req.json().catch(() => null)
    if (!body || typeof body !== 'object') return fail('Invalid request body', 400)

    const parsed = patchSchema.safeParse(body)
    if (!parsed.success) return fail('Invalid update', 400, parsed.error.flatten())

    const capture = await prisma.formCapture.findUnique({
      where: { id },
      include: { lines: true },
    })
    if (!capture) return fail('Capture not found', 404)
    if (capture.status === 'POSTED') {
      // Editing a posted capture would put the ledger and the form out of step. Correct the
      // ledger row instead.
      return fail('This form has already posted; edit the ledger entry instead.', 409)
    }

    const { lines: lineEdits, ...captureFields } = parsed.data
    const ownedLineIds = new Set(capture.lines.map((line) => line.id))

    await prisma.$transaction(async (tx) => {
      for (const edit of lineEdits ?? []) {
        // A line id from another capture must never be writable through this route.
        if (!ownedLineIds.has(edit.id)) continue
        const { id: lineId, ...fields } = edit
        if (Object.keys(fields).length === 0) continue

        await tx.formCaptureLine.update({
          where: { id: lineId },
          data: { ...fields, edited: true },
        })
      }

      if (Object.keys(captureFields).length > 0) {
        await tx.formCapture.update({ where: { id }, data: captureFields })
      }
    })

    // Re-check the arithmetic against the corrected lines so the reviewer sees the effect
    // of their edit immediately.
    const updated = await prisma.formCapture.findUniqueOrThrow({
      where: { id },
      include: { lines: { orderBy: { lineNumber: 'asc' } } },
    })
    const { reconciled, deltaCents } = reconcile(
      updated.lines.filter((line) => !line.excluded) as unknown as ClassifiedLine[],
      updated.statedTotalCents
    )
    if (reconciled !== updated.reconciled) {
      await prisma.formCapture.update({ where: { id }, data: { reconciled } })
    }

    await logAudit({
      userId: user.id,
      action: 'form_capture.update',
      entityType: 'FormCapture',
      entityId: id,
      changes: { editedLines: lineEdits?.map((line) => line.id) ?? [], ...captureFields },
    })

    return ok({ capture: { ...updated, reconciled }, deltaCents })
  } catch (error: any) {
    return fail(error.message, error.status ?? 500)
  }
}
