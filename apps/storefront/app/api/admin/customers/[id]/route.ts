import { NextRequest } from 'next/server'
import { z } from 'zod'
import prisma from '@/lib/prisma'
import { requirePermission } from '@/lib/rbac'
import { ok, fail } from '@/lib/api'
import { logAudit } from '@/lib/audit'

/**
 * PATCH /api/admin/customers/[id]
 *
 * Edits one customer from the admin list.
 *
 * Deliberately not editable here:
 *   - `email` is the unique key every other system joins on (order sync,
 *     import batches, mailing-list rows). Changing it in place would silently
 *     detach the customer from its own history.
 *   - `totalOrders` / `totalSpent` / `lastOrderAt` are recomputed by
 *     `/api/admin/customers/sync` from real Order rows, so a hand edit would
 *     be overwritten on the next run.
 */

const nullableText = z
  .string()
  .trim()
  .max(500)
  .nullable()
  .optional()
  // An emptied form field means "clear this", not "leave it alone".
  .transform((v) => (v === '' ? null : v))

const customerPatchSchema = z.object({
  firstName: nullableText,
  lastName: nullableText,
  phone: nullableText,
  accountType: z.enum(['STANDARD', 'FUNDRAISING', 'WHOLESALE']).optional(),
  emailStatus: nullableText,
  emailPermissionStatus: nullableText,
  sourceName: nullableText,
  notes: z
    .string()
    .trim()
    .max(10000)
    .nullable()
    .optional()
    .transform((v) => (v === '' ? null : v)),
})

export async function GET(
  _req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    await requirePermission('users:read')
    const { id } = await params

    const customer = await prisma.customer.findUnique({ where: { id } })
    if (!customer) return fail('Customer not found', 404)

    return ok({ customer })
  } catch (error: any) {
    return fail(error.message, error.status ?? 500)
  }
}

export async function PATCH(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const user = await requirePermission('users:write')
    const { id } = await params

    const body = await req.json().catch(() => null)
    if (!body || typeof body !== 'object') {
      return fail('Invalid request body', 400)
    }

    const parsed = customerPatchSchema.safeParse(body)
    if (!parsed.success) {
      return fail('Invalid customer data', 400, parsed.error.flatten())
    }

    const existing = await prisma.customer.findUnique({ where: { id } })
    if (!existing) return fail('Customer not found', 404)

    const customer = await prisma.customer.update({
      where: { id },
      data: parsed.data,
    })

    await logAudit({
      userId: user.id,
      action: 'customers.update',
      entityType: 'customer',
      entityId: id,
      changes: parsed.data,
    })

    return ok({ customer })
  } catch (error: any) {
    console.error('[PATCH /api/admin/customers/[id]] Error:', error)
    return fail(error.message || 'Failed to update customer', error.status ?? 500)
  }
}
