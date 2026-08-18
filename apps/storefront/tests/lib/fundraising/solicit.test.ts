import { beforeEach, describe, expect, it, vi } from 'vitest'

import { sendSolicitations } from '@/lib/fundraising/solicit'
import prisma from '@/lib/prisma'
import { sendEmail } from '@/lib/email/sender'
import { checkSuppression } from '@/lib/email/suppression'

vi.mock('@/lib/prisma', () => {
  const client = {
    fundraiserContact: { findMany: vi.fn(), update: vi.fn() },
    fundraiserOutreachLog: { create: vi.fn() },
  }
  return { default: client, prisma: client }
})

vi.mock('@/lib/email/sender', () => ({ sendEmail: vi.fn() }))
vi.mock('@/lib/email/suppression', () => ({ checkSuppression: vi.fn() }))

const mockPrisma = prisma as unknown as {
  fundraiserContact: { findMany: ReturnType<typeof vi.fn>; update: ReturnType<typeof vi.fn> }
  fundraiserOutreachLog: { create: ReturnType<typeof vi.fn> }
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
  vi.mocked(checkSuppression).mockResolvedValue(false)
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
    vi.mocked(checkSuppression).mockResolvedValue(true)

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
    expect(loggedStatuses()).toEqual(['SENT', 'SKIPPED_SUPPRESSED'])
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
