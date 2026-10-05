import { describe, expect, it } from 'vitest'

import {
  buildTimeline,
  gmailQueryForAddress,
  sortTimeline,
  type TimelineSources,
} from '@/lib/customers/communications'

function empty(): TimelineSources {
  return {
    orders: [],
    fundraisers: [],
    inboundEmails: [],
    emailLogs: [],
    contactSubmissions: [],
    conversations: [],
    chatThreads: [],
    notes: [],
  }
}

const at = (iso: string) => new Date(iso)

describe('buildTimeline', () => {
  it('puts every source on one list, newest first', () => {
    const timeline = buildTimeline({
      ...empty(),
      orders: [
        {
          id: 'o1',
          orderNumber: 'JMS-1001',
          status: 'PROCESSING',
          total: '24.00',
          createdAt: at('2026-09-01T10:00:00Z'),
          items: [{ productName: 'Hot Salsa', quantity: 2 }],
        },
      ],
      inboundEmails: [
        {
          id: 'e1',
          subject: 'Where is my order?',
          summary: 'Asking when JMS-1001 ships',
          snippet: 'Hi there',
          status: 'NEEDS_ACTION',
          receivedAt: at('2026-09-05T09:00:00Z'),
          autoReplySent: false,
          autoReplyBody: null,
          autoReplyAt: null,
        },
      ],
      notes: [
        { id: 'n1', body: 'Called them back', authorName: 'Mike', createdAt: at('2026-09-06T12:00:00Z') },
      ],
    })

    expect(timeline.map((entry) => entry.kind)).toEqual(['note', 'email_in', 'order'])
    expect(timeline[1]).toMatchObject({
      title: 'Email received: Where is my order?',
      detail: 'Asking when JMS-1001 ships',
      href: '/admin/inbox/e1',
      badge: 'Needs action',
    })
    expect(timeline[2]).toMatchObject({
      title: 'Order JMS-1001 placed · $24.00',
      detail: '2× Hot Salsa',
      href: '/admin/orders/o1',
    })
    expect(timeline[0]).toMatchObject({ id: 'n1', author: 'Mike', detail: 'Called them back' })
  })

  it('lists an automatic reply as its own outbound email at the time it was sent', () => {
    const timeline = buildTimeline({
      ...empty(),
      inboundEmails: [
        {
          id: 'e1',
          subject: 'Hours?',
          summary: 'Asks opening hours',
          snippet: '',
          status: 'AUTO_ANSWERED',
          receivedAt: at('2026-09-05T09:00:00Z'),
          autoReplySent: true,
          autoReplyBody: 'We are open 9 to 5.',
          autoReplyAt: at('2026-09-05T09:02:00Z'),
        },
      ],
    })

    expect(timeline).toHaveLength(2)
    expect(timeline[0]).toMatchObject({
      kind: 'email_out',
      title: 'Automatic reply sent: Hours?',
      detail: 'We are open 9 to 5.',
    })
  })

  it('shows the logged preview of a sent email and flags a failed one', () => {
    const timeline = buildTimeline({
      ...empty(),
      emailLogs: [
        {
          id: 'l1',
          subject: 'Your fundraiser kit',
          status: 'SENT',
          templateId: null,
          createdAt: at('2026-09-02T00:00:00Z'),
          sentAt: at('2026-09-02T00:00:01Z'),
          metadata: { preview: 'Here is everything you need' },
        },
        {
          id: 'l2',
          subject: 'Receipt',
          status: 'FAILED',
          templateId: 'order-confirmation',
          createdAt: at('2026-09-01T00:00:00Z'),
          sentAt: null,
          metadata: null,
        },
      ],
    })

    expect(timeline[0]).toMatchObject({ detail: 'Here is everything you need', badge: null })
    expect(timeline[1]).toMatchObject({ detail: null, badge: 'Failed' })
  })

  it('clips long message text but keeps notes whole', () => {
    const long = 'word '.repeat(200)
    const timeline = buildTimeline({
      ...empty(),
      contactSubmissions: [{ id: 'c1', subject: 'Hi', message: long, createdAt: at('2026-09-01T00:00:00Z') }],
      notes: [{ id: 'n1', body: long, authorName: null, createdAt: at('2026-09-01T00:00:00Z') }],
    })

    const contact = timeline.find((entry) => entry.kind === 'contact_form')!
    const note = timeline.find((entry) => entry.kind === 'note')!
    expect(contact.detail!.length).toBeLessThanOrEqual(400)
    expect(contact.detail!.endsWith('…')).toBe(true)
    expect(note.detail).toBe(long)
  })

  it('counts messages on site threads and live chats', () => {
    const timeline = buildTimeline({
      ...empty(),
      conversations: [
        {
          id: 'm1',
          subject: null,
          status: 'OPEN',
          createdAt: at('2026-09-01T00:00:00Z'),
          messages: [{ body: 'Do you ship to Canada?' }],
          _count: { messages: 3 },
        },
      ],
      chatThreads: [
        {
          id: 't1',
          status: 'CLOSED',
          startedAt: at('2026-09-02T00:00:00Z'),
          messages: [{ content: 'Hello' }],
          _count: { messages: 1 },
        },
      ],
    })

    expect(timeline[0]).toMatchObject({ title: 'Live chat (1 message)', href: '/admin/messages/live/t1' })
    expect(timeline[1]).toMatchObject({
      title: 'Message thread: Website message (3 messages)',
      detail: 'Do you ship to Canada?',
    })
  })
})

describe('sortTimeline', () => {
  it('breaks ties on the key so the order is stable', () => {
    const when = at('2026-09-01T00:00:00Z')
    const base = { at: when, title: '', detail: null, badge: null, href: null }
    const sorted = sortTimeline([
      { ...base, key: 'b', kind: 'note' },
      { ...base, key: 'a', kind: 'order' },
    ])
    expect(sorted.map((entry) => entry.key)).toEqual(['a', 'b'])
  })
})

describe('gmailQueryForAddress', () => {
  it('finds mail from, to and copied to the address', () => {
    expect(gmailQueryForAddress('Ana@Example.com')).toBe(
      '{from:ana@example.com to:ana@example.com cc:ana@example.com}',
    )
  })

  it('drops characters Gmail would read as search syntax', () => {
    expect(gmailQueryForAddress('a b}OR{x@y.com')).toBe('{from:aborx@y.com to:aborx@y.com cc:aborx@y.com}')
  })
})
