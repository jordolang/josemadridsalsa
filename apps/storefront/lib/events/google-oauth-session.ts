/**
 * The short-lived cookie that carries OAuth state across the round trip to
 * Google. Mirrors `lib/social/oauth.ts`, but keeps its own cookie so starting a
 * calendar connection cannot clobber a social connection in progress.
 */

const MAX_AGE_SECONDS = 10 * 60

export const GOOGLE_CALENDAR_OAUTH_COOKIE = 'google_calendar_oauth'

export interface GoogleOAuthSession {
  state: string
  /** Which calendar the grant is for, chosen before leaving for Google. */
  calendarId: string
  userId: string
  createdAt: number
}

export function serializeGoogleOAuthSession(session: GoogleOAuthSession): string {
  return JSON.stringify(session)
}

/** Null for anything malformed or older than the window — both mean "reject". */
export function parseGoogleOAuthSession(raw: string | undefined): GoogleOAuthSession | null {
  if (!raw) return null

  try {
    const parsed = JSON.parse(raw) as Partial<GoogleOAuthSession>

    if (
      typeof parsed.state !== 'string' ||
      typeof parsed.calendarId !== 'string' ||
      typeof parsed.userId !== 'string' ||
      typeof parsed.createdAt !== 'number'
    ) {
      return null
    }

    if (Date.now() - parsed.createdAt > MAX_AGE_SECONDS * 1000) return null

    return parsed as GoogleOAuthSession
  } catch {
    return null
  }
}

export function googleOAuthCookieOptions() {
  return {
    httpOnly: true,
    sameSite: 'lax' as const,
    secure: process.env.NODE_ENV === 'production',
    path: '/',
    maxAge: MAX_AGE_SECONDS,
  }
}
