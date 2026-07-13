import crypto from 'crypto'
import { GscServiceAccount } from './configuration'

/**
 * Minimal Google Search Console API client authenticated with a service
 * account (JWT bearer flow), implemented with node:crypto + fetch so no
 * googleapis dependency is needed.
 *
 * Setup: create a service account in Google Cloud, enable the Search Console
 * API, then add the service account email as a user on the property in
 * Search Console.
 */

const TOKEN_URL = 'https://oauth2.googleapis.com/token'
const SCOPE = 'https://www.googleapis.com/auth/webmasters'
const API_BASE = 'https://www.googleapis.com/webmasters/v3'

function base64url(input: Buffer | string): string {
  return Buffer.from(input)
    .toString('base64')
    .replace(/\+/g, '-')
    .replace(/\//g, '_')
    .replace(/=+$/, '')
}

interface CachedToken {
  accessToken: string
  clientEmail: string
  expiresAt: number
}

let tokenCache: CachedToken | null = null

export async function getAccessToken(serviceAccount: GscServiceAccount): Promise<string> {
  const now = Math.floor(Date.now() / 1000)

  if (
    tokenCache &&
    tokenCache.clientEmail === serviceAccount.client_email &&
    tokenCache.expiresAt > now + 60
  ) {
    return tokenCache.accessToken
  }

  const header = base64url(JSON.stringify({ alg: 'RS256', typ: 'JWT' }))
  const claims = base64url(
    JSON.stringify({
      iss: serviceAccount.client_email,
      scope: SCOPE,
      aud: TOKEN_URL,
      iat: now,
      exp: now + 3600,
    })
  )
  const signingInput = `${header}.${claims}`

  const signature = crypto
    .createSign('RSA-SHA256')
    .update(signingInput)
    .sign(serviceAccount.private_key)
  const jwt = `${signingInput}.${base64url(signature)}`

  const response = await fetch(TOKEN_URL, {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body: new URLSearchParams({
      grant_type: 'urn:ietf:params:oauth:grant-type:jwt-bearer',
      assertion: jwt,
    }),
  })

  if (!response.ok) {
    const body = await response.text()
    throw new Error(`Failed to obtain Google access token (${response.status}): ${body}`)
  }

  const data = (await response.json()) as { access_token: string; expires_in: number }
  tokenCache = {
    accessToken: data.access_token,
    clientEmail: serviceAccount.client_email,
    expiresAt: now + data.expires_in,
  }
  return data.access_token
}

async function gscFetch(
  serviceAccount: GscServiceAccount,
  path: string,
  init?: RequestInit
): Promise<any> {
  const token = await getAccessToken(serviceAccount)
  const response = await fetch(`${API_BASE}${path}`, {
    ...init,
    headers: {
      Authorization: `Bearer ${token}`,
      'Content-Type': 'application/json',
      ...init?.headers,
    },
  })

  if (!response.ok) {
    const body = await response.text()
    throw new Error(`Search Console API error (${response.status}): ${body}`)
  }

  // Some endpoints (sitemap submit) return an empty body
  const text = await response.text()
  return text ? JSON.parse(text) : null
}

export interface GscSite {
  siteUrl: string
  permissionLevel: string
}

export async function listSites(serviceAccount: GscServiceAccount): Promise<GscSite[]> {
  const data = await gscFetch(serviceAccount, '/sites')
  return data?.siteEntry ?? []
}

export interface SearchAnalyticsQuery {
  startDate: string // YYYY-MM-DD
  endDate: string
  dimensions?: string[]
  rowLimit?: number
}

export interface SearchAnalyticsRow {
  keys: string[]
  clicks: number
  impressions: number
  ctr: number
  position: number
}

export async function querySearchAnalytics(
  serviceAccount: GscServiceAccount,
  property: string,
  query: SearchAnalyticsQuery
): Promise<SearchAnalyticsRow[]> {
  const data = await gscFetch(
    serviceAccount,
    `/sites/${encodeURIComponent(property)}/searchAnalytics/query`,
    {
      method: 'POST',
      body: JSON.stringify({
        startDate: query.startDate,
        endDate: query.endDate,
        dimensions: query.dimensions ?? [],
        rowLimit: query.rowLimit ?? 25,
      }),
    }
  )
  return data?.rows ?? []
}

export interface GscSitemap {
  path: string
  lastSubmitted?: string
  lastDownloaded?: string
  isPending?: boolean
  errors?: string
  warnings?: string
}

export async function listSitemaps(
  serviceAccount: GscServiceAccount,
  property: string
): Promise<GscSitemap[]> {
  const data = await gscFetch(serviceAccount, `/sites/${encodeURIComponent(property)}/sitemaps`)
  return data?.sitemap ?? []
}

export async function submitSitemap(
  serviceAccount: GscServiceAccount,
  property: string,
  sitemapUrl: string
): Promise<void> {
  await gscFetch(
    serviceAccount,
    `/sites/${encodeURIComponent(property)}/sitemaps/${encodeURIComponent(sitemapUrl)}`,
    { method: 'PUT' }
  )
}
