import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { requirePermission } from '@/lib/rbac'
import { encryptSecret } from '@/lib/crypto'
import { logAudit } from '@/lib/audit'
import {
  CALENDAR_SCOPES,
  exchangeCodeForTokens,
  fetchGoogleEmail,
} from '@/lib/events/google-calendar-client'
import {
  GOOGLE_CALENDAR_OAUTH_COOKIE,
  parseGoogleOAuthSession,
} from '@/lib/events/google-oauth-session'

/**
 * GET /api/admin/events/google/callback
 *
 * Where Google returns after consent. Always ends in a redirect back to the
 * Events page — this is a browser navigation, so an error belongs in the URL
 * where the page can show it, not in a JSON body the user would see raw.
 */

/**
 * Resolved against the incoming request rather than NEXTAUTH_URL: `redirect`
 * requires an absolute URL, and an unset env var would otherwise turn every
 * outcome — including the error path — into a 500.
 */
const settled = (request: NextRequest, params: Record<string, string>) => {
  const target = new URL('/admin/events', request.nextUrl.origin)
  for (const [key, value] of Object.entries(params)) {
    target.searchParams.set(key, value)
  }
  return NextResponse.redirect(target)
}

export async function GET(request: NextRequest) {
  try {
    const user = await requirePermission('events:sync-calendar')

    const { searchParams } = new URL(request.url)
    const code = searchParams.get('code')
    const state = searchParams.get('state')
    const denied = searchParams.get('error')

    const session = parseGoogleOAuthSession(
      request.cookies.get(GOOGLE_CALENDAR_OAUTH_COOKIE)?.value
    )

    if (denied) {
      return settled(request, { googleCalendar: 'error', message: 'Access was not granted.' })
    }
    if (!session) {
      return settled(request, {
        googleCalendar: 'error',
        message: 'The connection attempt expired. Start it again.',
      })
    }
    // Constant-time comparison is unnecessary here: the state is single-use,
    // expires in ten minutes, and a mismatch reveals nothing about the secret.
    if (!code || !state || state !== session.state) {
      return settled(request, { googleCalendar: 'error', message: 'The connection could not be verified.' })
    }
    if (session.userId !== user.id) {
      return settled(request, {
        googleCalendar: 'error',
        message: 'This connection was started by a different user.',
      })
    }

    const tokens = await exchangeCodeForTokens(code)

    if (!tokens.refreshToken) {
      // Without one the link dies in an hour and cannot be renewed. Google
      // withholds it when the account has already granted these scopes and
      // `prompt=consent` did not take effect.
      return settled(request, {
        googleCalendar: 'error',
        message:
          'Google did not return a refresh token. Remove this app under your Google account permissions, then connect again.',
      })
    }

    const missing = CALENDAR_SCOPES.filter(
      (scope) => scope.startsWith('https://') && !tokens.scopes.includes(scope)
    )
    if (missing.length > 0) {
      return settled(request, {
        googleCalendar: 'error',
        message: `Calendar permission was not granted (${missing.join(', ')}).`,
      })
    }

    const email = await fetchGoogleEmail(tokens.accessToken)
    const access = encryptSecret(tokens.accessToken)
    const refresh = encryptSecret(tokens.refreshToken)

    const stored = {
      googleEmail: email,
      accessToken: access.encryptedValue,
      accessTokenIv: access.iv,
      refreshToken: refresh.encryptedValue,
      refreshTokenIv: refresh.iv,
      tokenExpiresAt: tokens.expiresAt,
      scopes: tokens.scopes,
      isActive: true,
      connectionError: null,
      connectedById: user.id,
    }

    await prisma.googleCalendarConnection.upsert({
      where: { calendarId: session.calendarId },
      create: { calendarId: session.calendarId, ...stored },
      update: stored,
    })

    await logAudit({
      userId: user.id,
      action: 'connect',
      entityType: 'google_calendar_connection',
      entityId: session.calendarId,
      changes: { googleEmail: email, scopes: tokens.scopes },
    })

    const response = settled(request, { googleCalendar: 'connected' })
    response.cookies.delete(GOOGLE_CALENDAR_OAUTH_COOKIE)
    return response
  } catch (error) {
    const message = error instanceof Error ? error.message : 'The connection failed.'
    return settled(request, { googleCalendar: 'error', message })
  }
}
