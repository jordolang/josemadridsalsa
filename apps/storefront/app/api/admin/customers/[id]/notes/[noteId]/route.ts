import { NextRequest } from 'next/server'
import prisma from '@/lib/prisma'
import { requirePermission } from '@/lib/rbac'
import { ok, fail } from '@/lib/api'
import { logAudit } from '@/lib/audit'

/** DELETE /api/admin/customers/[id]/notes/[noteId] — remove one note from the account. */
export async function DELETE(
  _req: NextRequest,
  { params }: { params: Promise<{ id: string; noteId: string }> }
) {
  try {
    const user = await requirePermission('users:write')
    const { id, noteId } = await params

    // Scoped to the customer in the URL, so a note id from another account cannot be removed here.
    const { count } = await prisma.customerNote.deleteMany({ where: { id: noteId, customerId: id } })
    if (count === 0) return fail('Note not found', 404)

    await logAudit({
      userId: user.id,
      action: 'customers.note.delete',
      entityType: 'customer',
      entityId: id,
      changes: { noteId },
    })

    return ok({ deleted: true })
  } catch (error: any) {
    console.error('[DELETE /api/admin/customers/[id]/notes/[noteId]] Error:', error)
    return fail(error.message || 'Failed to delete note', error.status ?? 500)
  }
}
