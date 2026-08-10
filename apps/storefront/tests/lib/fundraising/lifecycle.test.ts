import { beforeEach, describe, expect, it, vi } from 'vitest'

const findMany = vi.fn()
const updateMany = vi.fn()
const update = vi.fn()
const sendCampaignLaunchEmail = vi.fn()
const sendCampaignSummaryEmail = vi.fn()

vi.mock('@/lib/prisma', () => {
  const client = { fundraiser: { findMany, updateMany, update } }
  return { prisma: client, default: client }
})

vi.mock('@/lib/email/automation', () => ({ sendCampaignLaunchEmail, sendCampaignSummaryEmail }))

const {
  announceLaunchedCampaigns,
  endExpiredCampaigns,
  runFundraiserLifecycle,
  summariseEndedCampaigns,
} = await import('@/lib/fundraising/lifecycle')

const NOW = new Date('2026-08-10T12:00:00Z')

function campaign(overrides: Record<string, unknown> = {}) {
  return {
    id: 'f_1',
    name: 'Zanesville Band Drive',
    slug: 'zanesville-band',
    organizationName: 'Zanesville High Band',
    contactEmail: 'coordinator@example.com',
    startDate: new Date('2026-08-01T00:00:00Z'),
    endDate: new Date('2026-09-01T00:00:00Z'),
    goal: 2500,
    ...overrides,
  }
}

describe('announceLaunchedCampaigns', () => {
  beforeEach(() => {
    findMany.mockReset()
    update.mockReset()
    update.mockResolvedValue({})
    sendCampaignLaunchEmail.mockReset()
    sendCampaignLaunchEmail.mockResolvedValue({ success: true })
    vi.spyOn(console, 'warn').mockImplementation(() => {})
  })

  it('only looks at live campaigns that have opened and not been announced', async () => {
    findMany.mockResolvedValue([])

    await announceLaunchedCampaigns(NOW)

    expect(findMany.mock.calls[0][0].where).toEqual({
      status: 'ACTIVE',
      launchEmailSentAt: null,
      startDate: { lte: NOW },
    })
  })

  it('emails the coordinator with a link to the campaign', async () => {
    findMany.mockResolvedValue([campaign()])

    await announceLaunchedCampaigns(NOW)

    expect(sendCampaignLaunchEmail).toHaveBeenCalledWith(
      expect.objectContaining({
        email: 'coordinator@example.com',
        campaignName: 'Zanesville Band Drive',
        campaignUrl: expect.stringContaining('/fundraisers/zanesville-band'),
      })
    )
  })

  it('formats the goal as money, and omits it when there is none', async () => {
    findMany.mockResolvedValue([campaign()])
    await announceLaunchedCampaigns(NOW)
    expect(sendCampaignLaunchEmail.mock.calls[0][0].goalAmount).toBe('$2500.00')

    sendCampaignLaunchEmail.mockClear()
    findMany.mockResolvedValue([campaign({ goal: null })])
    await announceLaunchedCampaigns(NOW)
    expect(sendCampaignLaunchEmail.mock.calls[0][0].goalAmount).toBeUndefined()
  })

  it('stamps the marker only after the email is sent', async () => {
    const order: string[] = []
    findMany.mockResolvedValue([campaign()])
    sendCampaignLaunchEmail.mockImplementation(async () => {
      order.push('send')
      return { success: true }
    })
    update.mockImplementation(async () => {
      order.push('stamp')
      return {}
    })

    await announceLaunchedCampaigns(NOW)

    expect(order).toEqual(['send', 'stamp'])
  })

  it('leaves the marker unset when the send throws, so the next tick retries', async () => {
    findMany.mockResolvedValue([campaign()])
    sendCampaignLaunchEmail.mockRejectedValue(new Error('resend down'))

    const sent = await announceLaunchedCampaigns(NOW)

    expect(update).not.toHaveBeenCalled()
    expect(sent).toBe(0)
  })

  it('keeps going after one campaign fails', async () => {
    findMany.mockResolvedValue([campaign({ id: 'f_bad' }), campaign({ id: 'f_good' })])
    sendCampaignLaunchEmail
      .mockRejectedValueOnce(new Error('nope'))
      .mockResolvedValueOnce({ success: true })

    expect(await announceLaunchedCampaigns(NOW)).toBe(1)
  })
})

describe('endExpiredCampaigns', () => {
  beforeEach(() => {
    updateMany.mockReset()
    updateMany.mockResolvedValue({ count: 2 })
  })

  it('closes only live campaigns whose end date has passed', async () => {
    await endExpiredCampaigns(NOW)

    expect(updateMany).toHaveBeenCalledWith({
      where: { status: 'ACTIVE', endDate: { lt: NOW } },
      data: { status: 'ENDED', isActive: false },
    })
  })

  it('reports how many it closed', async () => {
    expect(await endExpiredCampaigns(NOW)).toBe(2)
  })
})

describe('summariseEndedCampaigns', () => {
  beforeEach(() => {
    findMany.mockReset()
    update.mockReset()
    update.mockResolvedValue({})
    sendCampaignSummaryEmail.mockReset()
    sendCampaignSummaryEmail.mockResolvedValue({ success: true })
    vi.spyOn(console, 'warn').mockImplementation(() => {})
  })

  it('picks up campaigns ended by hand as well as by the sweep', async () => {
    findMany.mockResolvedValue([])

    await summariseEndedCampaigns()

    // Keyed off the marker, not off who ended the campaign.
    expect(findMany.mock.calls[0][0].where).toEqual({
      status: 'ENDED',
      summaryEmailSentAt: null,
    })
  })

  it('stamps the marker after a successful send', async () => {
    findMany.mockResolvedValue([{ id: 'f_1' }])

    expect(await summariseEndedCampaigns()).toBe(1)
    expect(update).toHaveBeenCalledWith({
      where: { id: 'f_1' },
      data: { summaryEmailSentAt: expect.any(Date) },
    })
  })

  it('does not stamp when the sender reports failure by return value', async () => {
    findMany.mockResolvedValue([{ id: 'f_1' }])
    sendCampaignSummaryEmail.mockResolvedValue({ success: false, error: 'Coordinator email missing' })

    expect(await summariseEndedCampaigns()).toBe(0)
    expect(update).not.toHaveBeenCalled()
  })
})

describe('runFundraiserLifecycle', () => {
  beforeEach(() => {
    findMany.mockReset()
    findMany.mockResolvedValue([])
    updateMany.mockReset()
    updateMany.mockResolvedValue({ count: 0 })
    update.mockReset()
    sendCampaignLaunchEmail.mockReset()
    sendCampaignSummaryEmail.mockReset()
  })

  it('ends campaigns before summarising, so one expiring today is summarised today', async () => {
    const calls: string[] = []
    updateMany.mockImplementation(async () => {
      calls.push('end')
      return { count: 1 }
    })
    findMany.mockImplementation(async (args: { where: { status: string } }) => {
      calls.push(args.where.status === 'ENDED' ? 'summarise' : 'announce')
      return []
    })

    await runFundraiserLifecycle(NOW)

    expect(calls).toEqual(['announce', 'end', 'summarise'])
  })

  it('reports a tally for each stage', async () => {
    expect(await runFundraiserLifecycle(NOW)).toEqual({
      launched: 0,
      ended: 0,
      summarised: 0,
    })
  })
})
