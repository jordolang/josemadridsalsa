import { requirePermission } from '@/lib/rbac'
import { getGmailAccessToken, getGmailConnection } from '@/lib/inbox/gmail'

/**
 * Reading the owner's whole mailbox is the same trust as connecting it, so the desktop
 * Mail page needs the permission `/admin/inbox/settings` uses to connect Gmail.
 */
export const MAILBOX_PERMISSION = 'api_keys:manage'

export async function openMailbox() {
  const user = await requirePermission(MAILBOX_PERMISSION)
  const connection = await getGmailConnection()
  if (!connection) throw new Error('Not found - no Gmail mailbox is connected. Connect one at /admin/inbox/settings.')
  const accessToken = await getGmailAccessToken(connection)
  return { user, connection, accessToken }
}
