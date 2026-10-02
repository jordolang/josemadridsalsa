// @vitest-environment node
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

const { prismaMock } = vi.hoisted(() => ({
  prismaMock: { inboundEmail: { findMany: vi.fn() } },
}))
vi.mock('@/lib/prisma', () => ({ prisma: prismaMock }))
vi.mock('@/lib/inbox/triage', async () => {
  const actual = await vi.importActual<typeof import('@/lib/inbox/triage')>('@/lib/inbox/triage')
  return { shouldSkip: actual.shouldSkip }
})
vi.mock('@/lib/inbox/gmail', async () => {
  const actual = await vi.importActual<typeof import('@/lib/inbox/gmail')>('@/lib/inbox/gmail')
  return { ...actual, getGmailAccessToken: vi.fn().mockResolvedValue('tok') }
})

import { classifyMail, isOrganizeHour, organizeInbox } from '@/lib/inbox/organizer'

const base = { fromName: null, bulk: false }

describe('classifyMail', () => {
  it.each([
    [{ fromEmail: 'orders@josemadrid.net', subject: 'New Order #1042 - Jane Doe' }, 'Orders'],
    [{ fromEmail: 'noreply@josemadrid.net', subject: 'New Fundraiser Signup: Granville Band' }, 'Fundraisers'],
    [{ fromEmail: 'noreply@josemadrid.net', subject: 'FINAL fundraiser order: Granville — 120 jars' }, 'Fundraisers'],
    [{ fromEmail: 'noreply@josemadrid.net', subject: 'Contact form submission from Pat' }, 'Contact'],
    [{ fromEmail: 'buyer@grocer.com', subject: 'Wholesale pricing for our 3 stores' }, 'Wholesale'],
    [{ fromEmail: 'mcinfo@ups.com', subject: 'UPS Update: Package Scheduled for Delivery' }, 'Shipping'],
    [{ fromEmail: 'quickbooks@notification.intuit.com', subject: 'Your bill is ready' }, 'Finance'],
    [{ fromEmail: 'notifications@vercel.com', subject: 'Failed production deployment' }, 'Website'],
    [{ fromEmail: 'info@festivalnet.com', subject: 'New shows this week' }, 'Events & Shows'],
    [{ fromEmail: 'notification@facebookmail.com', subject: 'You have a new message' }, 'Marketing & Social'],
  ])('files %o into %s', (facts, folder) => {
    expect(classifyMail({ ...base, ...facts })).toBe(folder)
  })

  it('uses the triage category for customer mail', () => {
    expect(classifyMail({ ...base, fromEmail: 'pat@gmail.com', subject: 'quick question', category: 'FUNDRAISER' })).toBe('Fundraisers')
    expect(classifyMail({ ...base, fromEmail: 'pat@gmail.com', subject: 'hi', category: 'PRODUCT_QUESTION' })).toBe('Contact')
  })

  it('files unrecognised bulk mail as newsletters and leaves personal mail in the inbox', () => {
    expect(classifyMail({ ...base, fromEmail: 'news@somebrand.com', subject: 'Fall sale', bulk: true })).toBe('Newsletters')
    expect(classifyMail({ ...base, fromEmail: 'aunt.rosa@gmail.com', subject: 'Dinner Sunday?' })).toBeNull()
  })
})

describe('isOrganizeHour', () => {
  it('runs at 8am, noon and 5pm Eastern across daylight saving', () => {
    expect(isOrganizeHour(new Date('2026-07-01T12:00:00Z'))).toBe(true) // 8am EDT
    expect(isOrganizeHour(new Date('2026-07-01T13:00:00Z'))).toBe(false) // 9am EDT
    expect(isOrganizeHour(new Date('2026-12-01T13:00:00Z'))).toBe(true) // 8am EST
    expect(isOrganizeHour(new Date('2026-12-01T12:00:00Z'))).toBe(false) // 7am EST
    expect(isOrganizeHour(new Date('2026-07-01T16:00:00Z'))).toBe(true) // noon EDT
    expect(isOrganizeHour(new Date('2026-12-01T22:00:00Z'))).toBe(true) // 5pm EST
  })
})

describe('organizeInbox', () => {
  const connection = { id: 'c1', mailbox: 'mike@josemadridsalsa.com' } as never
  const old = String(Date.now() - 30 * 24 * 3600 * 1000)
  const recent = String(Date.now() - 3600 * 1000)
  const headers = (from: string, subject: string, extra: Array<{ name: string; value: string }> = []) => [
    { name: 'From', value: from },
    { name: 'Subject', value: subject },
    ...extra,
  ]
  const threads: Record<string, unknown> = {
    t1: { id: 't1', messages: [{ id: 'm1', labelIds: ['INBOX'], internalDate: old, payload: { headers: headers('orders@josemadrid.net', 'New Order #1') } }] },
    t2: { id: 't2', messages: [{ id: 'm2', labelIds: ['INBOX', 'STARRED'], internalDate: old, payload: { headers: headers('notifications@vercel.com', 'Deploy failed') } }] },
    t3: { id: 't3', messages: [{ id: 'm3', labelIds: ['INBOX'], internalDate: recent, payload: { headers: headers('Pat <pat@gmail.com>', 'Where is my order?') } }] },
    t4: { id: 't4', messages: [{ id: 'm4', labelIds: ['INBOX'], internalDate: old, payload: { headers: headers('aunt@gmail.com', 'Dinner') } }] },
    t5: { id: 't5', messages: [{ id: 'm5', labelIds: ['INBOX'], internalDate: recent, payload: { headers: headers('sam@gmail.com', 'Fundraiser help') } }] },
  }
  const modifies: Array<{ id: string; body: { addLabelIds: string[]; removeLabelIds: string[] } }> = []

  beforeEach(() => {
    modifies.length = 0
    prismaMock.inboundEmail.findMany.mockImplementation(async ({ where }: { where: { gmailMessageId: { in: string[] } } }) =>
      where.gmailMessageId.in.includes('m5')
        ? [{ gmailMessageId: 'm5', category: 'FUNDRAISER', status: 'NEEDS_ACTION' }]
        : [],
    )
    vi.stubGlobal('fetch', vi.fn(async (input: string, init?: RequestInit) => {
      const url = String(input)
      const json = (body: unknown) => new Response(JSON.stringify(body))
      if (url.endsWith('/labels') && init?.method === 'POST') {
        const { name } = JSON.parse(String(init.body))
        return json({ id: `L_${name}`, name })
      }
      if (url.endsWith('/labels')) return json({ labels: [{ id: 'Label_7', name: 'orders' }] })
      if (url.includes('/threads?')) return json({ threads: Object.keys(threads).map((id) => ({ id })) })
      const modify = url.match(/\/threads\/(\w+)\/modify$/)
      if (modify) {
        modifies.push({ id: modify[1], body: JSON.parse(String(init?.body)) })
        return json({})
      }
      const get = url.match(/\/threads\/(\w+)\?/)
      if (get) return json(threads[get[1]])
      return new Response('{}', { status: 404 })
    }))
  })
  afterEach(() => vi.unstubAllGlobals())

  it('files and archives, but keeps starred, awaiting-a-person and untriaged mail where it is seen', async () => {
    const result = await organizeInbox(connection)

    // Existing label is reused case-insensitively; the order is archived into it.
    expect(modifies.find((m) => m.id === 't1')?.body).toEqual({ addLabelIds: ['Label_7'], removeLabelIds: ['INBOX'] })
    // Starred: labelled, not archived.
    expect(modifies.find((m) => m.id === 't2')?.body).toEqual({ addLabelIds: ['L_Website'], removeLabelIds: [] })
    // Recent customer mail the triage has not read: untouched.
    expect(modifies.find((m) => m.id === 't3')).toBeUndefined()
    // Personal mail: untouched.
    expect(modifies.find((m) => m.id === 't4')).toBeUndefined()
    // Triage says a person still owes a reply: labelled, kept in the inbox.
    expect(modifies.find((m) => m.id === 't5')?.body).toEqual({ addLabelIds: ['L_Fundraisers'], removeLabelIds: [] })

    expect(result).toMatchObject({
      scanned: 5,
      filed: { Orders: 1, Website: 1, Fundraisers: 1 },
      keptInInbox: 2,
      leftForTriage: 1,
      unmatched: 1,
      errors: [],
    })
  })
})
