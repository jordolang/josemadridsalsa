import { describe, expect, it } from 'vitest'

import {
  EXTERNAL_LABEL_SOURCE,
  filterRates,
  isRealPostage,
  selectRate,
  type SelectableRate,
} from '@/lib/shipping/rate-selection'

describe('isRealPostage', () => {
  it('counts a real EasyPost purchase', () => {
    expect(isRealPostage({ trackingCode: '9400111899223197428490' })).toBe(true)
  })

  it('counts postage bought through Pirate Ship', () => {
    expect(
      isRealPostage({ trackingCode: null, carrierResponse: { source: EXTERNAL_LABEL_SOURCE } })
    ).toBe(true)
  })

  it('does NOT count a legacy mock row, so it cannot block a real purchase', () => {
    // The old route wrote `${CARRIER}${Date.now()}` into trackingNumber and bought nothing. An
    // order carrying one of those has never shipped, so buying a real label must still be allowed.
    expect(isRealPostage({ trackingCode: null, carrierResponse: { rateId: 'x', testMode: true } })).toBe(
      false
    )
  })

  it('treats a row with no carrier response as not real', () => {
    expect(isRealPostage({})).toBe(false)
    expect(isRealPostage({ trackingCode: null, carrierResponse: null })).toBe(false)
  })

  it('is not fooled by a non-object carrier response', () => {
    expect(isRealPostage({ carrierResponse: 'external' })).toBe(false)
  })
})

const rates: SelectableRate[] = [
  { id: 'r1', carrier: 'USPS', service: 'GroundAdvantage', rate: 7.45, deliveryDays: 4 },
  { id: 'r2', carrier: 'UPS', service: 'Ground', rate: 11.2, deliveryDays: 3 },
  { id: 'r3', carrier: 'USPS', service: 'Priority', rate: 9.1, deliveryDays: 2 },
]

describe('selectRate', () => {
  it('picks the cheapest by default', () => {
    const result = selectRate(rates)
    if (!result.ok) throw new Error('expected a rate')
    expect(result.rate.id).toBe('r1')
  })

  it('honours a pinned rate even when it is not the cheapest', () => {
    const result = selectRate(rates, 'r2')
    if (!result.ok) throw new Error('expected a rate')
    expect(result.rate.id).toBe('r2')
  })

  it('errors on an expired pinned rate rather than silently downgrading the service', () => {
    // Quietly buying the cheapest instead is how a promised delivery date gets missed.
    const result = selectRate(rates, 'gone')
    expect(result.ok).toBe(false)
    if (result.ok) return
    expect(result.message).toContain('no longer available')
  })

  it('errors when the carrier quoted nothing', () => {
    const result = selectRate([])
    expect(result.ok).toBe(false)
    if (result.ok) return
    expect(result.message).toContain('No carrier')
  })

  it('is stable when two rates tie on price', () => {
    const tied: SelectableRate[] = [
      { id: 'a', carrier: 'USPS', service: 'X', rate: 5 },
      { id: 'b', carrier: 'UPS', service: 'Y', rate: 5 },
    ]
    expect(selectRate(tied).ok && selectRate(tied)).toMatchObject({ rate: { id: 'a' } })
  })
})

describe('filterRates', () => {
  it('returns everything when nothing is pinned', () => {
    expect(filterRates(rates)).toHaveLength(3)
  })

  it('narrows by carrier', () => {
    expect(filterRates(rates, 'USPS').map((r) => r.id)).toEqual(['r1', 'r3'])
  })

  it('matches carrier case-insensitively, since codes are stored lower case', () => {
    // Stored carrier codes are `usps`; EasyPost returns `USPS`.
    expect(filterRates(rates, 'usps')).toHaveLength(2)
  })

  it('narrows by service', () => {
    expect(filterRates(rates, undefined, 'priority').map((r) => r.id)).toEqual(['r3'])
  })

  it('narrows by both', () => {
    expect(filterRates(rates, 'usps', 'groundadvantage').map((r) => r.id)).toEqual(['r1'])
  })

  it('returns nothing when the combination is not offered', () => {
    expect(filterRates(rates, 'ups', 'Priority')).toHaveLength(0)
  })
})
