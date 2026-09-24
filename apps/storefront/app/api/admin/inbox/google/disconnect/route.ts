import { NextRequest } from 'next/server'

import { prisma } from '@/lib/prisma'
import { requirePermission } from '@/lib/rbac'
import { ok, failFromError } from '@/lib/api'
import { logAuditWithRequest } from '@/lib/audit'

/**
 * POST /api/admin/inbox/google/disconnect
 *
 * Drops the stored grant. The triaged emails are kept — they are the record of what was
 * said to customers, and deleting them because a mailbox was disconnected would destroy
 * the audit trail along with the credential.
 */

export async function POST(request: NextRequest) {
  try {
    const user = await requirePermission('api_keys:manage')

    const connection = await prisma.gmailConnection.findFirst({ where: { isActive: true } })
    if (!connection) return ok({ disconnected: false })

    await prisma.gmailConnection.update({
      where: { id: connection.id },
      data: { isActive: false, connectionError: 'Disconnected by an operator.' },
    })

    await logAuditWithRequest(
      {
        userId: user.id,
        action: 'GMAIL_DISCONNECTED',
        entityType: 'GmailConnection',
        entityId: connection.id,
        changes: { mailbox: connection.mailbox },
      },
      request,
    )

    return ok({ disconnected: true })
  } catch (error) {
    return failFromError(error, 'Could not disconnect Gmail')
  }
}
