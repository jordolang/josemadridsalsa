import { beforeEach, describe, expect, it, vi } from 'vitest'

/**
 * Both public signup forms record `newsletter.subscribed`, which the automation handler maps onto
 * the SUBSCRIPTION_CREATED trigger. Nothing is sent here; the welcome email is mocked.
 */

const emitDomainEvent = vi.fn()
const sendNewsletterWelcomeEmail = vi.fn()
const logEngagementRequest = vi.fn()
const subscriberUpsert = vi.fn()

vi.mock('@/lib/prisma', () => {
  const client = {
    mailingListSubscriber: { upsert: subscriberUpsert },
    blogSeries: { findUnique: vi.fn() },
  }
  return { prisma: client, default: client }
})
vi.mock('@/lib/domain-events/emit', () => ({ emitDomainEvent }))
vi.mock('@/lib/email/automation', () => ({ sendNewsletterWelcomeEmail }))
vi.mock('@/lib/engagements', () => ({ logEngagementRequest }))
vi.mock('@/lib/blog/publish', () => ({ getOrCreateMailingList: vi.fn(async () => 'list_1') }))

const { POST: newsletterPost } = await import('@/app/api/newsletter/route')
const { POST: heatIndexPost } = await import('@/app/api/heat-index/subscribe/route')

function post(url: string, body: Record<string, unknown>) {
  return new Request(url, {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify(body),
  })
}

beforeEach(() => {
  vi.clearAllMocks()
  sendNewsletterWelcomeEmail.mockResolvedValue({ success: true })
  logEngagementRequest.mockResolvedValue(undefined)
  subscriberUpsert.mockResolvedValue({})
})

describe('newsletter signups record the subscription fact', () => {
  it('from the footer form', async () => {
    const response = await newsletterPost(
      post('http://localhost:3000/api/newsletter', { email: 'Fan@Example.com', name: 'Fan' })
    )

    expect(response.status).toBe(200)
    expect(emitDomainEvent).toHaveBeenCalledWith({
      type: 'newsletter.subscribed',
      entityType: 'subscriber',
      entityId: 'fan@example.com',
      payload: { email: 'fan@example.com', firstName: 'Fan', source: 'footer:newsletter' },
    })
  })

  it('from the Heat Index form', async () => {
    const response = await heatIndexPost(
      post('http://localhost:3000/api/heat-index/subscribe', { email: 'Reader@Example.com' }) as never
    )

    expect(response.status).toBe(200)
    expect(emitDomainEvent).toHaveBeenCalledWith(
      expect.objectContaining({ type: 'newsletter.subscribed', entityId: 'reader@example.com' })
    )
  })

  it('records nothing for an invalid signup', async () => {
    await newsletterPost(post('http://localhost:3000/api/newsletter', { email: 'nope' }))

    expect(emitDomainEvent).not.toHaveBeenCalled()
  })
})
