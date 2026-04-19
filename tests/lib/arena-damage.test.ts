import { beforeEach, describe, expect, it, vi } from 'vitest'

// Build a fake Prisma transaction client that records the operations called
// on it so the test can assert them without a real database. Each test
// swaps in its own bag of fixture responses.
type FakeTx = {
  fundraiserTeam: {
    findUnique: ReturnType<typeof vi.fn>
    findMany: ReturnType<typeof vi.fn>
    update: ReturnType<typeof vi.fn>
  }
  fundraiserSaleEvent: {
    findUnique: ReturnType<typeof vi.fn>
    create: ReturnType<typeof vi.fn>
  }
  fundraiserShield: {
    update: ReturnType<typeof vi.fn>
  }
}

function fakeTx(): FakeTx {
  return {
    fundraiserTeam: {
      findUnique: vi.fn(),
      findMany: vi.fn(),
      update: vi.fn().mockResolvedValue({}),
    },
    fundraiserSaleEvent: {
      findUnique: vi.fn(),
      create: vi.fn(),
    },
    fundraiserShield: {
      update: vi.fn().mockResolvedValue({}),
    },
  }
}

let currentTx: FakeTx = fakeTx()

vi.mock('@/lib/prisma', () => ({
  prisma: {
    $transaction: vi.fn((callback: (tx: FakeTx) => unknown) =>
      callback(currentTx),
    ),
  },
}))

async function getApply() {
  const mod = await import('@/lib/arena/damage')
  return mod.applyPurchaseDamage
}

describe('arena/damage — applyPurchaseDamage', () => {
  beforeEach(() => {
    currentTx = fakeTx()
  })

  it('rejects when the selling team is not ACTIVE', async () => {
    currentTx.fundraiserTeam.findUnique.mockResolvedValue(null)
    const apply = await getApply()
    await expect(
      apply({ sellingTeamId: 'team_missing', saleAmount: 25 }),
    ).rejects.toThrow(/selling team not found or not ACTIVE/)
  })

  it('returns idempotentHit when the orderId already has a sale event', async () => {
    currentTx.fundraiserTeam.findUnique.mockResolvedValue({
      id: 'team_a',
      activePeriod: '2026-04',
      status: 'ACTIVE',
    })
    currentTx.fundraiserSaleEvent.findUnique.mockResolvedValue({
      id: 'sale_existing',
    })

    const apply = await getApply()
    const result = await apply({
      sellingTeamId: 'team_a',
      saleAmount: 50,
      orderId: 'ord_123',
    })

    expect(result).toEqual({
      saleEventId: 'sale_existing',
      sellingTeamId: 'team_a',
      totalDamageDealt: 0,
      damagedTeams: [],
      idempotentHit: true,
    })
    // On idempotent hits we must NOT touch opponents or increment salesCount.
    expect(currentTx.fundraiserSaleEvent.create).not.toHaveBeenCalled()
    expect(currentTx.fundraiserTeam.update).not.toHaveBeenCalled()
    expect(currentTx.fundraiserShield.update).not.toHaveBeenCalled()
  })

  it('damages unshielded opponents, floors HP at zero, and increments salesCount', async () => {
    currentTx.fundraiserTeam.findUnique.mockResolvedValue({
      id: 'team_seller',
      activePeriod: '2026-04',
      status: 'ACTIVE',
    })
    currentTx.fundraiserSaleEvent.findUnique.mockResolvedValue(null)
    currentTx.fundraiserSaleEvent.create.mockResolvedValue({
      id: 'sale_new',
    })
    currentTx.fundraiserTeam.findMany.mockResolvedValue([
      { id: 'team_opp_weak', hpCurrent: 20, shields: [] },
      { id: 'team_opp_full', hpCurrent: 500, shields: [] },
    ])

    const apply = await getApply()
    const result = await apply({
      sellingTeamId: 'team_seller',
      saleAmount: 100,
    })

    expect(result.saleEventId).toBe('sale_new')
    expect(result.totalDamageDealt).toBe(200)

    const damagedIds = result.damagedTeams.map((t) => t.teamId).sort()
    expect(damagedIds).toEqual(['team_opp_full', 'team_opp_weak'])

    const weak = result.damagedTeams.find((t) => t.teamId === 'team_opp_weak')!
    expect(weak.damageToHP).toBe(100)
    expect(weak.shieldAbsorbed).toBe(0)
    expect(weak.hpAfter).toBe(0) // floored

    const full = result.damagedTeams.find((t) => t.teamId === 'team_opp_full')!
    expect(full.hpAfter).toBe(400)

    // Seller salesCount++ + two opponent HP writes = 3 team updates.
    expect(currentTx.fundraiserTeam.update).toHaveBeenCalledTimes(3)
    expect(currentTx.fundraiserTeam.update).toHaveBeenCalledWith({
      where: { id: 'team_seller' },
      data: { salesCount: { increment: 1 } },
    })
    // No shield writes when no opponent had a shield.
    expect(currentTx.fundraiserShield.update).not.toHaveBeenCalled()
  })

  it('routes damage through an active shield, overflows onto HP', async () => {
    const future = new Date(Date.now() + 60_000)
    currentTx.fundraiserTeam.findUnique.mockResolvedValue({
      id: 'team_seller',
      activePeriod: '2026-04',
      status: 'ACTIVE',
    })
    currentTx.fundraiserSaleEvent.findUnique.mockResolvedValue(null)
    currentTx.fundraiserSaleEvent.create.mockResolvedValue({ id: 'sale_x' })
    currentTx.fundraiserTeam.findMany.mockResolvedValue([
      {
        id: 'team_shielded',
        hpCurrent: 1000,
        shields: [
          { id: 'shield_1', expiresAt: future, remainingHP: 30 },
        ],
      },
    ])

    const apply = await getApply()
    const result = await apply({
      sellingTeamId: 'team_seller',
      saleAmount: 50,
    })

    const hit = result.damagedTeams[0]!
    expect(hit.teamId).toBe('team_shielded')
    expect(hit.shieldAbsorbed).toBe(30)
    expect(hit.damageToHP).toBe(20)
    expect(hit.hpAfter).toBe(980)

    expect(currentTx.fundraiserShield.update).toHaveBeenCalledWith({
      where: { id: 'shield_1' },
      data: { remainingHP: 0 },
    })
  })

  it('fully absorbs small hits and sets emote=blocked', async () => {
    const future = new Date(Date.now() + 60_000)
    currentTx.fundraiserTeam.findUnique.mockResolvedValue({
      id: 'team_seller',
      activePeriod: '2026-04',
      status: 'ACTIVE',
    })
    currentTx.fundraiserSaleEvent.findUnique.mockResolvedValue(null)
    currentTx.fundraiserSaleEvent.create.mockResolvedValue({ id: 'sale_x' })
    currentTx.fundraiserTeam.findMany.mockResolvedValue([
      {
        id: 'team_shielded',
        hpCurrent: 200,
        shields: [{ id: 'shield_2', expiresAt: future, remainingHP: 30 }],
      },
    ])

    const apply = await getApply()
    const result = await apply({ sellingTeamId: 'team_seller', saleAmount: 10 })

    const hit = result.damagedTeams[0]!
    expect(hit.damageToHP).toBe(0)
    expect(hit.shieldAbsorbed).toBe(10)
    expect(hit.hpAfter).toBe(200) // unchanged
    expect(hit.emote).toBe('blocked')
  })

  it('persists donor identity on the sale event and nulls name when anonymous', async () => {
    currentTx.fundraiserTeam.findUnique.mockResolvedValue({
      id: 'team_seller',
      activePeriod: '2026-04',
      status: 'ACTIVE',
    })
    currentTx.fundraiserSaleEvent.findUnique.mockResolvedValue(null)
    currentTx.fundraiserSaleEvent.create.mockResolvedValue({ id: 'sale_x' })
    currentTx.fundraiserTeam.findMany.mockResolvedValue([])

    const apply = await getApply()
    await apply({
      sellingTeamId: 'team_seller',
      saleAmount: 40,
      donor: {
        userId: 'u_1',
        name: 'Alice',
        avatarUrl: 'https://example.com/a.png',
        email: 'alice@example.com',
        comment: 'go team',
        isAnonymous: true,
      },
    })

    const createArgs =
      currentTx.fundraiserSaleEvent.create.mock.calls[0]![0]!.data
    expect(createArgs).toMatchObject({
      teamId: 'team_seller',
      amount: 40,
      donorUserId: 'u_1',
      donorName: null, // suppressed by isAnonymous
      donorAvatarUrl: null, // suppressed by isAnonymous
      donorEmail: 'alice@example.com',
      donorComment: 'go team',
      isAnonymous: true,
    })
  })

  it('keeps name + avatar when not anonymous', async () => {
    currentTx.fundraiserTeam.findUnique.mockResolvedValue({
      id: 'team_seller',
      activePeriod: '2026-04',
      status: 'ACTIVE',
    })
    currentTx.fundraiserSaleEvent.findUnique.mockResolvedValue(null)
    currentTx.fundraiserSaleEvent.create.mockResolvedValue({ id: 'sale_y' })
    currentTx.fundraiserTeam.findMany.mockResolvedValue([])

    const apply = await getApply()
    await apply({
      sellingTeamId: 'team_seller',
      saleAmount: 25,
      donor: {
        name: 'Bob',
        avatarUrl: 'https://example.com/b.png',
        email: 'bob@example.com',
        isAnonymous: false,
      },
    })

    const createArgs =
      currentTx.fundraiserSaleEvent.create.mock.calls[0]![0]!.data
    expect(createArgs.donorName).toBe('Bob')
    expect(createArgs.donorAvatarUrl).toBe('https://example.com/b.png')
    expect(createArgs.isAnonymous).toBe(false)
  })
})
