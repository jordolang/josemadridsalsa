import { NextResponse } from 'next/server'
import { createOAuthState } from '@/lib/social/oauth'
import { requirePermission } from '@/lib/rbac'
import { failFromError } from '@/lib/api'
import { buildAuthUrl } from '@/lib/events/google-calendar-client'
import {
  GOOGLE_CALENDAR_OAUTH_COOKIE,
  googleOAuthCookieOptions,
  serializeGoogleOAuthSession,
} from '@/lib/events/google-oauth-session'

/**
 * GET /api/admin/events/google/connect
 *
 * Starts the OAuth grant. Returns the URL rather than redirecting so the admin
 * panel can surface a configuration error inline instead of bouncing the user
 * to a Google page that will only fail.
 */
export async function GET(request: Request) {
  try {
    const user = await requirePermission('events:sync-calendar')

    const calendarId =
      new URL(request.url).searchParams.get('calendarId')?.trim() ||
      process.env.GOOGLE_CALENDAR_ID?.trim()

    if (!calendarId) {
      return NextResponse.json(
        {
          error:
            'No calendar to connect. Set GOOGLE_CALENDAR_ID, or pass ?calendarId= with the calendar to sync.',
        },
        { status: 400 }
      )
    }

    const state = createOAuthState()
    const url = await buildAuthUrl(state)

    const response = NextResponse.json({ url })
    response.cookies.set(
      GOOGLE_CALENDAR_OAUTH_COOKIE,
      serializeGoogleOAuthSession({
        state,
        calendarId,
        userId: user.id,
        createdAt: Date.now(),
      }),
      googleOAuthCookieOptions()
    )
    return response
  } catch (error) {
    return failFromError(error, 'Failed to start the Google Calendar connection')
  }
}
