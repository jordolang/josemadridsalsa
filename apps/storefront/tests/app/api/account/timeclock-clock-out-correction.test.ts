import { NextRequest } from 'next/server'
import { beforeEach, describe, expect, it, vi } from 'vitest'

vi.mock('@/lib/rbac', () => ({
  getCurrentUser: vi.fn(async () => ({ id: 'dev-1', role: 'DEVELOPER' })),
  isDeveloper: vi.fn((user: { role: string } | null) => user?.role === 'DEVELOPER'),
}))

vi.mock('@/lib/prisma', () => {
  const prisma = {
    timeClockEntry: {
      findUnique: vi.fn(),
      findFirst: vi.fn(),
      update: vi.fn(),
    },
    auditLog: { create: vi.fn() },
    $transaction: vi.fn(),
  }
  prisma.$transaction.mockImplementation(async (fn: (tx: typeof prisma) => unknown) => fn(prisma))
  return { prisma }
})

import { PATCH } from '@/app/api/account/timeclock/[id]/route'
import { prisma } from '@/lib/prisma'
import { getCurrentUser } from '@/lib/rbac'

function patch(body: unknown) {
  return PATCH(
    new NextRequest('http://localhost/api/account/timeclock/entry-1', {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(body),
    }),
    { params: Promise.resolve({ id: 'entry-1' }) }
  )
}

describe('PATCH /api/account/timeclock/:id (developer clock-out edit)', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    vi.mocked(getCurrentUser).mockResolvedValue({ id: 'dev-1', role: 'DEVELOPER' } as never)
    vi.mocked(prisma.timeClockEntry.findUnique).mockResolvedValue({
      id: 'entry-1',
      userId: 'dev-1',
      clockInAt: new Date('2026-10-09T13:00:00Z'),
      clockOutAt: new Date('2026-10-09T23:30:00Z'),
      notes: 'Packed orders',
    } as never)
    vi.mocked(prisma.timeClockEntry.findFirst).mockResolvedValue(null)
    vi.mocked(prisma.timeClockEntry.update).mockImplementation((async ({ data }: { data: object }) => ({
      id: 'entry-1',
      clockInAt: new Date('2026-10-09T13:00:00Z'),
      notes: 'Packed orders',
      ...data,
    })) as never)
  })

  it('changes only the clock-out time and audits it', async () => {
    const response = await patch({ clockOutAt: '2026-10-09T17:00', reason: 'Left at 5' })

    expect(response.status).toBe(200)
    expect(vi.mocked(prisma.timeClockEntry.update).mock.calls[0][0].data).toEqual({
      clockOutAt: new Date('2026-10-09T21:00:00Z'),
    })
    expect(vi.mocked(prisma.auditLog.create).mock.calls[0][0].data).toMatchObject({
      userId: 'dev-1',
      action: 'TIMECLOCK_CORRECTION',
      entityId: 'entry-1',
      changes: {
        reason: 'Left at 5',
        before: { clockOutAt: '2026-10-09T23:30:00.000Z', notes: 'Packed orders' },
        after: { clockOutAt: '2026-10-09T21:00:00.000Z', notes: 'Packed orders' },
      },
    })
  })

  it.each(['STAFF', 'ADMIN'])('refuses %s accounts', async (role) => {
    vi.mocked(getCurrentUser).mockResolvedValue({ id: 'dev-1', role } as never)

    const response = await patch({ clockOutAt: '2026-10-09T17:00', reason: 'Left at 5' })

    expect(response.status).toBe(403)
    expect(prisma.timeClockEntry.update).not.toHaveBeenCalled()
  })

  it('refuses signed-out requests', async () => {
    vi.mocked(getCurrentUser).mockResolvedValue(null)

    expect((await patch({ clockOutAt: '2026-10-09T17:00', reason: 'Left at 5' })).status).toBe(401)
  })

  it("does not touch someone else's punch", async () => {
    vi.mocked(prisma.timeClockEntry.findUnique).mockResolvedValue({
      id: 'entry-1',
      userId: 'staff-2',
      clockInAt: new Date('2026-10-09T13:00:00Z'),
      clockOutAt: null,
      notes: null,
    } as never)

    const response = await patch({ clockOutAt: '2026-10-09T17:00', reason: 'Left at 5' })

    expect(response.status).toBe(404)
    expect(prisma.timeClockEntry.update).not.toHaveBeenCalled()
  })

  it('rejects a clock-out before the clock-in', async () => {
    const response = await patch({ clockOutAt: '2026-10-09T08:00', reason: 'Typo' })

    expect(response.status).toBe(400)
    expect(prisma.timeClockEntry.update).not.toHaveBeenCalled()
  })

  it('requires a reason', async () => {
    expect((await patch({ clockOutAt: '2026-10-09T17:00', reason: '' })).status).toBe(400)
  })

  it('rejects a clock-out that overlaps another punch', async () => {
    vi.mocked(prisma.timeClockEntry.findFirst).mockResolvedValue({ id: 'entry-2' } as never)

    const response = await patch({ clockOutAt: '2026-10-09T17:00', reason: 'Left at 5' })

    expect(response.status).toBe(409)
    expect(prisma.timeClockEntry.update).not.toHaveBeenCalled()
  })
})
