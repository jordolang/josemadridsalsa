import { NextResponse } from 'next/server'

import { isAuthorizedCronRequest } from '@/lib/cron/auth'
import { getGmailConnection } from '@/lib/inbox/gmail'
import { isOrganizeHour, organizeInbox } from '@/lib/inbox/organizer'
import { notifyOperators } from '@/lib/notifications/dispatch'

/**
 * GET /api/cron/mail-organizer
 *
 * Files the inbox into its folders at 8am, noon and 5pm Eastern. Scheduled in UTC at both
 * the daylight and standard-time hour of each slot; `isOrganizeHour` drops the wrong one.
 */

export const dynamic = 'force-dynamic'
export const maxDuration = 300

export async function GET(request: Request) {
  if (!isAuthorizedCronRequest(request)) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }
  if (!isOrganizeHour(new Date())) {
    return NextResponse.json({ skipped: 'Not an organizing hour in Eastern time.' })
  }

  const connection = await getGmailConnection()
  if (!connection) return NextResponse.json({ skipped: 'No Gmail mailbox is connected.' })

  try {
    const result = await organizeInbox(connection)
    if (result.errors.length > 0) {
      await notifyOperators({
        type: 'INTEGRATION_FAILED',
        severity: 'WARNING',
        title: 'Inbox organizing partly failed',
        message: `${result.errors.length} of ${result.scanned} conversations in ${connection.mailbox} could not be filed (first: ${result.errors[0]}). They stay in the inbox until the next run.`,
        entityType: 'GmailConnection',
        entityId: connection.id,
        link: '/admin/inbox/settings',
        dedupeKey: 'integration-failed:mail-organizer',
      })
    }
    return NextResponse.json({ mailbox: connection.mailbox, ...result }, { status: result.errors.length ? 207 : 200 })
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Unknown error'
    console.error('[mail-organizer] Run failed:', error)
    await notifyOperators({
      type: 'INTEGRATION_FAILED',
      severity: 'WARNING',
      title: 'Inbox organizing failed',
      message: `Filing ${connection.mailbox} into folders failed: ${message}. The inbox is unsorted until the next run.`,
      entityType: 'GmailConnection',
      entityId: connection.id,
      link: '/admin/inbox/settings',
      dedupeKey: 'integration-failed:mail-organizer',
    })
    return NextResponse.json({ error: message }, { status: 500 })
  }
}
