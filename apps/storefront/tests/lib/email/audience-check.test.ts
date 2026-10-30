import { beforeEach, describe, expect, it, vi } from 'vitest'

const campaignFindUnique = vi.fn()
const campaignUpdate = vi.fn()
const recipientFindMany = vi.fn()
const recipientDeleteMany = vi.fn()
const recipientCount = vi.fn()
const auditFindFirst = vi.fn()
const auditCreate = vi.fn()
const loadOpenOrderEmails = vi.fn()

vi.mock('@/lib/prisma', () => {
  const client = {
    emailCampaign: { findUnique: campaignFindUnique, update: campaignUpdate },
    emailRecipient: { findMany: recipientFindMany, deleteMany: recipientDeleteMany, count: recipientCount },
    auditLog: { findFirst: auditFindFirst, create: auditCreate },
  }
  return { prisma: client, default: client }
})
vi.mock('@/lib/email/open-orders', () => ({
  isOpenOrdersListId: (id: string | null) => id === 'open-orders' || id === 'fundraising-open-orders',
  loadOpenOrderEmails,
  normalizeEmail: (e: string | null) => e?.trim().toLowerCase() || null,
}))

const {
  AUDIENCE_CONFIRMED_ACTION,
  AudienceCheckError,
  confirmAudience,
  getAudienceCheck,
  hasConfirmedAudience,
  isConfirmationCurrent,
  looksLikeOrderStatusUpdate,
  splitByOpenOrder,
} = await import('@/lib/email/audience-check')

const RECIPIENTS = [
  { id: 'r1', email: 'pat@example.com', name: 'Pat Fan' },
  { id: 'r2', email: 'NoOrder@example.com', name: 'No Order' },
  { id: 'r3', email: 'sam@example.com', name: null },
]

beforeEach(() => {
  vi.clearAllMocks()
  recipientFindMany.mockResolvedValue(RECIPIENTS)
  loadOpenOrderEmails.mockResolvedValue(new Set(['pat@example.com', 'sam@example.com']))
  recipientDeleteMany.mockImplementation(async ({ where }) => ({ count: where.id.in.length }))
  auditFindFirst.mockResolvedValue(null)
})

describe('looksLikeOrderStatusUpdate', () => {
  it('flags shipping and delivery updates', () => {
    expect(looksLikeOrderStatusUpdate('Thanks for your patience while we ship')).toBe(true)
    expect(looksLikeOrderStatusUpdate(null, 'Shipping delay notice')).toBe(true)
    expect(looksLikeOrderStatusUpdate('An update on your order')).toBe(true)
  })

  it('leaves ordinary marketing alone', () => {
    expect(looksLikeOrderStatusUpdate('Order now: new Cranberry Salsa')).toBe(false)
    expect(looksLikeOrderStatusUpdate('Holiday gift boxes')).toBe(false)
  })
})

describe('splitByOpenOrder', () => {
  it('matches addresses case-insensitively', () => {
    const { withOpenOrder, withoutOpenOrder } = splitByOpenOrder(
      [{ email: 'PAT@example.com' }, { email: 'x@example.com' }],
      new Set(['pat@example.com']),
    )
    expect(withOpenOrder).toEqual([{ email: 'PAT@example.com' }])
    expect(withoutOpenOrder).toEqual([{ email: 'x@example.com' }])
  })
})

describe('isConfirmationCurrent', () => {
  it('only accepts a confirmation of the current recipient count', () => {
    expect(isConfirmationCurrent({ recipientCount: 2 }, 2)).toBe(true)
    expect(isConfirmationCurrent({ recipientCount: 2 }, 3)).toBe(false)
    expect(isConfirmationCurrent({ recipientCount: 0 }, 0)).toBe(false)
    expect(isConfirmationCurrent(null, 2)).toBe(false)
  })
})

describe('hasConfirmedAudience', () => {
  it('reads the latest confirmation for the campaign', async () => {
    auditFindFirst.mockResolvedValue({ changes: { recipientCount: 1638 } })
    await expect(hasConfirmedAudience({ id: 'c1', totalRecipients: 1638 })).resolves.toBe(true)
    expect(auditFindFirst.mock.calls[0][0].where).toEqual({
      action: AUDIENCE_CONFIRMED_ACTION,
      entityType: 'email_campaign',
      entityId: 'c1',
    })
  })

  it('is false when nothing was confirmed', async () => {
    await expect(hasConfirmedAudience({ id: 'c1', totalRecipients: 5 })).resolves.toBe(false)
  })
})

describe('getAudienceCheck', () => {
  it('reports the count, a named-first sample and the open order split', async () => {
    campaignFindUnique.mockResolvedValue({
      id: 'c1',
      name: 'Thank you',
      subject: 'Thanks for your patience while orders ship',
      listId: 'all',
      totalRecipients: 3,
      list: { name: 'All Subscribers' },
    })

    const check = await getAudienceCheck('c1')

    expect(check).toMatchObject({
      recipientCount: 3,
      withOpenOrder: 2,
      withoutOpenOrder: 1,
      listName: 'All Subscribers',
      isOpenOrdersList: false,
      suggestOnlyOpenOrders: true,
      confirmed: false,
    })
    expect(check?.sample.map((s) => s.email)).toEqual([
      'pat@example.com',
      'NoOrder@example.com',
      'sam@example.com',
    ])
  })
})

describe('confirmAudience', () => {
  const draft = { id: 'c1', status: 'DRAFT', startedAt: null, totalRecipients: 3 }

  it('removes recipients without an open order and records the new count', async () => {
    campaignFindUnique.mockResolvedValue(draft)
    recipientCount.mockResolvedValueOnce(3).mockResolvedValueOnce(2)

    const result = await confirmAudience({
      campaignId: 'c1',
      userId: 'u1',
      expectedRecipients: 3,
      onlyOpenOrders: true,
    })

    expect(recipientDeleteMany).toHaveBeenCalledWith({
      where: { campaignId: 'c1', status: 'PENDING', id: { in: ['r2'] } },
    })
    expect(campaignUpdate).toHaveBeenCalledWith({ where: { id: 'c1' }, data: { totalRecipients: 2 } })
    expect(auditCreate.mock.calls[0][0].data).toMatchObject({
      userId: 'u1',
      action: AUDIENCE_CONFIRMED_ACTION,
      entityId: 'c1',
      changes: { recipientCount: 2, onlyOpenOrders: true, removedWithoutOpenOrder: 1 },
    })
    expect(result).toEqual({ recipientCount: 2, removed: 1 })
  })

  it('keeps everyone when the filter is off', async () => {
    campaignFindUnique.mockResolvedValue(draft)
    recipientCount.mockResolvedValue(3)

    await confirmAudience({ campaignId: 'c1', userId: 'u1', expectedRecipients: 3, onlyOpenOrders: false })

    expect(recipientDeleteMany).not.toHaveBeenCalled()
    expect(campaignUpdate).not.toHaveBeenCalled()
    expect(auditCreate.mock.calls[0][0].data.changes).toMatchObject({ recipientCount: 3 })
  })

  it('refuses a draft whose recipients were only half written', async () => {
    campaignFindUnique.mockResolvedValue(draft)
    recipientCount.mockResolvedValue(1)

    await expect(
      confirmAudience({ campaignId: 'c1', userId: 'u1', expectedRecipients: 1, onlyOpenOrders: false }),
    ).rejects.toThrow('1 of 3 recipients')
    expect(campaignUpdate).not.toHaveBeenCalled()
    expect(auditCreate).not.toHaveBeenCalled()
  })

  it('refuses when the audience changed since it was shown', async () => {
    campaignFindUnique.mockResolvedValue(draft)
    recipientCount.mockResolvedValue(3)

    await expect(
      confirmAudience({ campaignId: 'c1', userId: 'u1', expectedRecipients: 5, onlyOpenOrders: false }),
    ).rejects.toBeInstanceOf(AudienceCheckError)
    expect(auditCreate).not.toHaveBeenCalled()
  })

  it('refuses to filter down to nobody', async () => {
    campaignFindUnique.mockResolvedValue(draft)
    recipientCount.mockResolvedValue(3)
    loadOpenOrderEmails.mockResolvedValue(new Set())

    await expect(
      confirmAudience({ campaignId: 'c1', userId: 'u1', expectedRecipients: 3, onlyOpenOrders: true }),
    ).rejects.toThrow('Nobody on this campaign has an open order')
    expect(recipientDeleteMany).not.toHaveBeenCalled()
  })

  it('refuses a campaign that already started sending', async () => {
    campaignFindUnique.mockResolvedValue({ ...draft, status: 'SENDING', startedAt: new Date() })

    await expect(
      confirmAudience({ campaignId: 'c1', userId: 'u1', expectedRecipients: 3, onlyOpenOrders: false }),
    ).rejects.toBeInstanceOf(AudienceCheckError)
  })
})
