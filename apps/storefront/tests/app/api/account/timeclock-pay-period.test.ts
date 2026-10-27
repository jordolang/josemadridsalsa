import { NextRequest } from 'next/server'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

vi.mock('@/lib/rbac', () => ({
  getCurrentUser: vi.fn(async () => ({ id: 'user-1', role: 'STAFF' })),
  isStaff: vi.fn(() => true),
}))

const tx = {
  timeClockPayPeriod: { create: vi.fn() },
  auditLog: { create: vi.fn() },
}

vi.mock('@/lib/prisma', () => ({
  prisma: {
    $transaction: vi.fn(async (run: (client: typeof tx) => unknown) => run(tx)),
  },
}))

import { POST } from '@/app/api/account/timeclock/pay-period/route'
import { getCurrentUser, isStaff } from '@/lib/rbac'

function post(body: unknown) {
  return new NextRequest('http://localhost/api/account/timeclock/pay-period', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
  })
}

describe('POST /api/account/timeclock/pay-period', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    vi.useFakeTimers()
    vi.setSystemTime(new Date('2026-10-27T16:00:00Z'))
    tx.timeClockPayPeriod.create.mockResolvedValue({
      id: 'period-1',
      startsAt: new Date('2026-08-13T04:00:00Z'),
    })
  })

  afterEach(() => {
    vi.useRealTimers()
  })

  it('starts a backdated pay period at the start of that Zanesville day and audits it', async () => {
    const response = await POST(post({ start: '08/13/2026' }))

    expect(response.status).toBe(201)
    expect(tx.timeClockPayPeriod.create.mock.calls[0][0].data).toEqual({
      userId: 'user-1',
      startsAt: new Date('2026-08-13T04:00:00Z'),
    })
    expect(tx.auditLog.create.mock.calls[0][0].data).toMatchObject({
      userId: 'user-1',
      action: 'TIMECLOCK_PAY_PERIOD_START',
      changes: { start: '08/13/2026' },
    })
  })

  it('starts today when no date is given', async () => {
    const response = await POST(post({}))

    expect(response.status).toBe(201)
    expect(tx.timeClockPayPeriod.create.mock.calls[0][0].data.startsAt).toEqual(
      new Date('2026-10-27T04:00:00Z')
    )
  })

  it('rejects a start in the future', async () => {
    const response = await POST(post({ start: '10/28/2026' }))

    expect(response.status).toBe(400)
    expect(tx.timeClockPayPeriod.create).not.toHaveBeenCalled()
  })

  it('rejects a start before the timeclock went live', async () => {
    const response = await POST(post({ start: '07/31/2026' }))

    expect(response.status).toBe(400)
  })

  it('rejects a date that is not MM/DD/YYYY', async () => {
    const response = await POST(post({ start: '2026-08-13' }))

    expect(response.status).toBe(400)
  })

  it('is limited to staff', async () => {
    vi.mocked(isStaff).mockReturnValueOnce(false)
    expect((await POST(post({}))).status).toBe(403)

    vi.mocked(getCurrentUser).mockResolvedValueOnce(null)
    expect((await POST(post({}))).status).toBe(401)
  })
})
