import { beforeEach, describe, expect, it, vi } from 'vitest'

import { resolveRecipients, sendSolicitations } from '@/lib/fundraising/solicit'
import prisma from '@/lib/prisma'
import { sendEmail } from '@/lib/email/sender'

vi.mock('@/lib/prisma', () => {
  const client = {
    fundraiserContact: { findMany: vi.fn(), update: vi.fn() },
    fundraiserOutreachLog: { create: vi.fn() },
    emailSuppression: { findMany: vi.fn() },
    unsubscribePreference: { findMany: vi.fn() },
  }
  return { default: client, prisma: client }
})

vi.mock('@/lib/email/sender', () => ({ sendEmail: vi.fn() }))

const mockPrisma = prisma as unknown as {
  fundraiserContact: { findMany: ReturnType<typeof vi.fn>; update: ReturnType<typeof vi.fn> }
  fundraiserOutreachLog: { create: ReturnType<typeof vi.fn> }
  emailSuppression: { findMany: ReturnType<typeof vi.fn> }
  unsubscribePreference: { findMany: ReturnType<typeof vi.fn> }
}

function contact(overrides: Record<string, unknown> = {}) {
  return {
    id: 'c1',
    organizationName: 'Anderson HS Band',
    contactName: 'Pat Rivera',
    email: 'pat@anderson.org',
    totalJars: 1240,
    years: [2022, 2023],
    status: 'NEW',
    ...overrides,
  }
}

/** Statuses recorded on the outreach log, in call order. */
function loggedStatuses() {
  return mockPrisma.fundraiserOutreachLog.create.mock.calls.map(
    (call) => (call[0] as { data: { status: string } }).data.status,
  )
}

beforeEach(() => {
  vi.clearAllMocks()
  mockPrisma.fundraiserContact.update.mockResolvedValue({})
  mockPrisma.fundraiserOutreachLog.create.mockResolvedValue({})
  mockPrisma.emailSuppression.findMany.mockResolvedValue([])
  mockPrisma.unsubscribePreference.findMany.mockResolvedValue([])
  vi.mocked(sendEmail).mockResolvedValue({ success: true, messageId: 'msg_1' })
})

describe('sendSolicitations', () => {
  it('does nothing at all when given no contacts', async () => {
    const result = await sendSolicitations({ contactIds: [] })

    expect(result.attempted).toBe(0)
    expect(mockPrisma.fundraiserContact.findMany).not.toHaveBeenCalled()
    expect(sendEmail).not.toHaveBeenCalled()
  })

  it('only ever loads active contacts that are not marked do-not-contact', async () => {
    mockPrisma.fundraiserContact.findMany.mockResolvedValue([])
    await sendSolicitations({ contactIds: ['c1'] })

    const where = mockPrisma.fundraiserContact.findMany.mock.calls[0][0].where
    expect(where.isActive).toBe(true)
    expect(where.status).toEqual({ not: 'DO_NOT_CONTACT' })
  })

  it('sends and records a successful invitation', async () => {
    mockPrisma.fundraiserContact.findMany.mockResolvedValue([contact()])

    const result = await sendSolicitations({ contactIds: ['c1'], sentById: 'admin1' })

    expect(result.sent).toBe(1)
    expect(sendEmail).toHaveBeenCalledOnce()
    const sent = vi.mocked(sendEmail).mock.calls[0][0]
    expect(sent.to).toBe('pat@anderson.org')
    expect(sent.headers?.['List-Unsubscribe']).toContain('/unsubscribe')

    expect(loggedStatuses()).toEqual(['SENT'])
    expect(mockPrisma.fundraiserContact.update).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({
          solicitationCount: { increment: 1 },
          status: 'CONTACTED',
        }),
      }),
    )
  })

  it('does not downgrade a contact that already responded', async () => {
    mockPrisma.fundraiserContact.findMany.mockResolvedValue([contact({ status: 'RESPONDED' })])

    await sendSolicitations({ contactIds: ['c1'] })

    const data = mockPrisma.fundraiserContact.update.mock.calls[0][0].data
    expect(data.status).toBeUndefined()
  })

  it('skips a suppressed address without mailing it', async () => {
    mockPrisma.fundraiserContact.findMany.mockResolvedValue([contact()])
    mockPrisma.emailSuppression.findMany.mockResolvedValue([{ email: 'pat@anderson.org' }])

    const result = await sendSolicitations({ contactIds: ['c1'] })

    expect(result.skippedSuppressed).toBe(1)
    expect(result.sent).toBe(0)
    expect(sendEmail).not.toHaveBeenCalled()
    // Recorded, not silently dropped — otherwise a retry looks warranted.
    expect(loggedStatuses()).toEqual(['SKIPPED_SUPPRESSED'])
  })

  it('mails a coordinator who runs two groups only once', async () => {
    mockPrisma.fundraiserContact.findMany.mockResolvedValue([
      contact({ id: 'c1', organizationName: 'Avon HS Crew' }),
      contact({ id: 'c2', organizationName: 'Avon MS Choir' }),
    ])

    const result = await sendSolicitations({ contactIds: ['c1', 'c2'] })

    expect(result.sent).toBe(1)
    expect(result.skippedDuplicate).toBe(1)
    expect(sendEmail).toHaveBeenCalledOnce()
    // Skips are recorded up front, sends as they complete, so compare as a set.
    expect(loggedStatuses().sort()).toEqual(['SENT', 'SKIPPED_SUPPRESSED'])
  })

  it('matches addresses case-insensitively when deduplicating', async () => {
    mockPrisma.fundraiserContact.findMany.mockResolvedValue([
      contact({ id: 'c1', email: 'Pat@Anderson.org' }),
      contact({ id: 'c2', email: 'pat@anderson.org ' }),
    ])

    const result = await sendSolicitations({ contactIds: ['c1', 'c2'] })

    expect(result.sent).toBe(1)
    expect(result.skippedDuplicate).toBe(1)
  })

  it('records a contact with no address instead of trying to mail it', async () => {
    mockPrisma.fundraiserContact.findMany.mockResolvedValue([contact({ email: null })])

    const result = await sendSolicitations({ contactIds: ['c1'] })

    expect(result.skippedNoEmail).toBe(1)
    expect(sendEmail).not.toHaveBeenCalled()
    expect(loggedStatuses()).toEqual(['SKIPPED_NO_EMAIL'])
  })

  it('records a send failure with its reason and does not stamp the contact', async () => {
    mockPrisma.fundraiserContact.findMany.mockResolvedValue([contact()])
    vi.mocked(sendEmail).mockResolvedValue({ success: false, error: 'Mailbox full' })

    const result = await sendSolicitations({ contactIds: ['c1'] })

    expect(result.failed).toBe(1)
    expect(result.errors[0]).toMatchObject({
      organizationName: 'Anderson HS Band',
      error: 'Mailbox full',
    })
    expect(loggedStatuses()).toEqual(['FAILED'])
    expect(mockPrisma.fundraiserContact.update).not.toHaveBeenCalled()
  })

  it('counts selected contacts the eligibility query dropped', async () => {
    // Three ids asked for, one eligible row returned: the other two were inactive or
    // do-not-contact and never reach the loop.
    mockPrisma.fundraiserContact.findMany.mockResolvedValue([contact()])

    const result = await sendSolicitations({ contactIds: ['c1', 'c2', 'c3'] })

    expect(result.requested).toBe(3)
    expect(result.skippedIneligible).toBe(2)
    expect(result.sent).toBe(1)
  })

  it('writes no outreach rows at all on a dry run, including for skips', async () => {
    mockPrisma.fundraiserContact.findMany.mockResolvedValue([
      contact({ id: 'c1' }),
      contact({ id: 'c2', email: null }),
    ])

    await sendSolicitations({ contactIds: ['c1', 'c2'], dryRun: true })

    expect(mockPrisma.fundraiserOutreachLog.create).not.toHaveBeenCalled()
  })

  it('contacts no mail provider on a dry run', async () => {
    mockPrisma.fundraiserContact.findMany.mockResolvedValue([contact()])

    const result = await sendSolicitations({ contactIds: ['c1'], dryRun: true })

    expect(result.sent).toBe(1)
    expect(sendEmail).not.toHaveBeenCalled()
    expect(mockPrisma.fundraiserContact.update).not.toHaveBeenCalled()
  })

  it('keeps going when the outreach log write fails mid-batch', async () => {
    mockPrisma.fundraiserContact.findMany.mockResolvedValue([contact()])
    mockPrisma.fundraiserOutreachLog.create.mockRejectedValue(new Error('log table missing'))

    const result = await sendSolicitations({ contactIds: ['c1'] })

    expect(result.sent).toBe(1)
  })
})


describe('resolveRecipients', () => {
  it('collapses a coordinator who runs two organizations to one recipient', async () => {
    mockPrisma.fundraiserContact.findMany.mockResolvedValue([
      contact({ id: 'c1', organizationName: 'Avon HS Crew' }),
      contact({ id: 'c2', organizationName: 'Avon MS Choir' }),
    ])

    const resolution = await resolveRecipients(['c1', 'c2'])

    expect(resolution.recipients).toHaveLength(1)
    expect(resolution.skipped.filter((s) => s.reason === 'DUPLICATE')).toHaveLength(1)
  })

  it('resolves the whole selection at once, so chunked sends cannot duplicate an address', async () => {
    // The regression this exists for: with per-request dedup, c1 and c2 landing in different
    // send chunks would each be mailed. Resolution happens once, over every id, so the
    // duplicate is removed before any chunking occurs.
    mockPrisma.fundraiserContact.findMany.mockResolvedValue([
      contact({ id: 'c1', email: 'shared@example.com' }),
      contact({ id: 'c2', email: 'SHARED@example.com' }),
      contact({ id: 'c3', email: 'other@example.com' }),
    ])

    const resolution = await resolveRecipients(['c1', 'c2', 'c3'])
    const emails = resolution.recipients.map((r) => r.email)

    expect(new Set(emails).size).toBe(emails.length)
    expect(emails).toEqual(['shared@example.com', 'other@example.com'])
  })

  it('counts ids the eligibility query dropped', async () => {
    mockPrisma.fundraiserContact.findMany.mockResolvedValue([contact({ id: 'c1' })])

    const resolution = await resolveRecipients(['c1', 'c2', 'c3'])

    expect(resolution.requested).toBe(3)
    expect(resolution.skipped.filter((s) => s.reason === 'INELIGIBLE')).toHaveLength(2)
  })

  it('looks suppression up in batch rather than per address', async () => {
    mockPrisma.fundraiserContact.findMany.mockResolvedValue([
      contact({ id: 'c1', email: 'a@example.com' }),
      contact({ id: 'c2', email: 'b@example.com' }),
      contact({ id: 'c3', email: 'c@example.com' }),
    ])
    mockPrisma.emailSuppression.findMany.mockResolvedValue([{ email: 'b@example.com' }])
    mockPrisma.unsubscribePreference.findMany.mockResolvedValue([{ email: 'c@example.com' }])

    const resolution = await resolveRecipients(['c1', 'c2', 'c3'])

    expect(mockPrisma.emailSuppression.findMany).toHaveBeenCalledOnce()
    expect(mockPrisma.unsubscribePreference.findMany).toHaveBeenCalledOnce()
    expect(resolution.recipients.map((r) => r.email)).toEqual(['a@example.com'])
    expect(resolution.skipped.filter((s) => s.reason === 'SUPPRESSED')).toHaveLength(2)
  })

  it('keeps the same row of a duplicate pair on repeated resolutions', async () => {
    // The preflight and the send resolve separately; if they disagreed on which row to keep,
    // the ids handed back would not match the ids that get mailed.
    mockPrisma.fundraiserContact.findMany.mockResolvedValue([
      contact({ id: 'c1', email: 'shared@example.com' }),
      contact({ id: 'c2', email: 'shared@example.com' }),
    ])

    const first = await resolveRecipients(['c1', 'c2'])
    const second = await resolveRecipients(['c2', 'c1'])

    expect(first.recipients[0].contactId).toBe(second.recipients[0].contactId)
  })
})
