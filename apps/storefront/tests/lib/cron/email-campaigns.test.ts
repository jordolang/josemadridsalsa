import { beforeEach, describe, expect, it, vi } from 'vitest'
import { NextRequest } from 'next/server'

/**
 * The campaign cron — the safety net under a send chain that continues itself.
 *
 * Nothing here sends email directly, which is exactly why it needs pinning: it decides which
 * campaigns are due, which recipients an interrupted run abandoned, and which chains to restart.
 * Each of those is a silent failure if it gets the boundary wrong — a scheduled campaign that
 * never starts, or a recipient left in SENDING forever, looks identical to "nothing to do".
 */

const campaignFindMany = vi.fn()
const campaignUpdate = vi.fn()
const recipientUpdateMany = vi.fn()
const triggerCampaignContinuation = vi.fn()
const isAuthorizedCronRequest = vi.fn()

vi.mock('@/lib/prisma', () => {
  const client = {
    emailCampaign: { findMany: campaignFindMany, update: campaignUpdate },
    emailRecipient: { updateMany: recipientUpdateMany },
  }
  return { prisma: client, default: client }
})

vi.mock('@/lib/email/queue', () => ({ triggerCampaignContinuation }))
vi.mock('@/lib/cron/auth', () => ({ isAuthorizedCronRequest }))

const { GET } = await import('@/app/api/cron/email-campaigns/route')

const NOW = new Date('2026-08-10T12:00:00Z')

function cronRequest() {
  return new NextRequest('http://localhost:3000/api/cron/email-campaigns')
}

/**
 * The route makes three `findMany` calls in a fixed order: SENDING campaigns, due SCHEDULED
 * campaigns, then campaigns with outstanding recipients.
 */
function queryResults({ sending = [], due = [], active = [] } = {}) {
  campaignFindMany
    .mockResolvedValueOnce(sending)
    .mockResolvedValueOnce(due)
    .mockResolvedValueOnce(active)
}

beforeEach(() => {
  vi.clearAllMocks()
  vi.useFakeTimers()
  vi.setSystemTime(NOW)
  isAuthorizedCronRequest.mockReturnValue(true)
  recipientUpdateMany.mockResolvedValue({ count: 0 })
  campaignUpdate.mockResolvedValue({})
  triggerCampaignContinuation.mockResolvedValue(undefined)
})

describe('GET /api/cron/email-campaigns', () => {
  it('refuses an unauthorised caller before touching any campaign', async () => {
    isAuthorizedCronRequest.mockReturnValue(false)

    const response = await GET(cronRequest())

    expect(response.status).toBe(401)
    expect(campaignFindMany).not.toHaveBeenCalled()
  })

  it('starts a scheduled campaign whose time has come', async () => {
    queryResults({ due: [{ id: 'camp_1', startedAt: null }] })

    const response = await GET(cronRequest())

    expect(campaignUpdate).toHaveBeenCalledWith({
      where: { id: 'camp_1' },
      data: { status: 'SENDING', startedAt: NOW },
    })
    await expect(response.json()).resolves.toMatchObject({ started: 1 })
  })

  it('asks only for campaigns already due, never ones scheduled ahead', async () => {
    queryResults({})

    await GET(cronRequest())

    // `lte: now` is the whole scheduling contract. Inverted, the cron would send every future
    // campaign at once.
    expect(campaignFindMany).toHaveBeenNthCalledWith(
      2,
      expect.objectContaining({
        where: { status: 'SCHEDULED', scheduledAt: { lte: NOW } },
      })
    )
  })

  it('keeps the original start time when restarting a campaign that already began', async () => {
    const startedAt = new Date('2026-08-10T11:00:00Z')
    queryResults({ due: [{ id: 'camp_1', startedAt }] })

    await GET(cronRequest())

    expect(campaignUpdate).toHaveBeenCalledWith({
      where: { id: 'camp_1' },
      data: { status: 'SENDING', startedAt },
    })
  })

  it('requeues recipients an interrupted run abandoned in SENDING', async () => {
    queryResults({ sending: [{ id: 'camp_1' }] })
    recipientUpdateMany.mockResolvedValue({ count: 3 })

    const response = await GET(cronRequest())

    expect(recipientUpdateMany).toHaveBeenCalledWith({
      where: {
        campaignId: { in: ['camp_1'] },
        status: 'SENDING',
        updatedAt: { lt: new Date(NOW.getTime() - 5 * 60 * 1000) },
      },
      data: { status: 'PENDING' },
    })
    await expect(response.json()).resolves.toMatchObject({ recovered: 3 })
  })

  it('leaves a recipient that is only just sending alone', async () => {
    queryResults({ sending: [{ id: 'camp_1' }] })

    await GET(cronRequest())

    // The cutoff is what separates "a live run is working on it" from "the run died". Without
    // it, this cron would requeue recipients mid-send and mail them twice.
    const cutoff = recipientUpdateMany.mock.calls[0][0].where.updatedAt.lt as Date
    expect(cutoff.getTime()).toBeLessThan(NOW.getTime())
  })

  it('does not query recipients when nothing is sending', async () => {
    queryResults({})

    const response = await GET(cronRequest())

    expect(recipientUpdateMany).not.toHaveBeenCalled()
    await expect(response.json()).resolves.toMatchObject({ recovered: 0 })
  })

  it('restarts the send chain for every campaign with outstanding recipients', async () => {
    queryResults({ active: [{ id: 'camp_1' }, { id: 'camp_2' }] })

    const response = await GET(cronRequest())

    expect(triggerCampaignContinuation).toHaveBeenCalledWith('camp_1')
    expect(triggerCampaignContinuation).toHaveBeenCalledWith('camp_2')
    await expect(response.json()).resolves.toMatchObject({ driven: 2 })
  })

  it('reports a failure instead of a success it did not achieve', async () => {
    campaignFindMany.mockRejectedValue(new Error('database unavailable'))

    const response = await GET(cronRequest())

    expect(response.status).toBe(500)
  })
})
