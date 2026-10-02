/**
 * Files the connected mailbox's inbox into labelled folders three times a day
 * (8am, noon and 5pm Eastern — see /api/cron/mail-organizer).
 *
 * Each conversation is sorted by its latest inbound message into one folder (a Gmail
 * label), then archived out of the inbox so the inbox holds only what is left: personal
 * mail and anything no rule recognises. Nothing is deleted; filing is a label change and
 * can be undone by moving a conversation back to the inbox.
 *
 * Kept in the inbox regardless:
 *  - starred conversations, which the owner has pinned there on purpose;
 *  - customer email the triage is still waiting on a person for (needs action / reply
 *    drafted / in progress) — it is labelled, but stays where it will be seen;
 *  - recent mail the triage has not read yet, so filing never hides a customer email from
 *    the triage sweep (which only reads the inbox). It is filed on a later run.
 */
import type { GmailConnection, InboundEmailCategory, InboundEmailStatus } from '@prisma/client'
import { prisma } from '@/lib/prisma'
import {
  getGmailAccessToken,
  gmailFetch,
  headerValue,
  parseAddress,
  readGmailError,
} from '@/lib/inbox/gmail'
import { shouldSkip } from '@/lib/inbox/triage'

export type MailFolder =
  | 'Orders'
  | 'Contact'
  | 'Fundraisers'
  | 'Wholesale'
  | 'Shipping'
  | 'Finance'
  | 'Website'
  | 'Events & Shows'
  | 'Marketing & Social'
  | 'Newsletters'

/** Folder → Gmail label colour (values from Gmail's fixed label palette). */
export const FOLDER_COLORS: Record<MailFolder, string> = {
  Orders: '#16a766',
  Contact: '#4a86e8',
  Fundraisers: '#ffad47',
  Wholesale: '#a479e2',
  Shipping: '#2da2bb',
  Finance: '#43d692',
  Website: '#e66550',
  'Events & Shows': '#fad165',
  'Marketing & Social': '#f691b3',
  Newsletters: '#b99aff',
}

export interface MailFacts {
  fromEmail: string
  fromName: string | null
  subject: string
  /** List-Id / List-Unsubscribe / Precedence: present on bulk and marketing mail. */
  bulk: boolean
  /** The triage's reading of this message, when it has one. */
  category?: InboundEmailCategory | null
}

type Rule = { folder: MailFolder; from?: RegExp; subject?: RegExp }

/**
 * First match wins, so the specific rules come before the broad ones: a "fundraiser order"
 * is a fundraiser, and a "payment received for order #12" is an order, not finance.
 */
const RULES: Rule[] = [
  { folder: 'Fundraisers', subject: /fundrais|campaign summary|booster|pto\b|pta\b/i, from: /fundrais/i },
  { folder: 'Contact', subject: /contact form|submitted the form|new contact|website inquiry|\[developer page\]/i },
  { folder: 'Wholesale', subject: /wholesale|distributor|purchase order|\bP\.?O\.? ?#|retail(er)? partner|on your shelves|vendor (setup|packet)/i },
  {
    folder: 'Orders',
    subject: /\bnew order\b|order #|order confirm|order placed|order received|for your order|has shipped|been delivered|refund processed|ready for pickup|payment received|you('|’)ve got (a )?(new )?(order|sale)|new sale/i,
  },
  {
    folder: 'Shipping',
    from: /@([a-z0-9-]+\.)*(ups|usps|fedex|dhl|easypost|shipstation|pirateship|stamps|shippo)\.com$/i,
    subject: /tracking|shipment|label created|out for delivery|delivery exception/i,
  },
  {
    folder: 'Finance',
    from: /@([a-z0-9-]+\.)*(intuit|quickbooks|chase|wellsfargo|bankofamerica|capitalone|americanexpress|amex|gusto|adp|irs|paychex|bill)\.(com|gov)$/i,
    subject: /invoice|statement|payout|deposit|receipt|bill (is )?(due|ready)|tax|1099|w-?9|payroll/i,
  },
  {
    folder: 'Website',
    from: /@([a-z0-9-]+\.)*(vercel|github|sentry\.io|supabase|neon\.tech|resend|cloudflare|godaddy|namecheap|bigcommerce|uploadthing|anthropic|google-?analytics|search-console|josemadrid\.net)/i,
    subject: /deploy|build (failed|succeeded)|search console|domain|ssl|certificate|dns|uptime|is down|low stock alert|security alert|api key/i,
  },
  {
    folder: 'Events & Shows',
    from: /festivalnet|eventeny|zapplication|eventbrite/i,
    subject: /festival|vendor application|booth|farmers'? market|craft show|street fair|expo\b/i,
  },
  {
    folder: 'Marketing & Social',
    from: /@([a-z0-9-]+\.)*(facebookmail|facebook|instagram|tiktok|linkedin|pinterest|twitter|x|youtube|canva|mailchimp|postiz)\.com$|businessprofile-noreply@google\.com/i,
  },
]

const CATEGORY_FOLDERS: Partial<Record<InboundEmailCategory, MailFolder>> = {
  ORDER_STATUS: 'Orders',
  SHIPPING_DELIVERY: 'Orders',
  RETURN_OR_DAMAGE: 'Orders',
  PAYMENT_OR_BILLING: 'Orders',
  FUNDRAISER: 'Fundraisers',
  WHOLESALE: 'Wholesale',
  PRODUCT_QUESTION: 'Contact',
  GENERAL_QUESTION: 'Contact',
}

/** The folder a message belongs in, or null to leave it in the inbox. */
export function classifyMail(facts: MailFacts): MailFolder | null {
  if (facts.category && CATEGORY_FOLDERS[facts.category]) return CATEGORY_FOLDERS[facts.category]!

  for (const rule of RULES) {
    const fromMatch = rule.from && (rule.from.test(facts.fromEmail) || rule.from.test(facts.fromName ?? ''))
    if (fromMatch || rule.subject?.test(facts.subject)) return rule.folder
  }

  return facts.bulk ? 'Newsletters' : null
}

const AWAITING_PERSON: InboundEmailStatus[] = ['NEEDS_ACTION', 'REPLY_DRAFTED', 'IN_PROGRESS']
const TRIAGE_WINDOW_MS = 7 * 24 * 60 * 60 * 1000
/** Enough for a day's mail; anything left over is still in the inbox for the next run. */
const MAX_THREADS_PER_RUN = 400

export interface OrganizeResult {
  scanned: number
  filed: Partial<Record<MailFolder, number>>
  keptInInbox: number
  leftForTriage: number
  unmatched: number
  errors: string[]
}

type RawThread = {
  id: string
  messages?: Array<{
    id: string
    labelIds?: string[]
    internalDate?: string
    payload?: { headers?: Array<{ name?: string; value?: string }> }
  }>
}

async function inboxThreadIds(accessToken: string): Promise<string[]> {
  const ids: string[] = []
  let pageToken: string | undefined
  do {
    const params = new URLSearchParams({ q: 'in:inbox -in:chats', maxResults: '100' })
    if (pageToken) params.set('pageToken', pageToken)
    const response = await gmailFetch(accessToken, `/threads?${params.toString()}`)
    if (!response.ok) throw new Error(await readGmailError(response))
    const data = await response.json()
    for (const thread of data?.threads ?? []) ids.push(thread.id)
    pageToken = data?.nextPageToken
  } while (pageToken && ids.length < MAX_THREADS_PER_RUN)
  return ids.slice(0, MAX_THREADS_PER_RUN)
}

async function ensureFolderLabels(accessToken: string): Promise<Record<MailFolder, string>> {
  const response = await gmailFetch(accessToken, '/labels')
  if (!response.ok) throw new Error(await readGmailError(response))
  const existing: Array<{ id: string; name: string }> = (await response.json())?.labels ?? []

  const ids = {} as Record<MailFolder, string>
  for (const folder of Object.keys(FOLDER_COLORS) as MailFolder[]) {
    const found = existing.find((label) => label.name.toLowerCase() === folder.toLowerCase())
    if (found) {
      ids[folder] = found.id
      continue
    }
    const base = { name: folder, labelListVisibility: 'labelShow', messageListVisibility: 'show' }
    let created = await gmailFetch(accessToken, '/labels', {
      method: 'POST',
      body: JSON.stringify({ ...base, color: { backgroundColor: FOLDER_COLORS[folder], textColor: '#ffffff' } }),
    })
    // A colour Gmail will not accept should not stop the folder existing.
    if (!created.ok) created = await gmailFetch(accessToken, '/labels', { method: 'POST', body: JSON.stringify(base) })
    if (!created.ok) throw new Error(`Could not create the "${folder}" label: ${await readGmailError(created)}`)
    ids[folder] = (await created.json()).id
  }
  return ids
}

export async function organizeInbox(connection: GmailConnection): Promise<OrganizeResult> {
  const result: OrganizeResult = { scanned: 0, filed: {}, keptInInbox: 0, leftForTriage: 0, unmatched: 0, errors: [] }
  const accessToken = await getGmailAccessToken(connection)
  const labels = await ensureFolderLabels(accessToken)
  const threadIds = await inboxThreadIds(accessToken)
  result.scanned = threadIds.length

  const metadata = new URLSearchParams({ format: 'metadata' })
  for (const header of ['From', 'Subject', 'List-Id', 'List-Unsubscribe', 'Precedence']) {
    metadata.append('metadataHeaders', header)
  }

  for (const threadId of threadIds) {
    try {
      const response = await gmailFetch(accessToken, `/threads/${threadId}?${metadata.toString()}`)
      if (!response.ok) throw new Error(await readGmailError(response))
      const thread = (await response.json()) as RawThread
      const messages = thread.messages ?? []

      const inbound = messages.filter((m) => {
        const from = parseAddress(headerValue(m.payload?.headers, 'From')).email
        return from && from !== connection.mailbox.toLowerCase()
      })
      const latest = inbound[inbound.length - 1] ?? messages[messages.length - 1]
      if (!latest) continue
      const headers = latest.payload?.headers
      const from = parseAddress(headerValue(headers, 'From'))

      const triaged = await prisma.inboundEmail.findMany({
        where: { gmailMessageId: { in: messages.map((m) => m.id) } },
        select: { gmailMessageId: true, category: true, status: true },
      })
      const triagedIds = new Set(triaged.map((row) => row.gmailMessageId))

      // Recent mail the triage would read but has not yet: leave it where the triage looks.
      const unread = inbound.some((m) => {
        const recent = Date.now() - Number(m.internalDate) < TRIAGE_WINDOW_MS
        const fromEmail = parseAddress(headerValue(m.payload?.headers, 'From')).email
        return (
          recent &&
          !triagedIds.has(m.id) &&
          !shouldSkip({ fromEmail, labelIds: m.labelIds ?? [] } as Parameters<typeof shouldSkip>[0], connection.mailbox)
        )
      })
      if (unread) {
        result.leftForTriage += 1
        continue
      }

      const latestTriage = triaged.find((row) => row.gmailMessageId === latest.id) ?? triaged[triaged.length - 1]
      const folder = classifyMail({
        fromEmail: from.email,
        fromName: from.name,
        subject: headerValue(headers, 'Subject') ?? '',
        bulk: Boolean(
          headerValue(headers, 'List-Id') ||
            headerValue(headers, 'List-Unsubscribe') ||
            /bulk|list/i.test(headerValue(headers, 'Precedence') ?? ''),
        ),
        category: latestTriage?.category,
      })
      if (!folder) {
        result.unmatched += 1
        continue
      }

      const pinned =
        messages.some((m) => m.labelIds?.includes('STARRED')) ||
        triaged.some((row) => AWAITING_PERSON.includes(row.status))

      const modify = await gmailFetch(accessToken, `/threads/${threadId}/modify`, {
        method: 'POST',
        body: JSON.stringify({ addLabelIds: [labels[folder]], removeLabelIds: pinned ? [] : ['INBOX'] }),
      })
      if (!modify.ok) throw new Error(await readGmailError(modify))

      result.filed[folder] = (result.filed[folder] ?? 0) + 1
      if (pinned) result.keptInInbox += 1
    } catch (error) {
      result.errors.push(`${threadId}: ${error instanceof Error ? error.message : String(error)}`)
    }
  }

  return result
}

/** The Eastern-time hours the organizer files at. */
export const ORGANIZE_HOURS_ET = [8, 12, 17]

/**
 * Whether a cron tick at `now` is one of the filing runs. Vercel schedules in UTC, so the
 * cron fires at both the EDT and EST hour for each slot and this keeps the one that is
 * actually 8am / noon / 5pm in Zanesville.
 */
export function isOrganizeHour(now: Date): boolean {
  const hour = Number(
    new Intl.DateTimeFormat('en-US', { timeZone: 'America/New_York', hour: 'numeric', hourCycle: 'h23' }).format(now),
  )
  return ORGANIZE_HOURS_ET.includes(hour)
}
