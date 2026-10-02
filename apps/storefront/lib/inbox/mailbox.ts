/**
 * Full mailbox access for the desktop admin's Mail page.
 *
 * Built on the same Gmail grant the customer-email triage uses (`gmail.modify` +
 * `gmail.send`), so it can read, label, archive, trash and send — but, like the triage, it
 * can never permanently delete mail: that needs the broader `mail.google.com` scope, which
 * is deliberately not requested. "Delete" here means Gmail's Trash, recoverable for 30 days.
 */
import { extractBody, gmailFetch, headerValue, parseAddress, readGmailError } from '@/lib/inbox/gmail'

// ---------------------------------------------------------------------------
// labels
// ---------------------------------------------------------------------------

export interface MailLabel {
  id: string
  name: string
  type: 'system' | 'user'
  unread: number
  total: number
  color: string | null
}

/** System labels worth showing as folders, in the order Gmail shows them. */
const SYSTEM_FOLDERS = ['INBOX', 'STARRED', 'IMPORTANT', 'SENT', 'DRAFT', 'SPAM', 'TRASH']

export async function listLabels(accessToken: string): Promise<MailLabel[]> {
  const response = await gmailFetch(accessToken, '/labels')
  if (!response.ok) throw new Error(await readGmailError(response))
  const data = await response.json()
  const raw: Array<{ id: string; name: string; type?: string }> = Array.isArray(data?.labels)
    ? data.labels
    : []

  const wanted = raw.filter((label) =>
    label.type === 'user' ? true : SYSTEM_FOLDERS.includes(label.id),
  )

  // The list endpoint carries no counts; each label's own read does.
  const detailed = await Promise.all(
    wanted.map(async (label) => {
      const res = await gmailFetch(accessToken, `/labels/${encodeURIComponent(label.id)}`)
      const full = res.ok ? await res.json().catch(() => null) : null
      return {
        id: label.id,
        name: label.name,
        type: label.type === 'user' ? 'user' : 'system',
        unread: Number(full?.threadsUnread ?? 0),
        total: Number(full?.threadsTotal ?? 0),
        color: typeof full?.color?.backgroundColor === 'string' ? full.color.backgroundColor : null,
      } satisfies MailLabel
    }),
  )

  return detailed.sort((a, b) => {
    if (a.type !== b.type) return a.type === 'system' ? -1 : 1
    if (a.type === 'system') return SYSTEM_FOLDERS.indexOf(a.id) - SYSTEM_FOLDERS.indexOf(b.id)
    return a.name.localeCompare(b.name)
  })
}

export async function createLabel(accessToken: string, name: string): Promise<MailLabel> {
  const response = await gmailFetch(accessToken, '/labels', {
    method: 'POST',
    body: JSON.stringify({ name, labelListVisibility: 'labelShow', messageListVisibility: 'show' }),
  })
  if (!response.ok) throw new Error(await readGmailError(response))
  const label = await response.json()
  return { id: label.id, name: label.name, type: 'user', unread: 0, total: 0, color: null }
}

// ---------------------------------------------------------------------------
// threads
// ---------------------------------------------------------------------------

export interface ThreadSummary {
  id: string
  subject: string
  from: string
  snippet: string
  date: string
  unread: boolean
  starred: boolean
  labelIds: string[]
  messageCount: number
}

export interface ThreadPage {
  threads: ThreadSummary[]
  nextPageToken: string | null
}

/** One page of conversations in a folder and/or matching a Gmail search. */
export async function listThreads(
  accessToken: string,
  options: { labelId?: string; q?: string; pageToken?: string; max?: number },
): Promise<ThreadPage> {
  const params = new URLSearchParams({ maxResults: String(Math.min(options.max ?? 25, 50)) })
  if (options.labelId) params.append('labelIds', options.labelId)
  if (options.q) params.set('q', options.q)
  if (options.pageToken) params.set('pageToken', options.pageToken)

  const response = await gmailFetch(accessToken, `/threads?${params.toString()}`)
  if (!response.ok) throw new Error(await readGmailError(response))
  const data = await response.json()
  const refs: Array<{ id: string }> = Array.isArray(data?.threads) ? data.threads : []

  const metadata = new URLSearchParams({ format: 'metadata' })
  for (const header of ['From', 'Subject', 'Date']) metadata.append('metadataHeaders', header)

  const threads = await Promise.all(
    refs.map(async (ref) => {
      const res = await gmailFetch(accessToken, `/threads/${ref.id}?${metadata.toString()}`)
      if (!res.ok) return null
      return summarizeThread(await res.json())
    }),
  )

  return {
    threads: threads.filter((t): t is ThreadSummary => t !== null),
    nextPageToken: typeof data?.nextPageToken === 'string' ? data.nextPageToken : null,
  }
}

type RawMessage = {
  id: string
  labelIds?: string[]
  snippet?: string
  internalDate?: string
  payload?: RawPart
}
type RawPart = {
  partId?: string
  mimeType?: string
  filename?: string
  headers?: Array<{ name?: string; value?: string }>
  body?: { data?: string; size?: number; attachmentId?: string }
  parts?: RawPart[]
}

export function summarizeThread(raw: { id?: string; messages?: RawMessage[] }): ThreadSummary | null {
  const messages = raw.messages ?? []
  if (!raw.id || messages.length === 0) return null
  const first = messages[0]
  const last = messages[messages.length - 1]
  const labels = new Set(messages.flatMap((m) => m.labelIds ?? []))
  const from = parseAddress(headerValue(last.payload?.headers, 'From'))

  return {
    id: raw.id,
    subject: headerValue(first.payload?.headers, 'Subject') || '(no subject)',
    from: from.name || from.email,
    snippet: last.snippet ?? '',
    date: new Date(Number(last.internalDate) || Date.now()).toISOString(),
    unread: labels.has('UNREAD'),
    starred: labels.has('STARRED'),
    labelIds: [...labels],
    messageCount: messages.length,
  }
}

export interface MailAttachment {
  attachmentId: string
  filename: string
  mimeType: string
  size: number
}

export interface MailMessage {
  id: string
  from: string
  /** Where replies should go when it differs from From (contact forms, list mail). */
  replyTo: string | null
  to: string
  cc: string
  date: string
  subject: string
  labelIds: string[]
  /** HTML as sent. The client renders it in a script-less sandboxed frame. */
  html: string | null
  text: string
  attachments: MailAttachment[]
  rfcMessageId: string | null
  references: string | null
}

export interface MailThread {
  id: string
  subject: string
  labelIds: string[]
  messages: MailMessage[]
}

function decode(data: string): string {
  return Buffer.from(data.replace(/-/g, '+').replace(/_/g, '/'), 'base64').toString('utf8')
}

function walk(part: RawPart | undefined, visit: (part: RawPart) => void) {
  if (!part) return
  visit(part)
  for (const child of part.parts ?? []) walk(child, visit)
}

export function parseMailMessage(raw: RawMessage): MailMessage {
  const headers = raw.payload?.headers
  let html: string | null = null
  let text = ''
  const attachments: MailAttachment[] = []

  walk(raw.payload, (part) => {
    // Anything with a filename is a file, even a .html or .txt one, and even when Gmail
    // returned it inline in body.data instead of giving it an attachmentId.
    if (part.filename) {
      const attachmentId = part.body?.attachmentId ?? (part.partId ? `${INLINE_PART}${part.partId}` : null)
      if (!attachmentId) return
      attachments.push({
        attachmentId,
        filename: part.filename,
        mimeType: part.mimeType ?? 'application/octet-stream',
        size: part.body?.size ?? 0,
      })
    } else if (part.mimeType === 'text/html' && part.body?.data && html === null) {
      html = decode(part.body.data)
    } else if (part.mimeType === 'text/plain' && part.body?.data && !text) {
      text = decode(part.body.data)
    }
  })

  // HTML-only mail still needs text, for reply quoting and forwarding.
  if (!text && html) text = extractBody({ mimeType: 'text/html', body: { data: Buffer.from(html, 'utf8').toString('base64url') } })

  return {
    id: raw.id,
    from: headerValue(headers, 'From') ?? '',
    replyTo: headerValue(headers, 'Reply-To'),
    to: headerValue(headers, 'To') ?? '',
    cc: headerValue(headers, 'Cc') ?? '',
    date: new Date(Number(raw.internalDate) || Date.now()).toISOString(),
    subject: headerValue(headers, 'Subject') ?? '(no subject)',
    labelIds: raw.labelIds ?? [],
    html,
    text,
    attachments,
    rfcMessageId: headerValue(headers, 'Message-ID'),
    references: headerValue(headers, 'References'),
  }
}

export async function getThread(accessToken: string, threadId: string): Promise<MailThread | null> {
  const response = await gmailFetch(accessToken, `/threads/${encodeURIComponent(threadId)}?format=full`)
  if (response.status === 404) return null
  if (!response.ok) throw new Error(await readGmailError(response))
  const raw = await response.json()
  const messages = (raw.messages as RawMessage[] | undefined)?.map(parseMailMessage) ?? []
  return {
    id: raw.id,
    subject: messages[0]?.subject ?? '(no subject)',
    labelIds: [...new Set(messages.flatMap((m) => m.labelIds))],
    messages,
  }
}

/** What the reader's toolbar can do to a conversation. */
export const THREAD_ACTIONS = {
  archive: { remove: ['INBOX'] },
  inbox: { add: ['INBOX'] },
  read: { remove: ['UNREAD'] },
  unread: { add: ['UNREAD'] },
  star: { add: ['STARRED'] },
  unstar: { remove: ['STARRED'] },
  important: { add: ['IMPORTANT'] },
  unimportant: { remove: ['IMPORTANT'] },
  spam: { add: ['SPAM'], remove: ['INBOX'] },
  notspam: { add: ['INBOX'], remove: ['SPAM'] },
} as const satisfies Record<string, { add?: readonly string[]; remove?: readonly string[] }>

export type ThreadAction = keyof typeof THREAD_ACTIONS | 'trash' | 'untrash'

export async function modifyThread(
  accessToken: string,
  threadId: string,
  change: { add?: readonly string[]; remove?: readonly string[] },
): Promise<void> {
  const response = await gmailFetch(accessToken, `/threads/${encodeURIComponent(threadId)}/modify`, {
    method: 'POST',
    body: JSON.stringify({ addLabelIds: change.add ?? [], removeLabelIds: change.remove ?? [] }),
  })
  if (!response.ok) throw new Error(await readGmailError(response))
}

export async function applyThreadAction(
  accessToken: string,
  threadId: string,
  action: ThreadAction,
): Promise<void> {
  if (action === 'trash' || action === 'untrash') {
    const response = await gmailFetch(accessToken, `/threads/${encodeURIComponent(threadId)}/${action}`, {
      method: 'POST',
    })
    if (!response.ok) throw new Error(await readGmailError(response))
    return
  }
  await modifyThread(accessToken, threadId, THREAD_ACTIONS[action])
}

/** Prefix for a small attachment Gmail returned inline: the id is its MIME part id. */
const INLINE_PART = 'part:'

export async function getAttachment(
  accessToken: string,
  messageId: string,
  attachmentId: string,
): Promise<Buffer> {
  if (attachmentId.startsWith(INLINE_PART)) {
    const partId = attachmentId.slice(INLINE_PART.length)
    const res = await gmailFetch(accessToken, `/messages/${encodeURIComponent(messageId)}?format=full`)
    if (!res.ok) throw new Error(await readGmailError(res))
    let data: string | undefined
    walk((await res.json()).payload, (part) => {
      if (part.partId === partId && part.filename) data = part.body?.data
    })
    if (data === undefined) throw new Error('Not found - attachment')
    return Buffer.from(data, 'base64url')
  }
  const response = await gmailFetch(
    accessToken,
    `/messages/${encodeURIComponent(messageId)}/attachments/${encodeURIComponent(attachmentId)}`,
  )
  if (!response.ok) throw new Error(await readGmailError(response))
  const data = await response.json()
  return Buffer.from(String(data?.data ?? '').replace(/-/g, '+').replace(/_/g, '/'), 'base64')
}

// ---------------------------------------------------------------------------
// composing
// ---------------------------------------------------------------------------

export interface OutgoingAttachment {
  filename: string
  mimeType: string
  /** Standard base64. */
  data: string
}

export interface OutgoingMail {
  to: string[]
  cc: string[]
  bcc: string[]
  subject: string
  body: string
  attachments: OutgoingAttachment[]
  /** Set when replying or forwarding inside a conversation. */
  threadId?: string
  inReplyTo?: string | null
  references?: string | null
}

function encodeHeader(value: string): string {
  if (/^[\x20-\x7E]*$/.test(value)) return value
  return `=?UTF-8?B?${Buffer.from(value, 'utf8').toString('base64')}?=`
}

/** Header values must not carry line breaks, or a field could inject its own headers. */
function oneLine(value: string): string {
  return value.replace(/[\r\n]+/g, ' ').trim()
}

function wrap76(base64: string): string {
  return base64.replace(/.{1,76}/g, '$&\r\n').trimEnd()
}

export function buildMime(from: string, mail: OutgoingMail): string {
  const headers = [`From: ${oneLine(from)}`, `To: ${mail.to.map(oneLine).join(', ')}`]
  if (mail.cc.length) headers.push(`Cc: ${mail.cc.map(oneLine).join(', ')}`)
  if (mail.bcc.length) headers.push(`Bcc: ${mail.bcc.map(oneLine).join(', ')}`)
  headers.push(`Subject: ${encodeHeader(oneLine(mail.subject))}`, 'MIME-Version: 1.0')
  if (mail.inReplyTo) {
    headers.push(`In-Reply-To: ${oneLine(mail.inReplyTo)}`)
    headers.push(`References: ${oneLine(mail.references || mail.inReplyTo)}`)
  }

  const textPart = [
    'Content-Type: text/plain; charset="UTF-8"',
    'Content-Transfer-Encoding: base64',
    '',
    wrap76(Buffer.from(mail.body, 'utf8').toString('base64')),
  ].join('\r\n')

  if (mail.attachments.length === 0) {
    return `${headers.join('\r\n')}\r\n${textPart}`
  }

  const boundary = `jms_${Date.now().toString(36)}_${Math.random().toString(36).slice(2)}`
  const parts = [textPart, ...mail.attachments.map((file) => {
    const name = encodeHeader(oneLine(file.filename).replace(/"/g, ''))
    return [
      `Content-Type: ${oneLine(file.mimeType)}; name="${name}"`,
      `Content-Disposition: attachment; filename="${name}"`,
      'Content-Transfer-Encoding: base64',
      '',
      wrap76(file.data.replace(/\s+/g, '')),
    ].join('\r\n')
  })]

  return [
    ...headers,
    `Content-Type: multipart/mixed; boundary="${boundary}"`,
    '',
    ...parts.map((part) => `--${boundary}\r\n${part}`),
    `--${boundary}--`,
  ].join('\r\n')
}

function toBase64Url(value: string): string {
  return Buffer.from(value, 'utf8').toString('base64').replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '')
}

export async function sendMail(accessToken: string, from: string, mail: OutgoingMail): Promise<string> {
  const response = await gmailFetch(accessToken, '/messages/send', {
    method: 'POST',
    body: JSON.stringify({ raw: toBase64Url(buildMime(from, mail)), threadId: mail.threadId }),
  })
  if (!response.ok) throw new Error(await readGmailError(response))
  const data = await response.json()
  return String(data?.id ?? '')
}

export async function saveDraft(accessToken: string, from: string, mail: OutgoingMail): Promise<string> {
  const response = await gmailFetch(accessToken, '/drafts', {
    method: 'POST',
    body: JSON.stringify({ message: { raw: toBase64Url(buildMime(from, mail)), threadId: mail.threadId } }),
  })
  if (!response.ok) throw new Error(await readGmailError(response))
  const data = await response.json()
  return String(data?.id ?? '')
}
