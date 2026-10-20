import { NextRequest } from 'next/server'
import { beforeEach, describe, expect, it, vi } from 'vitest'

vi.mock('@/lib/rbac', () => ({
  getCurrentUser: vi.fn(async () => ({ id: 'user-1', role: 'STAFF' })),
  isStaff: vi.fn(() => true),
}))

vi.mock('@/lib/prisma', () => ({
  prisma: {
    timeClockEntry: {
      findFirst: vi.fn(),
      create: vi.fn(),
      updateMany: vi.fn(),
      findUnique: vi.fn(),
    },
  },
}))

import { POST as clockIn } from '@/app/api/account/timeclock/route'
import { POST as clockOut } from '@/app/api/account/timeclock/clock-out/route'
import { prisma } from '@/lib/prisma'

const zanesville = { latitude: 39.94035, longitude: -82.01319, accuracyMeters: 12 }

function post(path: string, body: unknown) {
  return new NextRequest(`http://localhost${path}`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', 'x-forwarded-for': '203.0.113.7' },
    body: JSON.stringify(body),
  })
}

describe('POST /api/account/timeclock (clock in)', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    vi.mocked(prisma.timeClockEntry.findFirst).mockResolvedValue(null)
    vi.mocked(prisma.timeClockEntry.create).mockResolvedValue({
      id: 'entry-1',
      clockInAt: new Date('2026-10-20T13:00:00Z'),
      clockInIp: '203.0.113.7',
    } as never)
  })

  it('records the GPS fix sent with the punch', async () => {
    const response = await clockIn(post('/api/account/timeclock', { location: zanesville }))

    expect(response.status).toBe(201)
    expect(vi.mocked(prisma.timeClockEntry.create).mock.calls[0][0].data).toMatchObject({
      userId: 'user-1',
      clockInLatitude: 39.94035,
      clockInLongitude: -82.01319,
      clockInAccuracyMeters: 12,
    })
  })

  it('still clocks in when the browser could not supply a location', async () => {
    const response = await clockIn(post('/api/account/timeclock', {}))

    expect(response.status).toBe(201)
    expect(vi.mocked(prisma.timeClockEntry.create).mock.calls[0][0].data).toMatchObject({
      clockInLatitude: null,
      clockInLongitude: null,
      clockInAccuracyMeters: null,
    })
  })

  it('rejects coordinates that are not on Earth', async () => {
    const response = await clockIn(
      post('/api/account/timeclock', { location: { ...zanesville, latitude: 120 } })
    )

    expect(response.status).toBe(400)
    expect(prisma.timeClockEntry.create).not.toHaveBeenCalled()
  })
})

describe('POST /api/account/timeclock/clock-out', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    vi.mocked(prisma.timeClockEntry.findFirst).mockResolvedValue({ id: 'entry-1' } as never)
    vi.mocked(prisma.timeClockEntry.updateMany).mockResolvedValue({ count: 1 })
    vi.mocked(prisma.timeClockEntry.findUnique).mockResolvedValue({
      id: 'entry-1',
      clockInAt: new Date('2026-10-20T13:00:00Z'),
      clockOutAt: new Date('2026-10-20T21:00:00Z'),
      clockOutIp: '203.0.113.7',
      notes: 'Packed orders',
    } as never)
  })

  it('records the GPS fix alongside the notes', async () => {
    const response = await clockOut(
      post('/api/account/timeclock/clock-out', { notes: 'Packed orders', location: zanesville })
    )

    expect(response.status).toBe(200)
    expect(vi.mocked(prisma.timeClockEntry.updateMany).mock.calls[0][0].data).toMatchObject({
      clockOutLatitude: 39.94035,
      clockOutLongitude: -82.01319,
      clockOutAccuracyMeters: 12,
      notes: 'Packed orders',
    })
  })

  it('still clocks out without a location', async () => {
    const response = await clockOut(post('/api/account/timeclock/clock-out', { notes: 'Packed orders' }))

    expect(response.status).toBe(200)
    expect(vi.mocked(prisma.timeClockEntry.updateMany).mock.calls[0][0].data).toMatchObject({
      clockOutLatitude: null,
      clockOutLongitude: null,
      clockOutAccuracyMeters: null,
    })
  })
})
