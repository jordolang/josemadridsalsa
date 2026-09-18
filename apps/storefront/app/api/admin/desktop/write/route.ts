import { NextResponse } from 'next/server'
import { z } from 'zod'
import { getCurrentUser, hasPermission, isStaff } from '@/lib/rbac'
import { logAuditWithRequest } from '@/lib/audit'
import { findWriteHandler, WriteError } from '@/lib/admin-desktop/writes'
import { isWriteOpId } from '@/lib/admin-desktop/forms'

/**
 * Every write the desktop admin shell makes.
 *
 * One route rather than one per entity, because the gates around a write are
 * the same regardless of what is being written: the staff check the `/admin`
 * layout makes, then the operation's own permission — the one its `/admin` page
 * checks before it will render — then validation, then an audit row. Handlers in
 * `lib/admin-desktop/writes.ts` supply the three things that differ, and get to
 * assume the rest has happened.
 *
 * The response shape is fixed so the shell has one thing to render: `ok` with a
 * message it can toast, or `error` with an optional `field` to hang under the
 * input that caused it.
 */

export const dynamic = 'force-dynamic'

const Body = z.object({
  op: z.string().refine(isWriteOpId, 'Unknown operation'),
  /** The record acted on. Absent for a create. */
  recordId: z.string().min(1).max(200).optional(),
  /** Form values. Handlers own their own schemas, so this stays unknown here. */
  values: z.unknown().optional(),
})

export async function POST(request: Request) {
  const user = await getCurrentUser()
  if (!user || !isStaff(user)) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 403 })
  }

  let payload: unknown
  try {
    payload = await request.json()
  } catch {
    return NextResponse.json({ error: 'Expected a JSON body' }, { status: 400 })
  }

  const parsed = Body.safeParse(payload)
  if (!parsed.success) {
    return NextResponse.json({ error: 'Unknown operation' }, { status: 400 })
  }

  const { op, recordId, values } = parsed.data
  const handler = findWriteHandler(op)
  if (!handler) {
    return NextResponse.json({ error: 'Unknown operation' }, { status: 400 })
  }

  if (handler.permission && !(await hasPermission(user, handler.permission))) {
    return NextResponse.json(
      { error: 'Your account does not have permission to do that.' },
      { status: 403 },
    )
  }

  if (handler.requiresRecord && !recordId) {
    return NextResponse.json({ error: 'Nothing was selected to act on.' }, { status: 400 })
  }

  try {
    const outcome = await handler.execute(values, {
      actor: { id: user.id, email: user.email },
      recordId,
    })

    await logAuditWithRequest(
      {
        userId: user.id,
        action: handler.action,
        entityType: handler.entity,
        entityId: outcome.recordId ?? recordId ?? null,
        // The values, not a diff: the shell sends the whole record, and a diff
        // would need a second read of the row it just overwrote.
        changes: { op, values: values ?? null },
      },
      request,
    )

    return NextResponse.json(
      { ok: true, message: outcome.message, recordId: outcome.recordId ?? recordId ?? null, section: outcome.section ?? null },
      { headers: { 'Cache-Control': 'no-store' } },
    )
  } catch (error) {
    if (error instanceof WriteError) {
      return NextResponse.json({ error: error.message, field: error.field ?? null }, { status: 400 })
    }

    console.error(`[admin-desktop] ${op} failed:`, error)
    return NextResponse.json({ error: 'That did not go through. Try again.' }, { status: 500 })
  }
}
