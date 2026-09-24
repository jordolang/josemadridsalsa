import { describe, expect, it } from 'vitest'

import { shouldSkip } from '@/lib/inbox/triage'
import type { GmailMessage } from '@/lib/inbox/gmail'

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
