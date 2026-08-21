/**
 * Google Calendar v3 access for the two-way event sync.
 *
 * Distinct from `lib/google-calendar.ts`, which reads the *public* feed with an
 * API key and cannot write. Writing needs a user-granted OAuth token, so this
 * module owns the connection row, the refresh dance, and the four calls the
 * reconciler makes.
 */

import { prisma } from '@/lib/prisma'
import { decryptSecret, encryptSecret } from '@/lib/crypto'
import { getProviderCredentials } from '@/lib/social/credentials'
import type { GoogleCalendarConnection } from '@prisma/client'
import type { GoogleEventBody, GoogleEventResource } from './google-event-mapping'

const AUTH_ENDPOINT = 'https://accounts.google.com/o/oauth2/v2/auth'
const TOKEN_ENDPOINT = 'https://oauth2.googleapis.com/token'
const CALENDAR_BASE = 'https://www.googleapis.com/calendar/v3'
const USERINFO_ENDPOINT = 'https://openidconnect.googleapis.com/v1/userinfo'

/**
 * `calendar.events` rather than the broader `calendar`: the sync creates,
 * edits and deletes events on one existing calendar and never needs to manage
 * calendars themselves or read anyone's ACLs.
 */
export const CALENDAR_SCOPES = [
  'https://www.googleapis.com/auth/calendar.events',
  'openid',
  'email',
]

/** Refresh a token this long before it actually expires. */
const REFRESH_SKEW_MS = 60_000

export class GoogleCalendarNotConnectedError extends Error {
  constructor(message = 'Google Calendar is not connected.') {
    super(message)
    this.name = 'GoogleCalendarNotConnectedError'
  }
}

export function googleRedirectUri(): string {
  const base =
    process.env.NEXTAUTH_URL?.replace(/\/$/, '') || 'http://localhost:3000'
  return `${base}/api/admin/events/google/callback`
}

export async function buildAuthUrl(state: string): Promise<string> {
  const creds = await getProviderCredentials('google')
  if (!creds) {
    throw new Error(
      'Google is not configured. Set GOOGLE_CLIENT_ID and GOOGLE_CLIENT_SECRET, or add them under Social → Accounts.'
    )
  }

  const params = new URLSearchParams({
    client_id: creds.clientId,
    redirect_uri: googleRedirectUri(),
    response_type: 'code',
    scope: CALENDAR_SCOPES.join(' '),
    state,
    // Both are required to be handed a refresh token: offline asks for one,
    // and consent forces a fresh grant even if this account already approved
    // a narrower scope — otherwise Google returns an access token only.
    access_type: 'offline',
    prompt: 'consent',
  })

  return `${AUTH_ENDPOINT}?${params.toString()}`
}

export interface TokenResponse {
  accessToken: string
  refreshToken?: string
  expiresAt: Date
  scopes: string[]
}

export async function exchangeCodeForTokens(code: string): Promise<TokenResponse> {
  const creds = await getProviderCredentials('google')
  if (!creds) throw new Error('Google is not configured.')

  const response = await fetch(TOKEN_ENDPOINT, {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body: new URLSearchParams({
      code,
      client_id: creds.clientId,
      client_secret: creds.clientSecret,
      redirect_uri: googleRedirectUri(),
      grant_type: 'authorization_code',
    }),
  })

  const data = await response.json().catch(() => null)
  if (!response.ok || !data?.access_token) {
    throw new Error(data?.error_description || data?.error || 'Token exchange failed')
  }

  return {
    accessToken: data.access_token,
    refreshToken: data.refresh_token,
    expiresAt: new Date(Date.now() + (data.expires_in ?? 3600) * 1000),
    scopes: typeof data.scope === 'string' ? data.scope.split(' ') : [],
  }
}

export async function fetchGoogleEmail(accessToken: string): Promise<string | null> {
  const response = await fetch(USERINFO_ENDPOINT, {
    headers: { Authorization: `Bearer ${accessToken}` },
  })
  if (!response.ok) return null
  const data = await response.json().catch(() => null)
  return typeof data?.email === 'string' ? data.email : null
}

export async function getConnection(): Promise<GoogleCalendarConnection | null> {
  return prisma.googleCalendarConnection.findFirst({ where: { isActive: true } })
}

/**
 * A usable access token, refreshed transparently when it is expired or about
 * to be. Google does not reissue the refresh token, so the stored one is kept.
 */
export async function getAccessToken(connection: GoogleCalendarConnection): Promise<string> {
  const notExpiring =
    connection.tokenExpiresAt &&
    connection.tokenExpiresAt.getTime() - REFRESH_SKEW_MS > Date.now()

  if (notExpiring) {
    return decryptSecret(connection.accessToken, connection.accessTokenIv)
  }

  const creds = await getProviderCredentials('google')
  if (!creds) throw new Error('Google is not configured.')

  const refreshToken = decryptSecret(connection.refreshToken, connection.refreshTokenIv)
  const response = await fetch(TOKEN_ENDPOINT, {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body: new URLSearchParams({
      client_id: creds.clientId,
      client_secret: creds.clientSecret,
      refresh_token: refreshToken,
      grant_type: 'refresh_token',
    }),
  })

  const data = await response.json().catch(() => null)
  if (!response.ok || !data?.access_token) {
    const message = data?.error_description || data?.error || 'Token refresh failed'
    // A revoked grant is permanent until someone reconnects, so record it
    // rather than retrying into the same wall on every sync.
    await prisma.googleCalendarConnection.update({
      where: { id: connection.id },
      data: { connectionError: message, isActive: data?.error !== 'invalid_grant' },
    })
    throw new Error(message)
  }

  const encrypted = encryptSecret(data.access_token)
  await prisma.googleCalendarConnection.update({
    where: { id: connection.id },
    data: {
      accessToken: encrypted.encryptedValue,
      accessTokenIv: encrypted.iv,
      tokenExpiresAt: new Date(Date.now() + (data.expires_in ?? 3600) * 1000),
      connectionError: null,
    },
  })

  return data.access_token
}

async function calendarFetch(
  accessToken: string,
  path: string,
  init: RequestInit = {}
): Promise<Response> {
  return fetch(`${CALENDAR_BASE}${path}`, {
    ...init,
    headers: {
      Authorization: `Bearer ${accessToken}`,
      'Content-Type': 'application/json',
      ...(init.headers ?? {}),
    },
    cache: 'no-store',
  })
}

async function readError(response: Response): Promise<string> {
  const data = await response.json().catch(() => null)
  return data?.error?.message || `Google Calendar API error ${response.status}`
}

/**
 * Every event in the window, following pagination.
 *
 * `singleEvents` expands a recurring series into its instances, which is what
 * we want: a FeaturedEvent is one show on one set of dates, and storing a
 * recurrence rule we cannot edit would be worse than storing nothing.
 * `showDeleted` keeps cancelled tombstones so the reconciler can see removals.
 */
export async function listEvents(
  accessToken: string,
  calendarId: string,
  window: { timeMin: Date; timeMax: Date }
): Promise<GoogleEventResource[]> {
  const events: GoogleEventResource[] = []
  let pageToken: string | undefined

  do {
    const params = new URLSearchParams({
      timeMin: window.timeMin.toISOString(),
      timeMax: window.timeMax.toISOString(),
      singleEvents: 'true',
      showDeleted: 'true',
      maxResults: '250',
    })
    if (pageToken) params.set('pageToken', pageToken)

    const response = await calendarFetch(
      accessToken,
      `/calendars/${encodeURIComponent(calendarId)}/events?${params.toString()}`
    )
    if (!response.ok) throw new Error(await readError(response))

    const data = await response.json()
    events.push(...((data.items ?? []) as GoogleEventResource[]))
    pageToken = data.nextPageToken
  } while (pageToken)

  return events
}

export async function insertEvent(
  accessToken: string,
  calendarId: string,
  body: GoogleEventBody
): Promise<GoogleEventResource> {
  const response = await calendarFetch(
    accessToken,
    `/calendars/${encodeURIComponent(calendarId)}/events`,
    { method: 'POST', body: JSON.stringify(body) }
  )
  if (!response.ok) throw new Error(await readError(response))
  return response.json()
}

export async function updateEvent(
  accessToken: string,
  calendarId: string,
  eventId: string,
  body: GoogleEventBody
): Promise<GoogleEventResource> {
  const response = await calendarFetch(
    accessToken,
    `/calendars/${encodeURIComponent(calendarId)}/events/${encodeURIComponent(eventId)}`,
    { method: 'PATCH', body: JSON.stringify(body) }
  )
  if (!response.ok) throw new Error(await readError(response))
  return response.json()
}

/**
 * Resolves for an event that is already gone: a 404 or 410 means the intended
 * end state is the actual one, and treating it as a failure would leave the
 * local record permanently flagged.
 */
export async function deleteEvent(
  accessToken: string,
  calendarId: string,
  eventId: string
): Promise<void> {
  const response = await calendarFetch(
    accessToken,
    `/calendars/${encodeURIComponent(calendarId)}/events/${encodeURIComponent(eventId)}`,
    { method: 'DELETE' }
  )
  if (response.ok || response.status === 404 || response.status === 410) return
  throw new Error(await readError(response))
}
