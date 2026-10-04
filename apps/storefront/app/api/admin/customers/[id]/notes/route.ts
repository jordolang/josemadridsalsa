import { NextRequest } from 'next/server'
import { z } from 'zod'
import prisma from '@/lib/prisma'
import { requirePermission } from '@/lib/rbac'
import { ok, fail } from '@/lib/api'

/**
 * POST /api/admin/customers/[id]/notes
 *
 * Adds a dated note to a customer's account timeline. Notes are append-only from the
 * admin's side: a wrong one is deleted and rewritten, so the timeline never changes under
 * someone who already read it.
 */

const noteSchema = z.object({
  body: z.string().trim().min(1, 'Write something first').max(10000),
})

export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const user = await requirePermission('users:write')
    const { id } = await params

    const parsed = noteSchema.safeParse(await req.json().catch(() => null))
    if (!parsed.success) {
      return fail('Invalid note', 400, parsed.error.flatten())
    }

    const customer = await prisma.customer.findUnique({ where: { id }, select: { id: true } })
    if (!customer) return fail('Customer not found', 404)

    const note = await prisma.customerNote.create({
      data: {
        customerId: id,
        body: parsed.data.body,
        authorId: user.id,
        authorName: user.name ?? user.email ?? null,
      },
    })

    return ok({ note }, 201)
  } catch (error: any) {
    console.error('[POST /api/admin/customers/[id]/notes] Error:', error)
    return fail(error.message || 'Failed to add note', error.status ?? 500)
  }
}
