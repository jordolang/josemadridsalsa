import crypto from 'crypto'
import {
  QUICKBOOKS_AUTHORIZE_URL,
  QUICKBOOKS_TOKEN_URL,
  QUICKBOOKS_REVOKE_URL,
  QUICKBOOKS_SCOPES,
  getQuickBooksRedirectUri,
  type QuickBooksAppCredentials,
  type QuickBooksEnvironment,
} from './config'

export const QUICKBOOKS_OAUTH_COOKIE_NAME = 'quickbooks_oauth_session'
const QUICKBOOKS_OAUTH_MAX_AGE_SECONDS = 10 * 60

export type QuickBooksOAuthSession = {
  state: string
  environment: QuickBooksEnvironment
  userId: string
  createdAt: number
}

export function createOAuthState(): string {
  return crypto.randomBytes(24).toString('hex')
}

export function serializeOAuthSession(session: QuickBooksOAuthSession): string {
  return JSON.stringify(session)
}

export function parseOAuthSession(raw: string | undefined): QuickBooksOAuthSession | null {
  if (!raw) return null

  try {
    const parsed = JSON.parse(raw) as Partial<QuickBooksOAuthSession>

    if (
      typeof parsed.state !== 'string' ||
      typeof parsed.userId !== 'string' ||
      typeof parsed.createdAt !== 'number' ||
      (parsed.environment !== 'sandbox' && parsed.environment !== 'production')
    ) {
      return null
    }

    if (Date.now() - parsed.createdAt > QUICKBOOKS_OAUTH_MAX_AGE_SECONDS * 1000) {
      return null
    }

    return parsed as QuickBooksOAuthSession
  } catch {
    return null
  }
}

export function getOAuthCookieOptions() {
  return {
    httpOnly: true,
    sameSite: 'lax' as const,
    secure: process.env.NODE_ENV === 'production',
    path: '/',
    maxAge: QUICKBOOKS_OAUTH_MAX_AGE_SECONDS,
  }
}

/** Build the Intuit authorization URL the admin is redirected to. */
export function getAuthorizationUrl(params: {
  clientId: string
  state: string
}): string {
  const url = new URL(QUICKBOOKS_AUTHORIZE_URL)
  url.searchParams.set('client_id', params.clientId)
  url.searchParams.set('response_type', 'code')
  url.searchParams.set('scope', QUICKBOOKS_SCOPES.join(' '))
  url.searchParams.set('redirect_uri', getQuickBooksRedirectUri())
  url.searchParams.set('state', params.state)
  return url.toString()
}

export type QuickBooksTokens = {
  accessToken: string
  refreshToken: string
  /** Access-token lifetime in seconds (typically 3600). */
  expiresIn: number
  /** Refresh-token lifetime in seconds (typically ~8726400 ≈ 101 days). */
  refreshExpiresIn: number
}

function basicAuthHeader(creds: QuickBooksAppCredentials): string {
  return (
    'Basic ' + Buffer.from(`${creds.clientId}:${creds.clientSecret}`).toString('base64')
  )
}

function parseTokenResponse(data: any): QuickBooksTokens {
  if (!data?.access_token || !data?.refresh_token) {
    const message = data?.error_description || data?.error || 'Token exchange failed'
    throw new Error(`QuickBooks: ${message}`)
  }
  return {
    accessToken: data.access_token,
    refreshToken: data.refresh_token,
    expiresIn: typeof data.expires_in === 'number' ? data.expires_in : 3600,
    refreshExpiresIn:
      typeof data.x_refresh_token_expires_in === 'number'
        ? data.x_refresh_token_expires_in
        : 8726400,
  }
}

/** Exchange an authorization code for access + refresh tokens. */
export async function exchangeCodeForTokens(params: {
  code: string
  creds: QuickBooksAppCredentials
}): Promise<QuickBooksTokens> {
  const res = await fetch(QUICKBOOKS_TOKEN_URL, {
    method: 'POST',
    headers: {
      Authorization: basicAuthHeader(params.creds),
      'Content-Type': 'application/x-www-form-urlencoded',
      Accept: 'application/json',
    },
    body: new URLSearchParams({
      grant_type: 'authorization_code',
      code: params.code,
      redirect_uri: getQuickBooksRedirectUri(),
    }),
  })
  return parseTokenResponse(await res.json().catch(() => null))
}

/** Trade a refresh token for a fresh access token (refresh token also rotates). */
export async function refreshTokens(params: {
  refreshToken: string
  creds: QuickBooksAppCredentials
}): Promise<QuickBooksTokens> {
  const res = await fetch(QUICKBOOKS_TOKEN_URL, {
    method: 'POST',
    headers: {
      Authorization: basicAuthHeader(params.creds),
      'Content-Type': 'application/x-www-form-urlencoded',
      Accept: 'application/json',
    },
    body: new URLSearchParams({
      grant_type: 'refresh_token',
      refresh_token: params.refreshToken,
    }),
  })
  return parseTokenResponse(await res.json().catch(() => null))
}

/** Best-effort token revocation on disconnect. Never throws. */
export async function revokeToken(params: {
  token: string
  creds: QuickBooksAppCredentials
}): Promise<boolean> {
  try {
    const res = await fetch(QUICKBOOKS_REVOKE_URL, {
      method: 'POST',
      headers: {
        Authorization: basicAuthHeader(params.creds),
        'Content-Type': 'application/json',
        Accept: 'application/json',
      },
      body: JSON.stringify({ token: params.token }),
    })
    return res.ok
  } catch {
    return false
  }
}
