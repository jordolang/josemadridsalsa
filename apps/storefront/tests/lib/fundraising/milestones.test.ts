import { describe, expect, it } from 'vitest'

import { SALES_MILESTONES, milestoneReached, pendingMilestone } from '@/lib/fundraising/milestones'

describe('milestoneReached', () => {
  it('is zero before the first threshold', () => {
    expect(milestoneReached(0)).toBe(0)
    expect(milestoneReached(4)).toBe(0)
  })

  it('reports a threshold on the exact count', () => {
    for (const milestone of SALES_MILESTONES) {
      expect(milestoneReached(milestone)).toBe(milestone)
    }
  })

  it('reports the highest threshold passed, not the nearest', () => {
    expect(milestoneReached(40)).toBe(25)
    expect(milestoneReached(99)).toBe(50)
  })

  it('stays at the top threshold beyond it', () => {
    expect(milestoneReached(1000)).toBe(100)
  })
})

describe('pendingMilestone', () => {
  it('has nothing to say before the first threshold', () => {
    expect(pendingMilestone(3, 0)).toBeNull()
  })

  it('announces a newly-passed threshold', () => {
    expect(pendingMilestone(5, 0)).toBe(5)
  })

  it('stays silent once a threshold has been announced', () => {
    expect(pendingMilestone(5, 5)).toBeNull()
    expect(pendingMilestone(9, 5)).toBeNull()
  })

  it('collapses a burst of sales into one message rather than one per threshold', () => {
    // Sold twenty-five jars at a school fair in an afternoon: congratulate once, at 25.
    expect(pendingMilestone(27, 0)).toBe(25)
  })

  it('is silent when a refund has pushed the count back below the mark', () => {
    // `totalOrders` is decremented by commission reversal, so this is reachable.
    expect(pendingMilestone(23, 25)).toBeNull()
  })

  it('never re-announces after the top threshold', () => {
    expect(pendingMilestone(500, 100)).toBeNull()
  })
})
