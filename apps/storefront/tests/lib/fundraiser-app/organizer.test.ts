import { beforeEach, describe, expect, it, vi } from 'vitest'

const db = vi.hoisted(() => ({
  fundraiser: { update: vi.fn() },
  fundraiserParticipant: { findFirst: vi.fn(), findMany: vi.fn(), update: vi.fn() },
  fundraiserAppSession: { updateMany: vi.fn() },
  order: { groupBy: vi.fn() },
  $transaction: vi.fn(),
}))

vi.mock('@/lib/prisma', () => ({ prisma: db, default: db }))

const { changeGroupPin, listGroupSellers, resetSellerPin } = await import('@/lib/fundraiser-app/organizer')
const { verifyPin } = await import('@/lib/fundraiser-app/credentials')

type Session = Parameters<typeof resetSellerPin>[0]
const sessionFor = (participantId: string) =>
  ({
    id: 's_1',
    participant: { id: participantId, fundraiser: { id: 'f_1', appOrganizerId: 'p_org' } },
  }) as unknown as Session

const organizer = sessionFor('p_org')
const seller = sessionFor('p_1')

beforeEach(() => {
  vi.clearAllMocks()
  db.$transaction.mockResolvedValue([])
})

describe('the organizer seat', () => {
  it('is the only one that can reset PINs, list sellers or change the group PIN', async () => {
    await expect(resetSellerPin(seller, 'p_2')).rejects.toMatchObject({ status: 403 })
    await expect(listGroupSellers(seller)).rejects.toMatchObject({ status: 403 })
    await expect(changeGroupPin(seller, '1357')).rejects.toMatchObject({ status: 403 })
    expect(db.fundraiserParticipant.update).not.toHaveBeenCalled()
    expect(db.fundraiser.update).not.toHaveBeenCalled()
  })

  it('clears a seller PIN and signs their phones out', async () => {
    db.fundraiserParticipant.findFirst.mockResolvedValue({ id: 'p_1', name: 'Casey Jones' })

    await resetSellerPin(organizer, 'p_1')

    expect(db.fundraiserParticipant.findFirst.mock.calls[0][0].where).toEqual({ id: 'p_1', fundraiserId: 'f_1' })
    expect(db.fundraiserParticipant.update).toHaveBeenCalledWith({
      where: { id: 'p_1' },
      data: { appPinHash: null, appPinSetAt: null, appPinFailures: 0, appPinLockedUntil: null },
    })
    expect(db.fundraiserAppSession.updateMany).toHaveBeenCalledWith({
      where: { participantId: 'p_1', revokedAt: null },
      data: { revokedAt: expect.any(Date) },
    })
    expect(db.$transaction).toHaveBeenCalledOnce()
  })

  it('cannot reach a seller in another group', async () => {
    db.fundraiserParticipant.findFirst.mockResolvedValue(null)
    await expect(resetSellerPin(organizer, 'p_elsewhere')).rejects.toMatchObject({ status: 404 })
    expect(db.$transaction).not.toHaveBeenCalled()
  })

  it("leaves the organizer's own PIN to Jose Madrid", async () => {
    await expect(resetSellerPin(organizer, 'p_org')).rejects.toMatchObject({ status: 403 })
  })

  it('changes the group PIN and lifts any lock', async () => {
    await changeGroupPin(organizer, '1357')
    const { data } = db.fundraiser.update.mock.calls[0][0]
    expect(data).toMatchObject({ appGroupPinFailures: 0, appGroupLockedUntil: null })
    expect(await verifyPin('1357', data.appGroupPinHash)).toBe(true)
  })

  it('lists sellers with their sales and sign-in state', async () => {
    db.fundraiserParticipant.findMany.mockResolvedValue([
      { id: 'p_org', name: 'Olive Organizer', status: 'ACTIVE', appPinHash: 'h', appPinLockedUntil: null, appSessions: [] },
      {
        id: 'p_1',
        name: 'Casey Jones',
        status: 'ACTIVE',
        appPinHash: null,
        appPinLockedUntil: null,
        appSessions: [{ lastSeenAt: new Date('2026-10-02') }, { lastSeenAt: new Date('2026-10-03') }],
      },
    ])
    db.order.groupBy.mockResolvedValue([{ participantId: 'p_1', _count: { _all: 2 }, _sum: { total: 46 } }])

    const sellers = await listGroupSellers(organizer)

    expect(sellers[0]).toMatchObject({ id: 'p_org', isOrganizer: true, orders: 0, sales: 0 })
    expect(sellers[1]).toMatchObject({
      id: 'p_1',
      hasPin: false,
      devices: 2,
      lastSeenAt: new Date('2026-10-03'),
      orders: 2,
      sales: 46,
    })
  })
})
