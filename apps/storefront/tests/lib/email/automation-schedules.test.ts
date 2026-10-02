import { beforeEach, describe, expect, it, vi } from 'vitest'

/**
 * Time-based automation triggers. These run every five minutes against real customers, so what
 * matters is who gets picked (the right day, the right lapse) and that re-scanning the same day
 * hands `enrollInAutomation` the same dedupe key every time.
 */

const automationFindMany = vi.fn()
const userFindMany = vi.fn()
const orderFindMany = vi.fn()
const orderCount = vi.fn()
const enrollInAutomation = vi.fn()

vi.mock('@/lib/prisma', () => {
  const client = {
    emailAutomation: { findMany: automationFindMany },
    user: { findMany: userFindMany },
    order: { findMany: orderFindMany, count: orderCount },
  }
  return { prisma: client, default: client }
})

vi.mock('@/lib/email/automation-engine', () => ({ enrollInAutomation }))

const {
  enrollAnniversaries,
  enrollBirthdays,
  enrollLapsedCustomers,
  enrollScheduledAutomations,
  isBirthdayOn,
} = await import('@/lib/email/automation-schedules')

// 2 Oct 2026, 02:00 UTC — still 1 Oct in Eastern time, which is the business day.
const NOW = new Date('2026-10-02T02:00:00Z')
const DAY = 24 * 60 * 60 * 1000

beforeEach(() => {
  vi.clearAllMocks()
  enrollInAutomation.mockResolvedValue(undefined)
  orderCount.mockResolvedValue(0)
  orderFindMany.mockResolvedValue([])
  userFindMany.mockResolvedValue([])
})

describe('isBirthdayOn', () => {
  it('matches month and day', () => {
    expect(isBirthdayOn(new Date('1990-10-01T00:00:00Z'), { year: 2026, month: 10, day: 1 })).toBe(true)
    expect(isBirthdayOn(new Date('1990-10-02T00:00:00Z'), { year: 2026, month: 10, day: 1 })).toBe(false)
  })

  it('celebrates 29 February on the 28th in a common year, and on the 29th in a leap year', () => {
    const leapling = new Date('2000-02-29T00:00:00Z')
    expect(isBirthdayOn(leapling, { year: 2027, month: 2, day: 28 })).toBe(true)
    expect(isBirthdayOn(leapling, { year: 2028, month: 2, day: 28 })).toBe(false)
    expect(isBirthdayOn(leapling, { year: 2028, month: 2, day: 29 })).toBe(true)
  })
})

describe('enrollBirthdays', () => {
  it("enrolls only today's birthdays, judged by the Eastern business day, once per year", async () => {
    userFindMany.mockResolvedValue([
      { email: 'today@example.com', name: 'Rosa Diaz', dateOfBirth: new Date('1988-10-01T00:00:00Z') },
      { email: 'utc-tomorrow@example.com', name: null, dateOfBirth: new Date('1988-10-02T00:00:00Z') },
    ])

    const enrolled = await enrollBirthdays(NOW)

    expect(enrolled).toBe(1)
    expect(enrollInAutomation).toHaveBeenCalledWith(
      'BIRTHDAY',
      'today@example.com',
      { firstName: 'Rosa' },
      'BIRTHDAY:2026'
    )
  })
})

describe('enrollAnniversaries', () => {
  it("enrolls a customer whose first paid order was on today's date", async () => {
    orderFindMany.mockResolvedValue([
      { createdAt: new Date('2024-10-01T16:00:00Z'), guestEmail: 'Fan@Example.com', user: null },
    ])

    await enrollAnniversaries(NOW)

    // One Eastern-day range per earlier year, starting at local midnight (04:00Z in October).
    const { where } = orderFindMany.mock.calls[0][0]
    expect(where.OR[0].createdAt.gte).toEqual(new Date('2025-10-01T04:00:00.000Z'))
    expect(enrollInAutomation).toHaveBeenCalledWith(
      'ANNIVERSARY',
      'fan@example.com',
      expect.objectContaining({ years: '2' }),
      'ANNIVERSARY:2026'
    )
  })

  it('skips an order that was not the customer’s first', async () => {
    orderFindMany.mockResolvedValue([
      { createdAt: new Date('2024-10-01T16:00:00Z'), guestEmail: null, user: { email: 'repeat@example.com' } },
    ])
    orderCount.mockResolvedValue(3)

    await enrollAnniversaries(NOW)

    expect(enrollInAutomation).not.toHaveBeenCalled()
  })
})

describe('enrollLapsedCustomers', () => {
  it('looks only at orders that lapsed within the last week of the 90-day threshold', async () => {
    await enrollLapsedCustomers(NOW)

    const { where } = orderFindMany.mock.calls[0][0]
    expect(where.createdAt).toEqual({
      gte: new Date(NOW.getTime() - 97 * DAY),
      lte: new Date(NOW.getTime() - 90 * DAY),
    })
  })

  it('enrolls a lapsed customer once per lapse, keyed on their last order', async () => {
    orderFindMany.mockResolvedValue([
      { id: 'order_new', createdAt: new Date(NOW.getTime() - 91 * DAY), guestEmail: 'gone@example.com', user: null },
      { id: 'order_old', createdAt: new Date(NOW.getTime() - 95 * DAY), guestEmail: 'gone@example.com', user: null },
    ])

    await enrollLapsedCustomers(NOW)

    expect(enrollInAutomation).toHaveBeenCalledOnce()
    expect(enrollInAutomation.mock.calls[0][3]).toBe('REENGAGEMENT:order_new')
  })

  it('leaves alone a customer who has ordered since', async () => {
    orderFindMany.mockResolvedValue([
      { id: 'order_1', createdAt: new Date(NOW.getTime() - 91 * DAY), guestEmail: 'back@example.com', user: null },
    ])
    orderCount.mockResolvedValue(1)

    await enrollLapsedCustomers(NOW)

    expect(enrollInAutomation).not.toHaveBeenCalled()
  })
})

describe('enrollScheduledAutomations', () => {
  it('scans nothing when no active automation uses a time-based trigger', async () => {
    automationFindMany.mockResolvedValue([])

    expect(await enrollScheduledAutomations(NOW)).toEqual({})
    expect(userFindMany).not.toHaveBeenCalled()
    expect(orderFindMany).not.toHaveBeenCalled()
  })

  it('runs only the triggers an active automation is listening for', async () => {
    automationFindMany.mockResolvedValue([{ trigger: 'REENGAGEMENT' }])

    expect(await enrollScheduledAutomations(NOW)).toEqual({ reengagement: 0 })
    expect(userFindMany).not.toHaveBeenCalled()
  })
})
