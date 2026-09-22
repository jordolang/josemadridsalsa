import { NextResponse } from 'next/server'

import { isAuthorizedCronRequest } from '@/lib/cron/auth'
import { getGmailConnection } from '@/lib/inbox/gmail'
import { sweepMailbox } from '@/lib/inbox/triage'
import { notifyOperators } from '@/lib/notifications/dispatch'

/**
 * GET /api/cron/inbox-triage
 *
 * Reads the connected mailbox, classifies what is new, answers what it safely can, and
 * raises an alert for everything else.
 *
 * Idempotent through the unique `gmailMessageId`: a message already triaged is skipped, so
 * a retried or overlapping run cannot answer a customer twice.
 */

export const dynamic = 'force-dynamic'
export const maxDuration = 300

export async function GET(request: Request) {
  if (!isAuthorizedCronRequest(request)) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  const connection = await getGmailConnection()
  if (!connection) {
    // Not an error: the feature is simply not set up yet.
    return NextResponse.json({ skipped: 'No Gmail mailbox is connected.' })
  }

  try {
    const result = await sweepMailbox(connection)
    return NextResponse.json({ mailbox: connection.mailbox, ...result })
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Unknown error'
    console.error('[inbox] Sweep failed:', error)

    // A mailbox that has stopped being read is invisible by nature — nothing arrives to
    // tell anyone. It has to announce its own silence.
    await notifyOperators({
      type: 'INTEGRATION_FAILED',
      severity: 'CRITICAL',
      title: 'Customer email triage has stopped',
      message: `The sweep over ${connection.mailbox} failed: ${message}. Customer email is not being read or answered until this is fixed.`,
      entityType: 'GmailConnection',
      entityId: connection.id,
      link: '/admin/inbox/settings',
      dedupeKey: `integration-failed:gmail-triage`,
    })

    return NextResponse.json({ error: message }, { status: 500 })
  }
}
