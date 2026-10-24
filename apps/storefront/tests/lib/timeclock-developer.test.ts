import { beforeEach, describe, expect, it, vi } from 'vitest'

vi.mock('@/lib/prisma', () => ({
  prisma: {
    user: { findMany: vi.fn() },
    timeClockEntry: { findMany: vi.fn() },
  },
}))

import { loadDeveloperTimeclock } from '@/lib/timeclock-developer'
import { prisma } from '@/lib/prisma'

const now = new Date('2026-10-23T16:00:00Z')
const ana = { id: 'ana', name: 'Ana', email: 'ana@example.com' }
const ben = { id: 'ben', name: null, email: 'ben@example.com' }

describe('loadDeveloperTimeclock', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    vi.mocked(prisma.user.findMany).mockResolvedValue([ana, ben] as never)
    vi.mocked(prisma.timeClockEntry.findMany).mockResolvedValue([
      {
        id: 'p3',
        clockInAt: new Date('2026-10-22T13:00:00Z'),
        clockOutAt: null,
        notes: null,
        user: ana,
      },
      {
        id: 'p2',
        clockInAt: new Date('2026-10-21T13:00:00Z'),
        clockOutAt: new Date('2026-10-21T17:00:00Z'),
        notes: 'Packed orders',
        user: ben,
      },
      {
        id: 'p1',
        clockInAt: new Date('2026-10-20T13:00:00Z'),
        clockOutAt: new Date('2026-10-20T21:30:00Z'),
        notes: null,
        user: ana,
      },
    ] as never)
  })

  it("lists every employee's punches in the range with per-employee totals", async () => {
    const view = await loadDeveloperTimeclock({
      userId: null,
      startInput: '10/20/2026',
      endInput: '10/22/2026',
      now,
    })

    expect(view.range).toEqual({ start: '10/20/2026', end: '10/22/2026' })
    expect(view.employees).toEqual([
      { id: 'ana', name: 'Ana' },
      { id: 'ben', name: 'ben@example.com' },
    ])
    expect(view.selectedUserId).toBeNull()
    expect(view.punches.map((punch) => punch.id)).toEqual(['p3', 'p2', 'p1'])
    expect(view.totals).toEqual([
      { employeeId: 'ana', name: 'Ana', totalMs: 8.5 * 3_600_000 },
      { employeeId: 'ben', name: 'ben@example.com', totalMs: 4 * 3_600_000 },
    ])
    const where = vi.mocked(prisma.timeClockEntry.findMany).mock.calls[0][0]?.where
    expect(where).not.toHaveProperty('userId')
    expect(where?.clockInAt).toEqual({
      gte: new Date('2026-10-20T04:00:00Z'),
      lte: expect.any(Date),
    })
  })

  it('filters to one employee', async () => {
    const view = await loadDeveloperTimeclock({ userId: 'ben', startInput: null, endInput: null, now })

    expect(view.selectedUserId).toBe('ben')
    expect(vi.mocked(prisma.timeClockEntry.findMany).mock.calls[0][0]?.where).toMatchObject({
      userId: 'ben',
    })
  })

  it('ignores an employee id that is not on the list', async () => {
    const view = await loadDeveloperTimeclock({
      userId: 'someone-else',
      startInput: null,
      endInput: null,
      now,
    })

    expect(view.selectedUserId).toBeNull()
    expect(vi.mocked(prisma.timeClockEntry.findMany).mock.calls[0][0]?.where).not.toHaveProperty(
      'userId'
    )
  })
})
