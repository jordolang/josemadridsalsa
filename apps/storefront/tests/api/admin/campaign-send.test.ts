import { beforeEach, describe, expect, it, vi } from 'vitest'
import { NextRequest } from 'next/server'

/**
 * POST /api/admin/campaigns/[id]/send must not start a first send whose
 * audience nobody reviewed (regression: the Oct 28 thank-you email reached
 * people with no order).
 */

const campaignFindUnique = vi.fn()
const campaignUpdate = vi.fn()
const recipientUpdateMany = vi.fn()
const hasConfirmedAudience = vi.fn()
const triggerCampaignContinuation = vi.fn()

vi.mock('@/lib/prisma', () => {
  const client = {
    emailCampaign: { findUnique: campaignFindUnique, update: campaignUpdate },
    emailRecipient: { updateMany: recipientUpdateMany },
  }
  return { prisma: client, default: client }
})
vi.mock('@/lib/rbac', () => ({
  getCurrentUser: vi.fn(async () => ({ id: 'user-1' })),
  hasPermission: vi.fn(async () => true),
}))
vi.mock('@/lib/audit', () => ({ logAuditWithRequest: vi.fn(async () => undefined) }))
vi.mock('@/lib/email/queue', () => ({ triggerCampaignContinuation }))
vi.mock('@/lib/email/audience-check', () => ({
  hasConfirmedAudience,
  AUDIENCE_NOT_CONFIRMED_MESSAGE: 'Review the audience before sending',
}))

const { POST } = await import('@/app/api/admin/campaigns/[id]/send/route')

function send() {
  return POST(new NextRequest('http://localhost/api/admin/campaigns/c1/send', { method: 'POST' }), {
    params: Promise.resolve({ id: 'c1' }),
  })
}

beforeEach(() => {
  vi.clearAllMocks()
  campaignUpdate.mockResolvedValue({})
  recipientUpdateMany.mockResolvedValue({ count: 0 })
})

describe('POST /api/admin/campaigns/[id]/send', () => {
  it('refuses a first send without a confirmed audience', async () => {
    campaignFindUnique.mockResolvedValue({ id: 'c1', status: 'DRAFT', startedAt: null, totalRecipients: 10 })
    hasConfirmedAudience.mockResolvedValue(false)

    const response = await send()

    expect(response.status).toBe(409)
    expect(campaignUpdate).not.toHaveBeenCalled()
    expect(triggerCampaignContinuation).not.toHaveBeenCalled()
  })

  it('sends once the audience is confirmed', async () => {
    campaignFindUnique.mockResolvedValue({ id: 'c1', status: 'DRAFT', startedAt: null, totalRecipients: 10 })
    hasConfirmedAudience.mockResolvedValue(true)

    const response = await send()

    expect(response.status).toBe(200)
    expect(triggerCampaignContinuation).toHaveBeenCalledWith('c1')
  })

  it('resumes a paused campaign that already started without asking again', async () => {
    campaignFindUnique.mockResolvedValue({
      id: 'c1',
      status: 'PAUSED',
      startedAt: new Date('2026-10-28T17:16:00Z'),
      totalRecipients: 10,
    })

    const response = await send()

    expect(response.status).toBe(200)
    expect(hasConfirmedAudience).not.toHaveBeenCalled()
  })
})
