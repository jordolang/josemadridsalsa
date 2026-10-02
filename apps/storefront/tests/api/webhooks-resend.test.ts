import { beforeEach, describe, expect, it, vi } from 'vitest'
import { NextRequest } from 'next/server'

/**
 * The Resend webhook — the only thing that stops the platform emailing an address that rejects it.
 *
 * The distinction worth protecting is hard versus soft: a permanent bounce suppresses the address
 * for good, a temporary one (a full mailbox, a greylisting server) must not, or a customer is
 * silently dropped from every future email over a transient failure. A spam complaint is stronger
 * still — it suppresses *and* records an unsubscribe, because continuing to mail someone who
 * pressed "report spam" is how a sending domain gets blocked.
 */

const bounceCreate = vi.fn()
const emailLogUpdateMany = vi.fn()
const unsubscribeUpsert = vi.fn()
const addSuppression = vi.fn()

vi.mock('@/lib/prisma', () => {
  const client = {
    emailBounce: { create: bounceCreate },
    emailLog: { updateMany: emailLogUpdateMany },
    unsubscribePreference: { upsert: unsubscribeUpsert },
  }
  return { prisma: client, default: client }
})

vi.mock('@/lib/email/suppression', () => ({ addSuppression }))

// Without a configured secret the route parses the body directly, which is the path these tests
// drive. Signature verification is the SDK's job and is exercised by the branch below.
vi.mock('resend', () => ({
  Resend: class {
    webhooks = {
      verify: () => {
        throw new Error('invalid signature')
      },
    }
  },
}))

const { POST } = await import('@/app/api/webhooks/resend/route')

function webhook(body: unknown) {
  return new NextRequest('http://localhost:3000/api/webhooks/resend', {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify(body),
  })
}

beforeEach(() => {
  vi.clearAllMocks()
  delete process.env.RESEND_WEBHOOK_SECRET
})

describe('POST /api/webhooks/resend', () => {
  describe('bounces', () => {
    it('suppresses an address that bounced permanently', async () => {
      const response = await POST(
        webhook({
          type: 'email.bounced',
          data: { to: ['gone@example.com'], bounce: { type: 'Permanent', message: 'No such user' } },
        })
      )

      expect(response.status).toBe(200)
      expect(addSuppression).toHaveBeenCalledWith(
        'gone@example.com',
        'HARD_BOUNCE',
        'resend_webhook'
      )
      expect(bounceCreate).toHaveBeenCalledWith({
        data: { email: 'gone@example.com', bounceType: 'HARD', reason: 'No such user' },
      })
    })

    it('treats a lowercase permanent type as hard too', async () => {
      await POST(
        webhook({
          type: 'email.bounced',
          data: { to: ['gone@example.com'], bounce: { type: 'permanent', message: 'No such user' } },
        })
      )

      expect(addSuppression).toHaveBeenCalledWith('gone@example.com', 'HARD_BOUNCE', 'resend_webhook')
    })

    it('records a soft bounce without suppressing the address', async () => {
      await POST(
        webhook({
          type: 'email.bounced',
          data: { to: ['full@example.com'], bounce: { type: 'Transient', message: 'Mailbox full' } },
        })
      )

      // The whole point of the distinction: a full mailbox empties, and suppressing on it would
      // drop a real customer from every future email with nothing to indicate why.
      expect(bounceCreate).toHaveBeenCalledWith({
        data: { email: 'full@example.com', bounceType: 'SOFT', reason: 'Mailbox full' },
      })
      expect(addSuppression).not.toHaveBeenCalled()
    })

    it('still records a bounce that arrives without a reason', async () => {
      await POST(webhook({ type: 'email.bounced', data: { to: ['gone@example.com'] } }))

      expect(bounceCreate).toHaveBeenCalledWith({
        data: expect.objectContaining({ bounceType: 'SOFT', reason: 'Unknown bounce reason' }),
      })
    })

    it('marks the delivery log bounced', async () => {
      await POST(
        webhook({
          type: 'email.bounced',
          data: { to: ['gone@example.com'], bounce: { type: 'Permanent' } },
        })
      )

      expect(emailLogUpdateMany).toHaveBeenCalledWith(
        expect.objectContaining({ data: expect.objectContaining({ status: 'BOUNCED' }) })
      )
    })
  })

  describe('complaints', () => {
    it('suppresses and unsubscribes an address that reported spam', async () => {
      await POST(webhook({ type: 'email.complained', data: { to: ['Angry@Example.com'] } }))

      expect(addSuppression).toHaveBeenCalledWith(
        'Angry@Example.com',
        'SPAM_COMPLAINT',
        'resend_webhook'
      )
      // Normalised, so the preference matches however the address is later presented.
      expect(unsubscribeUpsert).toHaveBeenCalledWith(
        expect.objectContaining({ where: { email: 'angry@example.com' } })
      )
    })
  })

  describe('engagement', () => {
    it.each([
      ['email.delivered', 'SENT'],
      ['email.opened', 'OPENED'],
      ['email.clicked', 'CLICKED'],
    ])('advances the log to %s → %s', async (type, status) => {
      await POST(webhook({ type, data: { to: ['reader@example.com'] } }))

      expect(emailLogUpdateMany).toHaveBeenCalledWith(
        expect.objectContaining({ data: expect.objectContaining({ status }) })
      )
      expect(addSuppression).not.toHaveBeenCalled()
    })
  })

  describe('matching the message', () => {
    it('updates only the log for the message the event is about', async () => {
      await POST(webhook({ type: 'email.opened', data: { email_id: 're_123', to: ['reader@example.com'] } }))

      expect(emailLogUpdateMany).toHaveBeenCalledWith(
        expect.objectContaining({
          where: expect.objectContaining({ metadata: { path: ['messageId'], equals: 're_123' } }),
        })
      )
      expect(emailLogUpdateMany.mock.calls[0][0].where).not.toHaveProperty('recipientEmail')
    })
  })

  describe('malformed and hostile input', () => {
    it('reads the recipient from the `to` array Resend actually sends', async () => {
      await POST(
        webhook({
          type: 'email.complained',
          data: { to: ['first@example.com', 'second@example.com'] },
        })
      )

      expect(addSuppression).toHaveBeenCalledWith(
        'first@example.com',
        'SPAM_COMPLAINT',
        'resend_webhook'
      )
    })

    it('acknowledges an event with no recipient instead of retrying forever', async () => {
      const response = await POST(webhook({ type: 'email.bounced', data: {} }))

      expect(response.status).toBe(200)
      expect(bounceCreate).not.toHaveBeenCalled()
    })

    it('ignores an event type it does not handle', async () => {
      const response = await POST(
        webhook({ type: 'email.delivery_delayed', data: { to: ['slow@example.com'] } })
      )

      expect(response.status).toBe(200)
      expect(emailLogUpdateMany).not.toHaveBeenCalled()
    })

    it('rejects a payload whose signature does not verify', async () => {
      process.env.RESEND_WEBHOOK_SECRET = 'whsec_test'

      const response = await POST(
        webhook({ type: 'email.complained', data: { to: ['forged@example.com'] } })
      )

      // Suppression and unsubscribes are destructive to a mailing list, so an unverified caller
      // must not reach them.
      expect(response.status).toBe(401)
      expect(addSuppression).not.toHaveBeenCalled()
    })
  })
})
