import { NextRequest } from 'next/server'
import { beforeEach, describe, expect, it, vi } from 'vitest'

vi.mock('@/lib/rbac', () => ({
  requirePermission: vi.fn(async () => ({ id: 'admin-1', role: 'ADMIN' })),
}))

vi.mock('@/lib/audit', () => ({
  logAuditWithRequest: vi.fn(),
}))

vi.mock('@/lib/prisma', () => ({
  prisma: {
    timeClockEntry: {
      findUnique: vi.fn(),
      findFirst: vi.fn(),
      update: vi.fn(),
    },
  },
}))

import { PATCH } from '@/app/api/admin/timeclock/[id]/route'
import { logAuditWithRequest } from '@/lib/audit'
import { prisma } from '@/lib/prisma'
import { requirePermission } from '@/lib/rbac'

const correction = {
  clockInAt: '2026-10-09T09:45',
  clockOutAt: '2026-10-09T14:00',
  notes: 'Labeled salsa and packed',
  reason: 'Forgot to clock out',
}

function patch(body: unknown) {
  return PATCH(
    new NextRequest('http://localhost/api/admin/timeclock/entry-1', {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(body),
    }),
    { params: Promise.resolve({ id: 'entry-1' }) }
  )
}

describe('PATCH /api/admin/timeclock/:id', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    vi.mocked(prisma.timeClockEntry.findUnique).mockResolvedValue({
      id: 'entry-1',
      userId: 'user-1',
      clockInAt: new Date('2026-10-11T15:00:00Z'),
      clockOutAt: null,
      notes: null,
    } as never)
    vi.mocked(prisma.timeClockEntry.findFirst).mockResolvedValue(null)
    vi.mocked(prisma.timeClockEntry.update).mockImplementation((async ({ data }: { data: object }) => ({
      id: 'entry-1',
      ...data,
    })) as never)
  })

  it('corrects the punch and audits the before and after', async () => {
    const response = await patch(correction)

    expect(response.status).toBe(200)
    expect(vi.mocked(prisma.timeClockEntry.update).mock.calls[0][0].data).toEqual({
      clockInAt: new Date('2026-10-09T13:45:00Z'),
      clockOutAt: new Date('2026-10-09T18:00:00Z'),
      notes: 'Labeled salsa and packed',
    })
    expect(vi.mocked(logAuditWithRequest).mock.calls[0][0]).toMatchObject({
      userId: 'admin-1',
      action: 'TIMECLOCK_CORRECTION',
      entityId: 'entry-1',
      changes: {
        employeeId: 'user-1',
        reason: 'Forgot to clock out',
        before: { clockInAt: '2026-10-11T15:00:00.000Z', clockOutAt: null, notes: null },
        after: { clockInAt: '2026-10-09T13:45:00.000Z', clockOutAt: '2026-10-09T18:00:00.000Z' },
      },
    })
  })

  it('requires a reason', async () => {
    const response = await patch({ ...correction, reason: '' })

    expect(response.status).toBe(400)
    expect(prisma.timeClockEntry.update).not.toHaveBeenCalled()
  })

  it('refuses times that overlap another punch', async () => {
    vi.mocked(prisma.timeClockEntry.findFirst).mockResolvedValue({ id: 'entry-2' } as never)

    const response = await patch(correction)

    expect(response.status).toBe(409)
    expect(prisma.timeClockEntry.update).not.toHaveBeenCalled()
  })

  it('returns 404 for an unknown punch', async () => {
    vi.mocked(prisma.timeClockEntry.findUnique).mockResolvedValue(null)

    expect((await patch(correction)).status).toBe(404)
  })

  it('is closed to accounts without users:write', async () => {
    vi.mocked(requirePermission).mockRejectedValueOnce(
      new Error('Forbidden - requires permission: users:write')
    )

    expect((await patch(correction)).status).toBe(403)
    expect(prisma.timeClockEntry.findUnique).not.toHaveBeenCalled()
  })
})
