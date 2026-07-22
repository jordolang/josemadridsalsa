import { NextResponse } from 'next/server'
import { getCurrentUser, hasPermission } from '@/lib/rbac'
import {
  getAppBaseUrl,
  getQuickBooksAppCredentials,
  getDefaultEnvironment,
  type QuickBooksEnvironment,
} from '@/lib/quickbooks/config'
import {
  createOAuthState,
  getAuthorizationUrl,
  getOAuthCookieOptions,
  QUICKBOOKS_OAUTH_COOKIE_NAME,
  serializeOAuthSession,
} from '@/lib/quickbooks/oauth'

/**
 * Start the QuickBooks Online OAuth flow. Redirects the admin straight to
 * Intuit's consent screen, stashing a signed state + environment in a
 * short-lived cookie for the callback to validate.
 */
export async function GET(request: Request) {
  // This is registered with Intuit as the Connect/Reconnect URL, so it can be
  // reached by someone arriving cold from QuickBooks. Bounce them to the
  // integrations page (which handles sign-in) rather than dead-ending on JSON.
  const user = await getCurrentUser()
  if (!user || !(await hasPermission(user, 'api_keys:manage'))) {
    return NextResponse.redirect(`${getAppBaseUrl()}/admin/settings/integrations`)
  }

  const { searchParams } = new URL(request.url)
  const requested = searchParams.get('environment')
  const environment: QuickBooksEnvironment =
    requested === 'production' || requested === 'sandbox'
      ? requested
      : getDefaultEnvironment()

  const creds = await getQuickBooksAppCredentials(environment)
  if (!creds) {
    return NextResponse.json(
      {
        error:
          'QuickBooks is not configured. Add your Client ID and Secret on the Integrations page first.',
      },
      { status: 400 },
    )
  }

  const state = createOAuthState()
  const authUrl = getAuthorizationUrl({ clientId: creds.clientId, state })

  const response = NextResponse.redirect(authUrl)
  response.cookies.set(
    QUICKBOOKS_OAUTH_COOKIE_NAME,
    serializeOAuthSession({ state, environment, userId: user.id, createdAt: Date.now() }),
    getOAuthCookieOptions(),
  )
  return response
}
