import { describe, expect, it } from 'vitest'

import {
  analyseCohorts,
  formatCohortMonth,
  formatRetention,
  monthKey,
  monthOffset,
  type BuyerOrder,
} from '@/lib/analytics/cohort-retention'

const order = (buyerKey: string, iso: string): BuyerOrder => ({
  buyerKey,
  date: new Date(iso),
})

describe('monthKey / monthOffset', () => {
  it('keys by UTC year-month', () => {
    expect(monthKey(new Date('2024-03-15T12:00:00Z'))).toBe('2024-03')
    // Just before the UTC month boundary stays in the earlier month.
    expect(monthKey(new Date('2024-03-31T23:59:59Z'))).toBe('2024-03')
  })

  it('counts whole months across a year boundary', () => {
    expect(monthOffset('2023-11', '2024-02')).toBe(3)
    expect(monthOffset('2024-02', '2023-11')).toBe(-3)
    expect(monthOffset('2024-05', '2024-05')).toBe(0)
  })
})

describe('analyseCohorts — repeat purchase', () => {
  it('counts a buyer once regardless of order volume, and flags repeat buyers', () => {
    const now = new Date('2024-06-15T00:00:00Z')
    const orders = [
      order('a', '2024-01-05T00:00:00Z'),
      order('a', '2024-03-05T00:00:00Z'), // a is a repeat buyer
      order('b', '2024-02-05T00:00:00Z'), // b bought once
    ]
    const { repeat } = analyseCohorts(orders, now)
    expect(repeat.totalBuyers).toBe(2)
    expect(repeat.repeatBuyers).toBe(1)
    expect(repeat.repeatRate).toBeCloseTo(0.5, 5)
    expect(repeat.totalOrders).toBe(3)
    expect(repeat.ordersPerBuyer).toBeCloseTo(1.5, 5)
  })

  it('nulls the rates when there are no buyers', () => {
    const { repeat, cohorts, maxOffset } = analyseCohorts([], new Date('2024-06-15T00:00:00Z'))
    expect(repeat.totalBuyers).toBe(0)
    expect(repeat.repeatRate).toBeNull()
    expect(repeat.ordersPerBuyer).toBeNull()
    expect(cohorts).toEqual([])
    expect(maxOffset).toBe(0)
  })
})

describe('analyseCohorts — retention grid', () => {
  it('assigns a buyer to their first month and tracks later activity', () => {
    const now = new Date('2024-04-15T00:00:00Z')
    // One cohort (Jan) of two buyers: one returns in Mar, one never returns.
    const orders = [
      order('a', '2024-01-10T00:00:00Z'),
      order('a', '2024-03-10T00:00:00Z'),
      order('b', '2024-01-20T00:00:00Z'),
    ]
    const { cohorts, maxOffset } = analyseCohorts(orders, now)
    expect(cohorts).toHaveLength(1)
    expect(maxOffset).toBe(3) // Jan → Apr

    const jan = cohorts[0]
    expect(jan.cohort).toBe('2024-01')
    expect(jan.cohortSize).toBe(2)
    // Offset 0 = acquisition month = everyone. Offset 2 (Mar) = one of two returned.
    expect(jan.retentionByOffset[0]).toBe(1)
    expect(jan.retentionByOffset[1]).toBe(0) // Feb: nobody
    expect(jan.retentionByOffset[2]).toBeCloseTo(0.5, 5) // Mar: a
    expect(jan.retentionByOffset[3]).toBe(0) // Apr so far: nobody
    expect(jan.returnedByOffset[2]).toBe(1)
  })

  it('leaves future cells null, never zero', () => {
    const now = new Date('2024-02-15T00:00:00Z')
    // Cohort acquired in Feb (this month): only offset 0 is observable.
    const orders = [order('a', '2024-02-10T00:00:00Z'), order('b', '2024-01-10T00:00:00Z')]
    const { cohorts, maxOffset } = analyseCohorts(orders, now)
    expect(maxOffset).toBe(1) // Jan → Feb

    const feb = cohorts.find((c) => c.cohort === '2024-02')!
    expect(feb.retentionByOffset[0]).toBe(1)
    // Offset 1 would be March — not yet observable from Feb. Null, not 0.
    expect(feb.retentionByOffset[1]).toBeNull()
    expect(feb.returnedByOffset[1]).toBeNull()

    const jan = cohorts.find((c) => c.cohort === '2024-01')!
    // Jan can observe offset 1 (Feb); buyer b did not return, so a real 0 here.
    expect(jan.retentionByOffset[1]).toBe(0)
  })

  it('orders cohorts chronologically', () => {
    const now = new Date('2024-06-15T00:00:00Z')
    const orders = [
      order('a', '2024-03-01T00:00:00Z'),
      order('b', '2024-01-01T00:00:00Z'),
      order('c', '2024-02-01T00:00:00Z'),
    ]
    const { cohorts } = analyseCohorts(orders, now)
    expect(cohorts.map((c) => c.cohort)).toEqual(['2024-01', '2024-02', '2024-03'])
  })

  it('takes the earliest order as the cohort even when orders arrive out of sequence', () => {
    const now = new Date('2024-06-15T00:00:00Z')
    // Later order listed first — cohort must still be the January order.
    const orders = [order('a', '2024-04-01T00:00:00Z'), order('a', '2024-01-01T00:00:00Z')]
    const { cohorts } = analyseCohorts(orders, now)
    expect(cohorts).toHaveLength(1)
    expect(cohorts[0].cohort).toBe('2024-01')
    expect(cohorts[0].retentionByOffset[3]).toBe(1) // returned in April (offset 3)
  })
})

describe('formatters', () => {
  it('formats retention with an em dash for null', () => {
    expect(formatRetention(0.421)).toBe('42.1%')
    expect(formatRetention(0)).toBe('0.0%')
    expect(formatRetention(null)).toBe('—')
  })

  it('renders a cohort month label in UTC', () => {
    expect(formatCohortMonth('2024-03')).toBe('Mar 2024')
  })
})
