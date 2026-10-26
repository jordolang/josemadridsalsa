import type { GmailConnection } from '@prisma/client'
import { beforeEach, describe, expect, it, vi } from 'vitest'

import { shouldSkip, sweepMailbox } from '@/lib/inbox/triage'
import type { GmailMessage } from '@/lib/inbox/gmail'

const { prismaMock, gmailMock, classifyEmail } = vi.hoisted(() => ({
  prismaMock: {
    inboundEmail: {
      findMany: vi.fn(),
      create: vi.fn(),
      update: vi.fn(),
      findUniqueOrThrow: vi.fn(),
    },
    gmailConnection: { update: vi.fn() },
  },
  gmailMock: {
    getGmailAccessToken: vi.fn(),
    listMessages: vi.fn(),
    getMessage: vi.fn(),
    sendReply: vi.fn(),
    createDraft: vi.fn(),
    ensureLabel: vi.fn(),
    addLabel: vi.fn(),
    buildReplyMime: vi.fn(() => 'mime'),
    gmailThreadUrl: vi.fn(() => 'https://mail.google.com/'),
  },
  classifyEmail: vi.fn(),
}))

vi.mock('@/lib/prisma', () => ({ prisma: prismaMock, default: prismaMock }))
vi.mock('@/lib/inbox/gmail', () => gmailMock)
vi.mock('@/lib/inbox/classifier', () => ({ classifyEmail }))
vi.mock('@/lib/inbox/context', () => ({
  buildEmailContext: vi.fn(async () => ({ customer: null, orders: [], fundraiser: null })),
}))
vi.mock('@/lib/notifications/dispatch', () => ({ notifyOperators: vi.fn() }))

/**
 * The skip rules are what stop the automation talking to itself. A regression here is not
 * cosmetic: replying to our own reply is an unbounded loop that emails a customer forever.
 */

function message(overrides: Partial<GmailMessage> = {}): GmailMessage {
  return {
    id: 'm1',
    threadId: 't1',
    labelIds: ['INBOX'],
    snippet: '',
    fromEmail: 'jane@example.com',
    fromName: 'Jane',
    toEmail: 'mike@josemadridsalsa.com',
    subject: 'Hello',
    receivedAt: new Date(),
    body: 'Hi',
    rfcMessageId: '<a@mail>',
    references: null,
    ...overrides,
  }
}

const MAILBOX = 'mike@josemadridsalsa.com'

describe('shouldSkip', () => {
  it('triages an ordinary customer email', () => {
    expect(shouldSkip(message(), MAILBOX)).toBe(false)
  })

  it('skips our own mail, so the system cannot answer itself', () => {
    expect(shouldSkip(message({ fromEmail: MAILBOX }), MAILBOX)).toBe(true)
  })

  it('compares the mailbox case-insensitively', () => {
    expect(shouldSkip(message({ fromEmail: 'MIKE@josemadridsalsa.com' }), MAILBOX)).toBe(true)
    expect(shouldSkip(message(), 'MIKE@JOSEMADRIDSALSA.COM')).toBe(false)
  })

  it('skips anything already in Sent or Drafts', () => {
    expect(shouldSkip(message({ labelIds: ['SENT'] }), MAILBOX)).toBe(true)
    expect(shouldSkip(message({ labelIds: ['DRAFT'] }), MAILBOX)).toBe(true)
  })

  it.each([
    'no-reply@stripe.com',
    'noreply@shopify.com',
    'do-not-reply@ups.com',
    'MAILER-DAEMON@googlemail.com',
    'postmaster@example.com',
    'bounces@sendgrid.net',
    'notifications@github.com',
  ])('skips automated sender %s', (from) => {
    expect(shouldSkip(message({ fromEmail: from }), MAILBOX)).toBe(true)
  })

  it('does not skip a real person whose address merely contains "reply"', () => {
    expect(shouldSkip(message({ fromEmail: 'shelly.replogle@example.com' }), MAILBOX)).toBe(false)
  })

  it('skips a message with no parseable sender', () => {
    expect(shouldSkip(message({ fromEmail: '' }), MAILBOX)).toBe(true)
  })
})

/**
 * The sweep skips any message it already has a row for, so whatever the row says when it is
 * first written is what a person sees if the run stops there. An auto-reply must not be
 * recorded as answered before the send has happened.
 */
describe('sweepMailbox auto-replies', () => {
  const connection = {
    id: 'c1',
    mailbox: MAILBOX,
    searchQuery: 'in:inbox',
    autoReplyEnabled: true,
    autoReplyMinConfidence: 80,
  } as GmailConnection

  beforeEach(() => {
    vi.clearAllMocks()
    gmailMock.getGmailAccessToken.mockResolvedValue('token')
    gmailMock.listMessages.mockResolvedValue([{ id: 'm1' }])
    gmailMock.getMessage.mockResolvedValue(message())
    prismaMock.inboundEmail.findMany.mockResolvedValue([])
    prismaMock.inboundEmail.create.mockResolvedValue({ id: 'e1' })
    prismaMock.inboundEmail.findUniqueOrThrow.mockResolvedValue({
      id: 'e1',
      status: 'NEEDS_ACTION',
      fromEmail: 'jane@example.com',
      fromName: 'Jane',
      subject: 'Hello',
      summary: 'Asks about an order',
      gmailThreadId: 't1',
      steps: [],
    })
    prismaMock.gmailConnection.update.mockResolvedValue({})
    classifyEmail.mockResolvedValue({
      category: 'GENERAL_QUESTION',
      severity: 'LOW',
      confidence: 95,
      summary: 'Asks about an order',
      canAnswerWithoutHuman: true,
      replyBody: 'Thanks for writing!',
      actionSummary: null,
      steps: [],
    })
  })

  it('records the email as needing a person, with the reply, before sending', async () => {
    gmailMock.sendReply.mockImplementation(() => new Promise(() => {}))

    void sweepMailbox(connection)
    await vi.waitFor(() => expect(gmailMock.sendReply).toHaveBeenCalled())

    const { data } = prismaMock.inboundEmail.create.mock.calls[0][0]
    expect(data.status).toBe('NEEDS_ACTION')
    expect(data.draftedReply).toBe('Thanks for writing!')
    expect(data.steps.create).toHaveLength(1)
    expect(prismaMock.inboundEmail.update).not.toHaveBeenCalled()
  })

  it('marks it answered and clears the step once the send succeeds', async () => {
    gmailMock.sendReply.mockResolvedValue(undefined)

    await sweepMailbox(connection)

    const { data } = prismaMock.inboundEmail.update.mock.calls[0][0]
    expect(data).toMatchObject({
      status: 'AUTO_ANSWERED',
      draftedReply: null,
      steps: { deleteMany: {} },
      autoReplySent: true,
    })
  })

  it('leaves it needing a person when the send fails', async () => {
    gmailMock.sendReply.mockRejectedValue(new Error('Gmail down'))
    vi.spyOn(console, 'error').mockImplementation(() => {})

    await sweepMailbox(connection)

    expect(prismaMock.inboundEmail.create.mock.calls[0][0].data.status).toBe('NEEDS_ACTION')
    expect(prismaMock.inboundEmail.update).not.toHaveBeenCalledWith(
      expect.objectContaining({ data: expect.objectContaining({ status: 'AUTO_ANSWERED' }) }),
    )
  })
})
