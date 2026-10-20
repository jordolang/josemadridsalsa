import { beforeEach, describe, expect, it, vi } from 'vitest'

const findManyMock = vi.fn()

vi.mock('server-only', () => ({}))
vi.mock('@/lib/prisma', () => ({
  prisma: { fundraiser: { findMany: (...args: unknown[]) => findManyMock(...args) } },
}))

import { getActiveSiteFundraisers, mergeGroupDirectory, withSlugs } from '@/lib/fundraising-site/groups'

describe('mergeGroupDirectory', () => {
  it('lists store groups and site fundraisers together, sorted by name', () => {
    const store = withSlugs([
      { value: '1', label: 'Kal-Val Saddle Club' },
      { value: '2', label: 'Arctic Edge Unity Synchro' },
    ])

    expect(mergeGroupDirectory(store, [{ name: 'ESBD Boosters ', slug: 'esbd-boosters' }])).toEqual([
      { label: 'Arctic Edge Unity Synchro', href: '/groups/arctic-edge-unity-synchro' },
      { label: 'ESBD Boosters', href: '/fundraisers/esbd-boosters' },
      { label: 'Kal-Val Saddle Club', href: '/groups/kal-val-saddle-club' },
    ])
  })

  it('lists a group on both sites once, as the store group', () => {
    const store = withSlugs([{ value: '1', label: 'Cassidy’s Hope Foundation' }])

    expect(mergeGroupDirectory(store, [{ name: "cassidy's  hope foundation", slug: 'cassidys-hope' }])).toEqual([
      { label: 'Cassidy’s Hope Foundation', href: '/groups/cassidys-hope-foundation' },
    ])
  })
})

describe('getActiveSiteFundraisers', () => {
  beforeEach(() => findManyMock.mockReset().mockResolvedValue([]))

  it('asks only for live fundraisers set up on this site', async () => {
    const now = new Date('2026-10-20T00:00:00Z')
    await getActiveSiteFundraisers(now)

    expect(findManyMock.mock.calls[0][0].where).toEqual({
      isActive: true,
      status: 'ACTIVE',
      bigCommerceGroup: null,
      startDate: { lte: now },
      endDate: { gte: now },
    })
  })
})
