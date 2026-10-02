/**
 * The Square connection the kiosk iPad's card reader signs in with.
 *
 * Square's Mobile Payments SDK only accepts an OAuth access token in production — not the
 * personal access token in SQUARE_ACCESS_TOKEN, which the server keeps using for its own
 * Square calls. An admin connects Square once (Settings › Payments › Connect Square); the
 * tokens are stored encrypted with MASTER_KEY on the SQUARE row of payment_provider_configs,
 * refreshed here before their 30-day expiry, and handed only to a paired kiosk
 * (/api/kiosk/square/authorization).
 *
 * Needs SQUARE_APPLICATION_ID and SQUARE_APPLICATION_SECRET (Square Developer Dashboard ›
 * the app › OAuth), and the redirect URL below registered on that same page.
 */
import { createHmac, randomBytes, timingSafeEqual } from 'crypto'
import type { Prisma } from '@prisma/client'
import prisma from '@/lib/prisma'
import { decryptSecret, encryptSecret } from '@/lib/crypto'
import { SITE_URL } from '@/lib/site-url'

/** What the card reader needs: take in-person payments, read the seller's locations. */
export const SQUARE_OAUTH_SCOPES = ['MERCHANT_PROFILE_READ', 'PAYMENTS_WRITE', 'PAYMENTS_WRITE_IN_PERSON', 'PAYMENTS_READ']

/** Refresh this long before expiry, so a kiosk never signs in with a dying token. */
const REFRESH_WITHIN_MS = 7 * 24 * 60 * 60 * 1000
const STATE_MAX_AGE_MS = 15 * 60 * 1000

export class SquareOAuthError extends Error {}

export function squareConnectBase(): string {
  return process.env.SQUARE_SANDBOX !== 'false' ? 'https://connect.squareupsandbox.com' : 'https://connect.squareup.com'
}

export const SQUARE_OAUTH_REDIRECT_PATH = '/api/admin/square/oauth/callback'

export function squareOAuthRedirectUrl(): string {
  return `${SITE_URL}${SQUARE_OAUTH_REDIRECT_PATH}`
}

function appCredentials() {
  const applicationId = process.env.SQUARE_APPLICATION_ID?.trim()
  const applicationSecret = process.env.SQUARE_APPLICATION_SECRET?.trim()
  if (!applicationId || !applicationSecret) {
    throw new SquareOAuthError('Square is not set up for connecting: add SQUARE_APPLICATION_ID and SQUARE_APPLICATION_SECRET.')
  }
  return { applicationId, applicationSecret }
}

// ---------------------------------------------------------------------------
// state: proves the callback answers an authorization this admin started
// ---------------------------------------------------------------------------

function stateKey(): string {
  const secret = process.env.NEXTAUTH_SECRET
  if (!secret) throw new SquareOAuthError('NEXTAUTH_SECRET is not set')
  return secret
}

const sign = (payload: string) => createHmac('sha256', stateKey()).update(`square-oauth:${payload}`).digest('base64url')

/**
 * Signed rather than kept in a cookie, because the authorization may finish in a different
 * browser from the one that started it — the desktop admin hands Square's page to the
 * default browser. The callback still requires the same admin to be signed in there.
 */
export function createOAuthState(userId: string, now = Date.now()): string {
  const payload = Buffer.from(JSON.stringify({ u: userId, t: now, n: randomBytes(12).toString('hex') })).toString('base64url')
  return `${payload}.${sign(payload)}`
}

export function verifyOAuthState(state: string, userId: string, now = Date.now()): boolean {
  const [payload, signature] = state.split('.')
  if (!payload || !signature) return false
  const expected = Buffer.from(sign(payload))
  const given = Buffer.from(signature)
  if (expected.length !== given.length || !timingSafeEqual(expected, given)) return false
  try {
    const { u, t } = JSON.parse(Buffer.from(payload, 'base64url').toString()) as { u: string; t: number }
    return u === userId && now - t >= 0 && now - t <= STATE_MAX_AGE_MS
  } catch {
    return false
  }
}

export function squareAuthorizeUrl(state: string): string {
  const { applicationId } = appCredentials()
  const params = new URLSearchParams({
    client_id: applicationId,
    scope: SQUARE_OAUTH_SCOPES.join(' '),
    session: 'false',
    state,
    redirect_uri: squareOAuthRedirectUrl(),
  })
  return `${squareConnectBase()}/oauth2/authorize?${params}`
}

// ---------------------------------------------------------------------------
// tokens
// ---------------------------------------------------------------------------

interface TokenResponse {
  access_token?: string
  refresh_token?: string
  expires_at?: string
  merchant_id?: string
  errors?: Array<{ detail?: string; code?: string }>
  message?: string
}

interface StoredTokens {
  accessToken: string
  refreshToken: string
}

/** The SQUARE row's `credentials.squareOAuth`. Tokens are encrypted; the rest is not secret. */
interface StoredConnection {
  encryptedTokens: string
  iv: string
  merchantId: string
  expiresAt: string
  scopes: string[]
  connectedAt: string
  connectedBy: string
}

async function requestToken(body: Record<string, string>): Promise<Required<Pick<TokenResponse, 'access_token' | 'expires_at' | 'merchant_id'>> & TokenResponse> {
  const { applicationId, applicationSecret } = appCredentials()
  const response = await fetch(`${squareConnectBase()}/oauth2/token`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', 'Square-Version': '2025-09-24' },
    body: JSON.stringify({ client_id: applicationId, client_secret: applicationSecret, ...body }),
  })
  const data = (await response.json().catch(() => ({}))) as TokenResponse
  if (!response.ok || !data.access_token || !data.expires_at || !data.merchant_id) {
    const reason = data.errors?.[0]?.detail ?? data.message ?? `HTTP ${response.status}`
    throw new SquareOAuthError(`Square refused the token request: ${reason}`)
  }
  return data as Required<Pick<TokenResponse, 'access_token' | 'expires_at' | 'merchant_id'>> & TokenResponse
}

async function loadConnection(): Promise<{ stored: StoredConnection; credentials: Record<string, unknown> } | null> {
  const row = await prisma.paymentProviderConfig.findUnique({ where: { provider: 'SQUARE' }, select: { credentials: true } })
  const credentials = (row?.credentials ?? {}) as Record<string, unknown>
  const stored = credentials.squareOAuth as StoredConnection | undefined
  return stored ? { stored, credentials } : null
}

async function saveConnection(stored: StoredConnection | null) {
  const existing = await prisma.paymentProviderConfig.findUnique({ where: { provider: 'SQUARE' }, select: { credentials: true } })
  const credentials = { ...((existing?.credentials ?? {}) as Record<string, unknown>) }
  if (stored) credentials.squareOAuth = stored
  else delete credentials.squareOAuth
  const value = credentials as Prisma.InputJsonValue

  // The row may not exist yet. Creating it inactive leaves online checkout exactly as it was:
  // only active provider rows change which payment methods the store offers.
  await prisma.paymentProviderConfig.upsert({
    where: { provider: 'SQUARE' },
    update: { credentials: value },
    create: {
      provider: 'SQUARE',
      isActive: false,
      supportedMethods: [],
      testMode: process.env.SQUARE_SANDBOX !== 'false',
      credentials: value,
    },
  })
}

function sealTokens(tokens: StoredTokens) {
  const { encryptedValue, iv } = encryptSecret(JSON.stringify(tokens))
  return { encryptedTokens: encryptedValue, iv }
}

function openTokens(stored: StoredConnection): StoredTokens {
  return JSON.parse(decryptSecret(stored.encryptedTokens, stored.iv)) as StoredTokens
}

/** Finish the authorization: trade Square's one-time code for tokens and keep them. */
export async function completeSquareConnection(code: string, userId: string) {
  const data = await requestToken({ code, grant_type: 'authorization_code', redirect_uri: squareOAuthRedirectUrl() })
  if (!data.refresh_token) throw new SquareOAuthError('Square did not return a refresh token')

  // The card reader takes payments at SQUARE_LOCATION_ID; the connected account must own it.
  const locationId = process.env.SQUARE_LOCATION_ID
  if (locationId) {
    const check = await fetch(`${squareConnectBase()}/v2/locations/${encodeURIComponent(locationId)}`, {
      headers: { Authorization: `Bearer ${data.access_token}`, 'Square-Version': '2025-09-24' },
    })
    if (!check.ok) {
      throw new SquareOAuthError('That Square account does not own the location in SQUARE_LOCATION_ID. Connect the account the kiosk sells for.')
    }
  }

  await saveConnection({
    ...sealTokens({ accessToken: data.access_token, refreshToken: data.refresh_token }),
    merchantId: data.merchant_id,
    expiresAt: data.expires_at,
    scopes: SQUARE_OAUTH_SCOPES,
    connectedAt: new Date().toISOString(),
    connectedBy: userId,
  })
  return { merchantId: data.merchant_id }
}

export interface SquareConnectionStatus {
  configured: boolean
  connected: boolean
  merchantId?: string
  expiresAt?: string
  connectedAt?: string
}

/** For the admin screens: whether Square is connected. Never includes a token. */
export async function getSquareConnectionStatus(): Promise<SquareConnectionStatus> {
  const configured = Boolean(process.env.SQUARE_APPLICATION_ID && process.env.SQUARE_APPLICATION_SECRET)
  const connection = await loadConnection().catch(() => null)
  if (!connection) return { configured, connected: false }
  const { merchantId, expiresAt, connectedAt } = connection.stored
  return { configured, connected: true, merchantId, expiresAt, connectedAt }
}

/** A current access token for the card reader, refreshing it first when it is close to expiry. */
export async function getSquareReaderToken(now = Date.now()): Promise<{ accessToken: string; expiresAt: string }> {
  const connection = await loadConnection()
  if (!connection) throw new SquareOAuthError('Square is not connected. An admin needs to use Connect Square in Settings › Payments.')

  const { stored } = connection
  const tokens = openTokens(stored)
  if (new Date(stored.expiresAt).getTime() - now > REFRESH_WITHIN_MS) {
    return { accessToken: tokens.accessToken, expiresAt: stored.expiresAt }
  }

  const data = await requestToken({ grant_type: 'refresh_token', refresh_token: tokens.refreshToken })
  const refreshed = { accessToken: data.access_token, refreshToken: data.refresh_token ?? tokens.refreshToken }
  await saveConnection({ ...stored, ...sealTokens(refreshed), expiresAt: data.expires_at, merchantId: data.merchant_id })
  return { accessToken: refreshed.accessToken, expiresAt: data.expires_at }
}

/** Disconnect: revoke the token with Square, then forget it here. */
export async function disconnectSquare() {
  const connection = await loadConnection()
  if (!connection) return
  const { applicationId, applicationSecret } = appCredentials()
  const { accessToken } = openTokens(connection.stored)
  const response = await fetch(`${squareConnectBase()}/oauth2/revoke`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Client ${applicationSecret}`,
      'Square-Version': '2025-09-24',
    },
    body: JSON.stringify({ client_id: applicationId, access_token: accessToken }),
  })
  // Already revoked on Square's side is fine; anything else is worth stopping for.
  if (!response.ok && response.status !== 404) {
    throw new SquareOAuthError(`Square refused to revoke the connection (HTTP ${response.status})`)
  }
  await saveConnection(null)
}
