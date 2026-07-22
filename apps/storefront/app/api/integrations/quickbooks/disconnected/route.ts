import { NextResponse } from 'next/server'
import { getAppBaseUrl } from '@/lib/quickbooks/config'
import { getConnection, disconnect } from '@/lib/quickbooks/connection'

/**
 * GET /api/integrations/quickbooks/disconnected
 *
 * Registered with Intuit as the app's Disconnect URL: where a user lands after
 * disconnecting us from inside QuickBooks (My Apps -> Disconnect). Without it
 * our row stays active after a QBO-side disconnect and the hourly sync keeps
 * failing on a revoked token until somebody notices.
 *
 * Intuit sends the browser here, so this must not be a destructive endpoint any
 * passer-by can trigger. It only deactivates when the realmId Intuit passes
 * matches the connection we actually hold; otherwise it just lands the admin on
 * the integrations page, where they can disconnect by hand.
 */
export async function GET(request: Request) {
  const { searchParams } = new URL(request.url)
  const realmId = searchParams.get('realmId')

  let outcome: 'disconnected' | 'unverified' = 'unverified'

  if (realmId) {
    const connection = await getConnection()
    if (connection?.realmId === realmId) {
      await disconnect()
      outcome = 'disconnected'
    }
  }

  return NextResponse.redirect(
    `${getAppBaseUrl()}/admin/settings/integrations?quickbooks=${outcome}`
  )
}
