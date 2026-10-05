/**
 * Everything that has passed between the business and one customer, in one list.
 *
 * Orders, fundraisers, inbound email (with any automatic reply), every logged outbound email,
 * contact-form submissions, site messages, live chats and the admins' own notes all live in
 * different tables. The account page reads them here, joined on the customer's email (and on
 * their login where the table records one), and shows them newest first so nobody has to
 * check five screens to find out what a customer has been talking about.
 */

import { prisma } from '@/lib/prisma'

export type TimelineKind =
  | 'order'
  | 'fundraiser'
  | 'email_in'
  | 'email_out'
  | 'contact_form'
  | 'message'
  | 'live_chat'
  | 'note'

export interface TimelineEntry {
  /** Unique across kinds, for React keys. */
  key: string
  kind: TimelineKind
  at: Date
  title: string
  detail: string | null
  /** Short state label shown beside the title, e.g. an order status. */
  badge: string | null
  /** Where the full record lives in the admin, when it has a page of its own. */
  href: string | null
  /** Who wrote it, for notes. */
  author?: string | null
  /** The source row id, for notes, so they can be deleted from the timeline. */
  id?: string
}

/** Rows read per source. An account page, not an export. */
const PER_SOURCE = 50

const DETAIL_LENGTH = 400

function clip(text: string | null | undefined, length = DETAIL_LENGTH): string | null {
  if (!text) return null
  const flat = text.replace(/\s+/g, ' ').trim()
  if (!flat) return null
  return flat.length > length ? `${flat.slice(0, length - 1)}…` : flat
}

function humanise(value: string): string {
  const lower = value.toLowerCase().replace(/_/g, ' ')
  return lower.charAt(0).toUpperCase() + lower.slice(1)
}

function previewFrom(metadata: unknown): string | null {
  if (metadata && typeof metadata === 'object' && 'preview' in metadata) {
    const preview = (metadata as { preview?: unknown }).preview
    return typeof preview === 'string' ? preview : null
  }
  return null
}

/** Newest first; ties keep a stable order so the page does not reshuffle on refresh. */
export function sortTimeline(entries: TimelineEntry[]): TimelineEntry[] {
  return [...entries].sort((a, b) => b.at.getTime() - a.at.getTime() || a.key.localeCompare(b.key))
}

export interface TimelineSources {
  orders: Array<{
    id: string
    orderNumber: string
    status: string
    total: unknown
    createdAt: Date
    items: Array<{ productName: string; quantity: number }>
  }>
  fundraisers: Array<{
    id: string
    name: string
    organizationName: string
    status: string
    createdAt: Date
  }>
  inboundEmails: Array<{
    id: string
    subject: string
    summary: string
    snippet: string
    status: string
    receivedAt: Date
    autoReplySent: boolean
    autoReplyBody: string | null
    autoReplyAt: Date | null
  }>
  emailLogs: Array<{
    id: string
    subject: string
    status: string
    templateId: string | null
    createdAt: Date
    sentAt: Date | null
    metadata: unknown
  }>
  contactSubmissions: Array<{ id: string; subject: string; message: string; createdAt: Date }>
  conversations: Array<{
    id: string
    subject: string | null
    status: string
    createdAt: Date
    messages: Array<{ body: string }>
    _count: { messages: number }
  }>
  chatThreads: Array<{
    id: string
    status: string
    startedAt: Date
    messages: Array<{ content: string }>
    _count: { messages: number }
  }>
  notes: Array<{ id: string; body: string; authorName: string | null; createdAt: Date }>
}

/** Turn the raw rows into one ordered list. Pure, so it is tested without a database. */
export function buildTimeline(sources: TimelineSources): TimelineEntry[] {
  const entries: TimelineEntry[] = []

  for (const order of sources.orders) {
    entries.push({
      key: `order:${order.id}`,
      kind: 'order',
      at: order.createdAt,
      title: `Order ${order.orderNumber} placed · $${String(order.total)}`,
      detail: clip(order.items.map((item) => `${item.quantity}× ${item.productName}`).join(', ')),
      badge: humanise(order.status),
      href: `/admin/orders/${order.id}`,
    })
  }

  for (const fundraiser of sources.fundraisers) {
    entries.push({
      key: `fundraiser:${fundraiser.id}`,
      kind: 'fundraiser',
      at: fundraiser.createdAt,
      title: `Fundraiser started: ${fundraiser.name}`,
      detail: fundraiser.organizationName !== fundraiser.name ? fundraiser.organizationName : null,
      badge: humanise(fundraiser.status),
      href: `/admin/fundraisers/${fundraiser.id}`,
    })
  }

  for (const email of sources.inboundEmails) {
    entries.push({
      key: `email_in:${email.id}`,
      kind: 'email_in',
      at: email.receivedAt,
      title: `Email received: ${email.subject || '(no subject)'}`,
      detail: clip(email.summary || email.snippet),
      badge: humanise(email.status),
      href: `/admin/inbox/${email.id}`,
    })
    // The automatic answer is a message we sent, so it gets its own line at the time it went.
    if (email.autoReplySent && email.autoReplyAt) {
      entries.push({
        key: `email_auto:${email.id}`,
        kind: 'email_out',
        at: email.autoReplyAt,
        title: `Automatic reply sent: ${email.subject || '(no subject)'}`,
        detail: clip(email.autoReplyBody),
        badge: null,
        href: `/admin/inbox/${email.id}`,
      })
    }
  }

  for (const log of sources.emailLogs) {
    entries.push({
      key: `email_out:${log.id}`,
      kind: 'email_out',
      at: log.sentAt ?? log.createdAt,
      title: `Email sent: ${log.subject}`,
      detail: clip(previewFrom(log.metadata)),
      badge: log.status === 'SENT' ? (log.templateId ? humanise(log.templateId.replace(/-/g, '_')) : null) : humanise(log.status),
      href: null,
    })
  }

  for (const submission of sources.contactSubmissions) {
    entries.push({
      key: `contact:${submission.id}`,
      kind: 'contact_form',
      at: submission.createdAt,
      title: `Contact form: ${submission.subject}`,
      detail: clip(submission.message),
      badge: null,
      href: null,
    })
  }

  for (const conversation of sources.conversations) {
    const count = conversation._count.messages
    entries.push({
      key: `message:${conversation.id}`,
      kind: 'message',
      at: conversation.createdAt,
      title: `Message thread: ${conversation.subject || 'Website message'} (${count} message${count === 1 ? '' : 's'})`,
      detail: clip(conversation.messages[0]?.body),
      badge: humanise(conversation.status),
      href: `/admin/messages/${conversation.id}`,
    })
  }

  for (const thread of sources.chatThreads) {
    const count = thread._count.messages
    entries.push({
      key: `chat:${thread.id}`,
      kind: 'live_chat',
      at: thread.startedAt,
      title: `Live chat (${count} message${count === 1 ? '' : 's'})`,
      detail: clip(thread.messages[0]?.content),
      badge: humanise(thread.status),
      href: `/admin/messages/live/${thread.id}`,
    })
  }

  for (const note of sources.notes) {
    entries.push({
      key: `note:${note.id}`,
      kind: 'note',
      id: note.id,
      at: note.createdAt,
      title: 'Note',
      // Notes are written by staff for staff; show them whole.
      detail: note.body,
      badge: null,
      href: null,
      author: note.authorName,
    })
  }

  return sortTimeline(entries)
}

/** Read every source for one customer. Email matches ignore case; stored addresses vary. */
export async function getCustomerTimeline(customer: {
  id: string
  email: string
  userId: string | null
}): Promise<TimelineEntry[]> {
  const email = { equals: customer.email, mode: 'insensitive' as const }
  const byUser = customer.userId ? [{ userId: customer.userId }] : []

  const [
    orders,
    fundraisers,
    inboundEmails,
    emailLogs,
    contactSubmissions,
    conversations,
    chatThreads,
    notes,
  ] = await Promise.all([
    prisma.order.findMany({
      where: { OR: [{ guestEmail: email }, { user: { email } }, ...byUser] },
      select: {
        id: true,
        orderNumber: true,
        status: true,
        total: true,
        createdAt: true,
        items: { select: { productName: true, quantity: true } },
      },
      orderBy: { createdAt: 'desc' },
      take: PER_SOURCE,
    }),
    prisma.fundraiser.findMany({
      where: { contactEmail: email },
      select: { id: true, name: true, organizationName: true, status: true, createdAt: true },
      orderBy: { createdAt: 'desc' },
      take: PER_SOURCE,
    }),
    prisma.inboundEmail.findMany({
      where: { OR: [{ fromEmail: email }, { customerId: customer.id }] },
      select: {
        id: true,
        subject: true,
        summary: true,
        snippet: true,
        status: true,
        receivedAt: true,
        autoReplySent: true,
        autoReplyBody: true,
        autoReplyAt: true,
      },
      orderBy: { receivedAt: 'desc' },
      take: PER_SOURCE,
    }),
    prisma.emailLog.findMany({
      where: { OR: [{ recipientEmail: email }, ...byUser] },
      select: {
        id: true,
        subject: true,
        status: true,
        templateId: true,
        createdAt: true,
        sentAt: true,
        metadata: true,
      },
      orderBy: { createdAt: 'desc' },
      take: PER_SOURCE,
    }),
    prisma.contactSubmission.findMany({
      where: { email },
      select: { id: true, subject: true, message: true, createdAt: true },
      orderBy: { createdAt: 'desc' },
      take: PER_SOURCE,
    }),
    prisma.conversation.findMany({
      where: { OR: [{ email }, ...byUser] },
      select: {
        id: true,
        subject: true,
        status: true,
        createdAt: true,
        messages: { select: { body: true }, orderBy: { createdAt: 'asc' }, take: 1 },
        _count: { select: { messages: true } },
      },
      orderBy: { createdAt: 'desc' },
      take: PER_SOURCE,
    }),
    prisma.chatThread.findMany({
      where: {
        OR: [
          { customerEmail: email },
          ...(customer.userId ? [{ customerUserId: customer.userId }] : []),
        ],
      },
      select: {
        id: true,
        status: true,
        startedAt: true,
        messages: { select: { content: true }, orderBy: { createdAt: 'asc' }, take: 1 },
        _count: { select: { messages: true } },
      },
      orderBy: { startedAt: 'desc' },
      take: PER_SOURCE,
    }),
    prisma.customerNote.findMany({
      where: { customerId: customer.id },
      select: { id: true, body: true, authorName: true, createdAt: true },
      orderBy: { createdAt: 'desc' },
      take: 200,
    }),
  ])

  return buildTimeline({
    orders,
    fundraisers,
    inboundEmails,
    emailLogs,
    contactSubmissions,
    conversations,
    chatThreads,
    notes,
  })
}

/**
 * The Gmail search for every thread this address is on — mail they sent, mail sent to them,
 * and threads they were copied on. Covers what the triage never stores: replies typed by hand
 * in Gmail, and anything older than its sweep window. Characters Gmail treats as syntax are
 * dropped, so a stored address cannot widen the search.
 */
export function gmailQueryForAddress(address: string): string {
  const safe = address.trim().toLowerCase().replace(/[^a-z0-9@._+-]/g, '')
  return `{from:${safe} to:${safe} cc:${safe}}`
}
