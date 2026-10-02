/**
 * Gmail v1 access for the customer-email triage.
 *
 * The mailbox is already organised by an agent that labels and files mail daily, so this
 * module deliberately does **not** own the inbox: it reads what matches the connection's
 * search, adds its own labels alongside whatever is already there, and replies in-thread so
 * the answer lands in Gmail's Sent folder exactly as a typed reply would.
 *
 * Modelled on `lib/events/google-calendar-client.ts` — same OAuth client, same encrypted
 * token storage, same refresh dance — because both are user-granted Google grants and there
 * is no reason for them to behave differently.
 */

import type { GmailConnection } from '@prisma/client'

import { prisma } from '@/lib/prisma'
import { decryptSecret, encryptSecret } from '@/lib/crypto'
import { getProviderCredentials } from '@/lib/social/credentials'

const AUTH_ENDPOINT = 'https://accounts.google.com/o/oauth2/v2/auth'
const TOKEN_ENDPOINT = 'https://oauth2.googleapis.com/token'
const GMAIL_BASE = 'https://gmail.googleapis.com/gmail/v1/users/me'
const USERINFO_ENDPOINT = 'https://openidconnect.googleapis.com/v1/userinfo'

/**
 * `gmail.modify` covers reading messages and changing their labels; `gmail.send` is the
 * separate scope Google requires to actually send. Neither implies the other, and the
 * broader `https://mail.google.com/` scope — which also grants permanent deletion — is not
 * requested: nothing here should ever be able to destroy mail.
 */
export const GMAIL_SCOPES = [
  'https://www.googleapis.com/auth/gmail.modify',
  'https://www.googleapis.com/auth/gmail.send',
  'openid',
  'email',
]

/** Refresh a token this long before it actually expires. */
const REFRESH_SKEW_MS = 60_000

export class GmailNotConnectedError extends Error {
  constructor(message = 'Gmail is not connected.') {
    super(message)
    this.name = 'GmailNotConnectedError'
  }
}

export function gmailRedirectUri(): string {
  const base = process.env.NEXTAUTH_URL?.replace(/\/$/, '') || 'http://localhost:3000'
  return `${base}/api/admin/inbox/google/callback`
}

export async function buildGmailAuthUrl(state: string): Promise<string> {
  const creds = await getProviderCredentials('google')
  if (!creds) {
    throw new Error(
      'Google is not configured. Set GOOGLE_CLIENT_ID and GOOGLE_CLIENT_SECRET, or add them under Social → Accounts.',
    )
  }

  const params = new URLSearchParams({
    client_id: creds.clientId,
    redirect_uri: gmailRedirectUri(),
    response_type: 'code',
    scope: GMAIL_SCOPES.join(' '),
    state,
    // Both are required to be handed a refresh token: offline asks for one, and consent
    // forces a fresh grant even where this account already approved a narrower scope.
    access_type: 'offline',
    prompt: 'consent',
  })

  return `${AUTH_ENDPOINT}?${params.toString()}`
}

export interface GmailTokenResponse {
  accessToken: string
  refreshToken?: string
  expiresAt: Date
  scopes: string[]
}

export async function exchangeGmailCode(code: string): Promise<GmailTokenResponse> {
  const creds = await getProviderCredentials('google')
  if (!creds) throw new Error('Google is not configured.')

  const response = await fetch(TOKEN_ENDPOINT, {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body: new URLSearchParams({
      code,
      client_id: creds.clientId,
      client_secret: creds.clientSecret,
      redirect_uri: gmailRedirectUri(),
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

export async function getGmailConnection(): Promise<GmailConnection | null> {
  return prisma.gmailConnection.findFirst({ where: { isActive: true } })
}

/**
 * A usable access token, refreshed transparently when it is expired or about to be.
 * Google does not reissue the refresh token, so the stored one is kept.
 */
export async function getGmailAccessToken(connection: GmailConnection): Promise<string> {
  const notExpiring =
    connection.tokenExpiresAt && connection.tokenExpiresAt.getTime() - REFRESH_SKEW_MS > Date.now()

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
    // A revoked grant is permanent until someone reconnects, so record it rather than
    // retrying into the same wall on every sweep.
    await prisma.gmailConnection.update({
      where: { id: connection.id },
      data: { connectionError: message, isActive: data?.error !== 'invalid_grant' },
    })
    throw new Error(message)
  }

  const encrypted = encryptSecret(data.access_token)
  await prisma.gmailConnection.update({
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

export async function gmailFetch(
  accessToken: string,
  path: string,
  init: RequestInit = {},
): Promise<Response> {
  return fetch(`${GMAIL_BASE}${path}`, {
    ...init,
    headers: {
      Authorization: `Bearer ${accessToken}`,
      'Content-Type': 'application/json',
      ...(init.headers ?? {}),
    },
    cache: 'no-store',
  })
}

export async function readGmailError(response: Response): Promise<string> {
  const data = await response.json().catch(() => null)
  return data?.error?.message || `Gmail API error ${response.status}`
}

// ---------------------------------------------------------------------------
// reading
// ---------------------------------------------------------------------------

export interface GmailMessageRef {
  id: string
  threadId: string
}

/**
 * Message ids matching the connection's search.
 *
 * Capped rather than paginated to exhaustion: a sweep that runs every few minutes should
 * take a bite it can finish inside a function timeout, and anything it leaves behind is
 * still matching the same query on the next tick.
 */
export async function listMessages(
  accessToken: string,
  query: string,
  limit: number,
): Promise<GmailMessageRef[]> {
  const params = new URLSearchParams({
    q: query,
    maxResults: String(Math.min(limit, 100)),
  })

  const response = await gmailFetch(accessToken, `/messages?${params.toString()}`)
  if (!response.ok) throw new Error(await readGmailError(response))

  const data = await response.json()
  const messages: unknown = data?.messages
  if (!Array.isArray(messages)) return []

  return messages
    .filter((m): m is GmailMessageRef => Boolean(m?.id && m?.threadId))
    .map((m) => ({ id: m.id, threadId: m.threadId }))
}

export interface GmailMessage {
  id: string
  threadId: string
  labelIds: string[]
  snippet: string
  fromEmail: string
  fromName: string | null
  /** The address the mail was sent to, used to skip our own outbound copies. */
  toEmail: string | null
  subject: string
  receivedAt: Date
  body: string
  /** RFC822 id of the message, needed to thread a reply correctly. */
  rfcMessageId: string | null
  references: string | null
}

export async function getMessage(accessToken: string, id: string): Promise<GmailMessage | null> {
  const response = await gmailFetch(accessToken, `/messages/${id}?format=full`)
  if (response.status === 404) return null
  if (!response.ok) throw new Error(await readGmailError(response))

  return parseGmailMessage(await response.json())
}

/** Header lookup is case-insensitive: Gmail does not normalise what senders send. */
export function headerValue(
  headers: Array<{ name?: string; value?: string }> | undefined,
  name: string,
): string | null {
  const match = headers?.find((h) => h.name?.toLowerCase() === name.toLowerCase())
  return match?.value ?? null
}

/** `Mike Madrid <mike@example.com>` → both halves; a bare address → just the address. */
export function parseAddress(raw: string | null): { email: string; name: string | null } {
  if (!raw) return { email: '', name: null }

  const angled = raw.match(/^\s*(.*?)\s*<([^>]+)>\s*$/)
  if (angled) {
    const name = angled[1].replace(/^"|"$/g, '').trim()
    return { email: angled[2].trim().toLowerCase(), name: name || null }
  }

  return { email: raw.trim().toLowerCase(), name: null }
}

function decodeBase64Url(data: string): string {
  return Buffer.from(data.replace(/-/g, '+').replace(/_/g, '/'), 'base64').toString('utf8')
}

/**
 * The plain-text body, preferring `text/plain` and falling back to stripped HTML.
 *
 * Gmail nests parts arbitrarily deep once a message has attachments or is multipart
 * alternative inside multipart mixed, so this walks the tree rather than assuming a shape.
 */
export function extractBody(payload: unknown): string {
  const plain = findPart(payload, 'text/plain')
  if (plain) return plain

  const html = findPart(payload, 'text/html')
  if (html) {
    return html
      .replace(/<style[\s\S]*?<\/style>/gi, ' ')
      .replace(/<script[\s\S]*?<\/script>/gi, ' ')
      .replace(/<br\s*\/?>/gi, '\n')
      .replace(/<\/p>/gi, '\n\n')
      .replace(/<[^>]+>/g, ' ')
      .replace(/&nbsp;/g, ' ')
      .replace(/&amp;/g, '&')
      .replace(/&lt;/g, '<')
      .replace(/&gt;/g, '>')
      .replace(/&quot;/g, '"')
      .replace(/&#39;/g, "'")
      .replace(/[ \t]+/g, ' ')
      // Tag removal leaves a space either side of every line break; without this a
      // paragraph gap reads as "\n " and the body arrives as one run-on block.
      .replace(/[ \t]*\n[ \t]*/g, '\n')
      .replace(/\n{3,}/g, '\n\n')
      .trim()
  }

  return ''
}

function findPart(node: any, mimeType: string): string | null {
  if (!node || typeof node !== 'object') return null

  if (node.mimeType === mimeType && typeof node.body?.data === 'string') {
    return decodeBase64Url(node.body.data).trim()
  }

  if (Array.isArray(node.parts)) {
    for (const part of node.parts) {
      const found = findPart(part, mimeType)
      if (found) return found
    }
  }

  return null
}

export function parseGmailMessage(raw: any): GmailMessage | null {
  if (!raw?.id || !raw?.threadId) return null

  const headers = raw.payload?.headers as Array<{ name?: string; value?: string }> | undefined
  const from = parseAddress(headerValue(headers, 'From'))
  const to = parseAddress(headerValue(headers, 'To'))

  // internalDate is Gmail's own receipt time in epoch milliseconds, and is trustworthy in a
  // way the Date header — set by the sender's machine — is not.
  const internal = Number(raw.internalDate)

  return {
    id: raw.id,
    threadId: raw.threadId,
    labelIds: Array.isArray(raw.labelIds) ? raw.labelIds : [],
    snippet: typeof raw.snippet === 'string' ? raw.snippet : '',
    fromEmail: from.email,
    fromName: from.name,
    toEmail: to.email || null,
    subject: headerValue(headers, 'Subject') ?? '(no subject)',
    receivedAt: Number.isFinite(internal) ? new Date(internal) : new Date(),
    body: extractBody(raw.payload),
    rfcMessageId: headerValue(headers, 'Message-ID'),
    references: headerValue(headers, 'References'),
  }
}

// ---------------------------------------------------------------------------
// labelling
// ---------------------------------------------------------------------------

/**
 * The label id for `name`, creating the label when the mailbox does not have it.
 *
 * Labels are created nested under one parent so the automation's marks are visibly its
 * own and can be removed wholesale without touching the daily agent's filing.
 */
export async function ensureLabel(accessToken: string, name: string): Promise<string | null> {
  const listed = await gmailFetch(accessToken, '/labels')
  if (!listed.ok) return null

  const data = await listed.json().catch(() => null)
  const existing = (data?.labels as Array<{ id?: string; name?: string }> | undefined)?.find(
    (label) => label.name === name,
  )
  if (existing?.id) return existing.id

  const created = await gmailFetch(accessToken, '/labels', {
    method: 'POST',
    body: JSON.stringify({
      name,
      labelListVisibility: 'labelShow',
      messageListVisibility: 'show',
    }),
  })

  if (!created.ok) return null
  const label = await created.json().catch(() => null)
  return typeof label?.id === 'string' ? label.id : null
}

export async function addLabel(
  accessToken: string,
  messageId: string,
  labelId: string,
): Promise<void> {
  await gmailFetch(accessToken, `/messages/${messageId}/modify`, {
    method: 'POST',
    body: JSON.stringify({ addLabelIds: [labelId] }),
  })
}

// ---------------------------------------------------------------------------
// replying
// ---------------------------------------------------------------------------

/**
 * RFC 2047 encoding for a subject that is not pure ASCII.
 *
 * Without this a customer called Núñez gets a reply headed `=?` garbage, which reads as
 * exactly the kind of machine-generated mail this automation is trying not to look like.
 */
function encodeSubject(subject: string): string {
  if (/^[\x20-\x7E]*$/.test(subject)) return subject
  return `=?UTF-8?B?${Buffer.from(subject, 'utf8').toString('base64')}?=`
}

export function buildReplyMime(params: {
  fromMailbox: string
  toEmail: string
  subject: string
  body: string
  inReplyTo: string | null
  references: string | null
}): string {
  const subject = params.subject.toLowerCase().startsWith('re:')
    ? params.subject
    : `Re: ${params.subject}`

  const headers = [
    `From: ${params.fromMailbox}`,
    `To: ${params.toEmail}`,
    `Subject: ${encodeSubject(subject)}`,
    'MIME-Version: 1.0',
    'Content-Type: text/plain; charset="UTF-8"',
    'Content-Transfer-Encoding: 8bit',
  ]

  // Both headers are what makes Gmail — and every other client — file the reply under the
  // original conversation rather than starting a new one.
  if (params.inReplyTo) {
    headers.push(`In-Reply-To: ${params.inReplyTo}`)
    headers.push(`References: ${params.references ?? params.inReplyTo}`)
  }

  return `${headers.join('\r\n')}\r\n\r\n${params.body}`
}

function toBase64Url(value: string): string {
  return Buffer.from(value, 'utf8')
    .toString('base64')
    .replace(/\+/g, '-')
    .replace(/\//g, '_')
    .replace(/=+$/, '')
}

/** Send a reply on an existing thread. Returns the new message id. */
export async function sendReply(
  accessToken: string,
  threadId: string,
  mime: string,
): Promise<string> {
  const response = await gmailFetch(accessToken, '/messages/send', {
    method: 'POST',
    body: JSON.stringify({ raw: toBase64Url(mime), threadId }),
  })

  if (!response.ok) throw new Error(await readGmailError(response))
  const data = await response.json()
  return data?.id ?? ''
}

/** Leave a reply as a draft on the thread, for a human to read and send. */
export async function createDraft(
  accessToken: string,
  threadId: string,
  mime: string,
): Promise<string> {
  const response = await gmailFetch(accessToken, '/drafts', {
    method: 'POST',
    body: JSON.stringify({ message: { raw: toBase64Url(mime), threadId } }),
  })

  if (!response.ok) throw new Error(await readGmailError(response))
  const data = await response.json()
  return data?.id ?? ''
}

/** Where a human should click to read the thread in Gmail. */
export function gmailThreadUrl(threadId: string): string {
  return `https://mail.google.com/mail/u/0/#all/${threadId}`
}
