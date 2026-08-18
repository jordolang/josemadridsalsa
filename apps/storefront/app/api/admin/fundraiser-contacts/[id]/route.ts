import { NextRequest } from 'next/server'
import { z } from 'zod'

import prisma from '@/lib/prisma'
import { requirePermission } from '@/lib/rbac'
import { ok, fail } from '@/lib/api'
import { logAudit } from '@/lib/audit'
import { normalizeEmail, normalizePhone } from '@/lib/fundraising/contact-consolidate'

/**
 * PATCH /api/admin/fundraiser-contacts/[id]
 *
 * Edits one fundraiser contact, including the active toggle.
 *
 * Deliberately not editable here:
 *   - `totalJars`, `totalOrders`, `campaignCount`, `years` and the source files are recomputed
 *     from the archive by `scripts/build-fundraiser-contacts.ts`, so a hand edit would be
 *     silently reverted on the next run.
 *   - `dedupeKey` is the re-import identity. Changing it would fork a duplicate on that run.
 *   - `lastSolicitedAt` / `solicitationCount` are written by the send path and are the record
 *     of what actually went out.
 */

const nullableText = z
  .string()
  .trim()
  .max(500)
  .nullable()
  .optional()
  // An emptied form field means "clear this", not "leave it alone".
  .transform((v) => (v === '' ? null : v))

const contactPatchSchema = z.object({
  organizationName: z.string().trim().min(1).max(300).optional(),
  contactName: nullableText,
  email: nullableText,
  phone: nullableText,
  isActive: z.boolean().optional(),
  status: z.enum(['NEW', 'CONTACTED', 'RESPONDED', 'CONVERTED', 'DO_NOT_CONTACT']).optional(),
  notes: z
    .string()
    .trim()
    .max(10000)
    .nullable()
    .optional()
    .transform((v) => (v === '' ? null : v)),
})

export async function PATCH(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const user = await requirePermission('users:write')
    const { id } = await params

    const parsed = contactPatchSchema.safeParse(await req.json())
    if (!parsed.success) {
      return fail('Invalid contact update', 400, parsed.error.flatten())
    }

    const existing = await prisma.fundraiserContact.findUnique({ where: { id } })
    if (!existing) return fail('Contact not found', 404)

    const data = { ...parsed.data }

    // Run typed-in contact details through the same normalizers the import uses, so a hand
    // edit and an archive value are stored in one comparable shape.
    if (data.email !== undefined && data.email !== null) {
      const email = normalizeEmail(data.email)
      if (!email) return fail('That email address is not valid', 400)
      data.email = email
    }
    if (data.phone !== undefined && data.phone !== null) {
      const phone = normalizePhone(data.phone)
      if (!phone) return fail('That phone number is not a 10-digit US number', 400)
      data.phone = phone
    }

    const contact = await prisma.fundraiserContact.update({ where: { id }, data })

    await logAudit({
      userId: user.id,
      action: 'fundraiser_contact.update',
      entityType: 'FundraiserContact',
      entityId: id,
      changes: data,
    })

    return ok({ contact })
  } catch (error) {
    const err = error as { message?: string; status?: number }
    return fail(err.message ?? 'Failed to update contact', err.status ?? 500)
  }
}

export async function DELETE(
  _req: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  try {
    const user = await requirePermission('users:write')
    const { id } = await params

    const existing = await prisma.fundraiserContact.findUnique({
      where: { id },
      select: { organizationName: true },
    })
    if (!existing) return fail('Contact not found', 404)

    await prisma.fundraiserContact.delete({ where: { id } })

    await logAudit({
      userId: user.id,
      action: 'fundraiser_contact.delete',
      entityType: 'FundraiserContact',
      entityId: id,
      changes: { organizationName: existing.organizationName },
    })

    return ok({ deleted: true })
  } catch (error) {
    const err = error as { message?: string; status?: number }
    return fail(err.message ?? 'Failed to delete contact', err.status ?? 500)
  }
}
