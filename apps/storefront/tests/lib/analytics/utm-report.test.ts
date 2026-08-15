import { describe, expect, it } from 'vitest'

import {
  DIRECT_KEY,
  groupByDimension,
  summariseAttribution,
  type AttributedOrder,
} from '@/lib/analytics/utm-report'

const order = (over: Partial<AttributedOrder>): AttributedOrder => ({
  utmSource: null,
  utmMedium: null,
  utmCampaign: null,
  referrer: null,
  revenueCents: 0,
  ...over,
})

describe('summariseAttribution', () => {
  it('splits attributed (has utm source) from direct', () => {
    const summary = summariseAttribution([
      order({ utmSource: 'google', revenueCents: 1000 }),
      order({ utmSource: 'facebook', revenueCents: 2000 }),
      order({ revenueCents: 500 }), // direct
    ])
    expect(summary.totalOrders).toBe(3)
    expect(summary.totalRevenueCents).toBe(3500)
    expect(summary.attributedOrders).toBe(2)
    expect(summary.attributedRevenueCents).toBe(3000)
    expect(summary.directOrders).toBe(1)
    expect(summary.directRevenueCents).toBe(500)
    expect(summary.coverageRatio).toBeCloseTo(2 / 3, 5)
  })

  it('does not count a referrer-only order as attributed', () => {
    // A referrer without a utm_source is organic, not a tracked campaign.
    const summary = summariseAttribution([order({ referrer: 'google.com', revenueCents: 100 })])
    expect(summary.attributedOrders).toBe(0)
    expect(summary.coverageRatio).toBe(0)
  })

  it('is all zero for no orders', () => {
    const summary = summariseAttribution([])
    expect(summary.totalOrders).toBe(0)
    expect(summary.coverageRatio).toBe(0)
  })
})

describe('groupByDimension', () => {
  it('groups by source with a Direct bucket, ranked by revenue', () => {
    const rows = groupByDimension(
      [
        order({ utmSource: 'google', revenueCents: 1000 }),
        order({ utmSource: 'google', revenueCents: 500 }),
        order({ utmSource: 'facebook', revenueCents: 2000 }),
        order({ revenueCents: 300 }), // direct
      ],
      'source'
    )
    expect(rows.map((r) => r.key)).toEqual(['facebook', 'google', DIRECT_KEY])

    const google = rows.find((r) => r.key === 'google')!
    expect(google.orders).toBe(2)
    expect(google.revenueCents).toBe(1500)
    expect(google.aovCents).toBe(750)
    expect(google.direct).toBe(false)

    const direct = rows.find((r) => r.key === DIRECT_KEY)!
    expect(direct.direct).toBe(true)
    expect(direct.orders).toBe(1)
  })

  it('sums every row to the period total, unattributed included', () => {
    const orders = [
      order({ utmCampaign: 'launch', revenueCents: 1000 }),
      order({ revenueCents: 250 }),
    ]
    const rows = groupByDimension(orders, 'campaign')
    const summed = rows.reduce((n, r) => n + r.revenueCents, 0)
    expect(summed).toBe(1250)
  })

  it('does not merge a crafted value equal to the display label into the direct bucket', () => {
    // A malicious ?utm_source=Direct / none must stay its own row, distinct from the null bucket.
    const rows = groupByDimension(
      [
        order({ utmSource: 'Direct / none', revenueCents: 100 }),
        order({ revenueCents: 50 }), // genuinely direct
      ],
      'source'
    )
    const crafted = rows.find((r) => r.key === 'Direct / none')!
    expect(crafted.direct).toBe(false)
    expect(crafted.orders).toBe(1)
    const real = rows.find((r) => r.key === DIRECT_KEY)!
    expect(real.direct).toBe(true)
    expect(real.orders).toBe(1)
  })

  it('groups by referrer, bucketing missing referrers as direct', () => {
    const rows = groupByDimension(
      [
        order({ referrer: 'google.com', revenueCents: 100 }),
        order({ utmSource: 'x', revenueCents: 200 }), // no referrer → direct on this dimension
      ],
      'referrer'
    )
    expect(rows.find((r) => r.key === 'google.com')?.orders).toBe(1)
    expect(rows.find((r) => r.key === DIRECT_KEY)?.orders).toBe(1)
  })
})
