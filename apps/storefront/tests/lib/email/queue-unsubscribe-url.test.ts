import { beforeEach, describe, expect, it, vi } from 'vitest'

/**
 * Campaign templates built on the shared footer print {{UNSUBSCRIBE_URL}}. The queue has to supply
 * it, or every campaign goes out with an empty unsubscribe link.
 */

const sendEmail = vi.fn()
const findFirst = vi.fn()

vi.mock('@/lib/prisma', () => {
  const client = {
    emailCampaign: {
      findUnique: vi.fn(async () => ({
        id: 'camp_1',
        status: 'SENDING',
        startedAt: new Date(),
        subject: 'Hello {{firstName}}',
        fromEmail: 'hi@example.com',
        fromName: 'Jose Madrid Salsa',
        configId: null,
        trackOpens: false,
        trackClicks: false,
        maxRetries: 3,
        template: {
          html: '<p>Hi {{firstName}}</p><a href="{{UNSUBSCRIBE_URL}}">Unsubscribe</a>',
        },
      })),
      update: vi.fn(async () => ({})),
      updateMany: vi.fn(async () => ({ count: 1 })),
    },
    emailRecipient: {
      findFirst,
      updateMany: vi.fn(async () => ({ count: 1 })),
      update: vi.fn(async () => ({})),
      count: vi.fn(async () => 0),
      groupBy: vi.fn(async () => []),
    },
    emailCampaignStats: { upsert: vi.fn(async () => ({})) },
  }
  return { prisma: client, default: client }
})
vi.mock('@/lib/email/sender', () => ({
  sendEmail,
  substituteVariables: (template: string, vars: Record<string, string>) =>
    template.replace(/{{(\w+)}}/g, (_m, key: string) => vars[key] ?? ''),
}))
vi.mock('@/lib/email/suppression', () => ({ checkSuppression: vi.fn(async () => false) }))

const { processCampaign } = await import('@/lib/email/queue')

beforeEach(() => {
  vi.clearAllMocks()
  sendEmail.mockResolvedValue({ success: true })
  findFirst
    .mockResolvedValueOnce({
      id: 'rcpt_1',
      email: 'fan@example.com',
      name: 'Pat Fan',
      variables: {},
      retryCount: 0,
    })
    .mockResolvedValue(null)
})

describe('processCampaign', () => {
  it('fills the footer unsubscribe link for each recipient', async () => {
    await processCampaign({ campaignId: 'camp_1', sendDelayMs: 0 })

    expect(sendEmail).toHaveBeenCalledTimes(1)
    const { html } = sendEmail.mock.calls[0][0] as { html: string }
    expect(html).toContain('Hi Pat')
    expect(html).toMatch(/href="[^"]*\/unsubscribe\?email=fan%40example\.com&token=[0-9a-f]{32}"/)
  })
})
