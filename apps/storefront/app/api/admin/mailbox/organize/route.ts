import { NextRequest } from 'next/server'

import { ok, failFromError } from '@/lib/api'
import { logAuditWithRequest } from '@/lib/audit'
import { organizeInbox } from '@/lib/inbox/organizer'
import { openMailbox } from '@/lib/inbox/mailbox-session'

export const dynamic = 'force-dynamic'
export const maxDuration = 300

/** POST /api/admin/mailbox/organize — run the 8/12/5 inbox filing now. */
export async function POST(req: NextRequest) {
  try {
    const { user, connection } = await openMailbox()
    const result = await organizeInbox(connection)
    await logAuditWithRequest(
      {
        userId: user.id,
        action: 'MAILBOX_ORGANIZED',
        entityType: 'GmailConnection',
        entityId: connection.id,
        changes: { filed: result.filed, scanned: result.scanned },
      },
      req,
    )
    return ok(result)
  } catch (error) {
    return failFromError(error, 'Could not organize the inbox')
  }
}
