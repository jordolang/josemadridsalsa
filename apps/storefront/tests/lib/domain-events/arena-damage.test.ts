import { beforeEach, describe, expect, it, vi } from 'vitest'

const orderFindUnique = vi.fn()
const teamFindUnique = vi.fn()
const applyPurchaseDamage = vi.fn()

vi.mock('@/lib/prisma', () => {
  const client = {
    order: { findUnique: orderFindUnique },
    fundraiserTeam: { findUnique: teamFindUnique },
  }
  return { prisma: client, default: client }
})

vi.mock('@/lib/arena/damage', () => ({ applyPurchaseDamage }))

const { handleArenaDamage } = await import('@/lib/domain-events/handlers/arena-damage')

const event = {
  id: 'evt_1',
  type: 'payment.completed',
  entityType: 'order',
  entityId: 'order_1',
  payload: null,
  actorUserId: null,
  createdAt: new Date(),
}

const paidOrder = {
  id: 'order_1',
  subtotal: 60,
  discountAmount: 0,
  guestEmail: 'supporter@example.com',
  userId: null,
  fundraiserId: 'f_1',
  user: null,
}

beforeEach(() => {
  vi.clearAllMocks()
  applyPurchaseDamage.mockResolvedValue({ saleEventId: 'se_1', damagedTeams: [] })
})

describe('handleArenaDamage', () => {
  it('deals damage for a paid order placed in an arena team store', async () => {
    orderFindUnique.mockResolvedValue(paidOrder)
    teamFindUnique.mockResolvedValue({ id: 'team_1', status: 'ACTIVE' })

    await handleArenaDamage(event)

    expect(applyPurchaseDamage).toHaveBeenCalledWith(
      expect.objectContaining({ sellingTeamId: 'team_1', saleAmount: 60, orderId: 'order_1' })
    )
  })

  it('sizes damage on merchandise, not on freight and tax', async () => {
    // The same base commission is taken from. Otherwise a supporter in a high-tax state, or
    // one who paid more to ship, would swing a battle harder for the same salsa.
    orderFindUnique.mockResolvedValue({ ...paidOrder, subtotal: 60, discountAmount: 10 })
    teamFindUnique.mockResolvedValue({ id: 'team_1', status: 'ACTIVE' })

    await handleArenaDamage(event)

    expect(applyPurchaseDamage).toHaveBeenCalledWith(
      expect.objectContaining({ saleAmount: 50 })
    )
  })

  it('keys damage on the order so a replayed event cannot strike twice', async () => {
    // Domain events are delivered at least once; `FundraiserSaleEvent.orderId` is unique, so
    // passing the order id makes the second delivery an idempotent hit.
    orderFindUnique.mockResolvedValue(paidOrder)
    teamFindUnique.mockResolvedValue({ id: 'team_1', status: 'ACTIVE' })

    await handleArenaDamage(event)
    await handleArenaDamage(event)

    for (const call of applyPurchaseDamage.mock.calls) {
      expect(call[0].orderId).toBe('order_1')
    }
  })

  it('ignores an ordinary retail order', async () => {
    orderFindUnique.mockResolvedValue({ ...paidOrder, fundraiserId: null })

    await handleArenaDamage(event)

    expect(teamFindUnique).not.toHaveBeenCalled()
    expect(applyPurchaseDamage).not.toHaveBeenCalled()
  })

  it('ignores a campaign that is not in the arena', async () => {
    orderFindUnique.mockResolvedValue(paidOrder)
    teamFindUnique.mockResolvedValue(null)

    await handleArenaDamage(event)

    expect(applyPurchaseDamage).not.toHaveBeenCalled()
  })

  it('ignores a team that is no longer active', async () => {
    orderFindUnique.mockResolvedValue(paidOrder)
    teamFindUnique.mockResolvedValue({ id: 'team_1', status: 'ARCHIVED' })

    await handleArenaDamage(event)

    expect(applyPurchaseDamage).not.toHaveBeenCalled()
  })

  it('deals no damage for an order fully covered by a discount', async () => {
    orderFindUnique.mockResolvedValue({ ...paidOrder, subtotal: 20, discountAmount: 20 })
    teamFindUnique.mockResolvedValue({ id: 'team_1', status: 'ACTIVE' })

    await handleArenaDamage(event)

    expect(applyPurchaseDamage).not.toHaveBeenCalled()
  })

  it('finds the team through the campaign the order was placed in', async () => {
    orderFindUnique.mockResolvedValue(paidOrder)
    teamFindUnique.mockResolvedValue({ id: 'team_1', status: 'ACTIVE' })

    await handleArenaDamage(event)

    // Keyed on the relation, not on a matching slug — that pairing is what this unification
    // made real.
    expect(teamFindUnique).toHaveBeenCalledWith(
      expect.objectContaining({ where: { fundraiserId: 'f_1' } })
    )
  })
})
