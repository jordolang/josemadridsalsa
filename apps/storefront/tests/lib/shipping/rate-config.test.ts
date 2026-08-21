import { describe, expect, it } from 'vitest'

import {
  DEFAULT_RATE_CONFIG,
  estimateDomesticCost,
  flatEstimateCost,
  internationalCost,
  parseStateSurcharges,
  resolveRateConfig,
  stateMultiplier,
} from '@/lib/shipping/rate-config'

describe('resolveRateConfig', () => {
  it('returns the built-in defaults for a null row', () => {
    expect(resolveRateConfig(null)).toEqual(DEFAULT_RATE_CONFIG)
  })

  it('falls back per-field when a stored value is null or invalid', () => {
    const config = resolveRateConfig({
      flatRateCents: 799,
      weightSurchargeBaseCents: null,
      weightSurchargePerLbCents: undefined,
      weightSurchargeThresholdLb: -3, // invalid → default
      internationalRateCents: null,
      stateSurcharges: null,
    })
    expect(config.flatRateCents).toBe(799) // overridden
    expect(config.weightSurchargeBaseCents).toBe(DEFAULT_RATE_CONFIG.weightSurchargeBaseCents)
    expect(config.weightSurchargePerLbCents).toBe(DEFAULT_RATE_CONFIG.weightSurchargePerLbCents)
    expect(config.weightSurchargeThresholdLb).toBe(DEFAULT_RATE_CONFIG.weightSurchargeThresholdLb)
    expect(config.internationalRateCents).toBe(DEFAULT_RATE_CONFIG.internationalRateCents)
    expect(config.stateSurcharges).toEqual(DEFAULT_RATE_CONFIG.stateSurcharges)
  })

  it('accepts a full override', () => {
    const config = resolveRateConfig({
      flatRateCents: 500,
      weightSurchargeBaseCents: 600,
      weightSurchargePerLbCents: 75,
      weightSurchargeThresholdLb: 3,
      internationalRateCents: 3000,
      stateSurcharges: { ak: 2, hi: 1.25 },
    })
    expect(config.flatRateCents).toBe(500)
    expect(config.weightSurchargeThresholdLb).toBe(3)
    expect(config.stateSurcharges).toEqual({ AK: 2, HI: 1.25 }) // upcased
  })

  it('keeps a saved-but-empty surcharge map as no surcharge (not the defaults)', () => {
    expect(resolveRateConfig({ stateSurcharges: {} }).stateSurcharges).toEqual({})
  })
})

describe('parseStateSurcharges', () => {
  const fallback = { AK: 1.5 }

  it('keeps only positive finite multipliers and upcases keys', () => {
    expect(parseStateSurcharges({ ak: 1.5, hi: 2, pr: 0, zz: -1, bad: 'x' }, fallback)).toEqual({
      AK: 1.5,
      HI: 2,
    })
  })

  it('falls back only when the value is absent or malformed', () => {
    expect(parseStateSurcharges(null, fallback)).toBe(fallback)
    expect(parseStateSurcharges(undefined, fallback)).toBe(fallback)
    expect(parseStateSurcharges('nope', fallback)).toBe(fallback)
    expect(parseStateSurcharges(['AK'], fallback)).toBe(fallback)
  })

  it('honours an explicit object, even when it filters down to empty (admin cleared all → ×1)', () => {
    // The key behaviour: a saved-but-empty map is "no surcharge", NOT the default map restored.
    expect(parseStateSurcharges({}, fallback)).toEqual({})
    expect(parseStateSurcharges({ zz: -1, bad: 'x' }, fallback)).toEqual({})
  })

  it('drops an absurdly large multiplier that would overflow a quote to Infinity', () => {
    expect(parseStateSurcharges({ AK: 1e6, HI: 2 }, fallback)).toEqual({ HI: 2 })
  })
})

describe('stateMultiplier', () => {
  it('is the configured multiplier, case-insensitive, or 1 when absent', () => {
    expect(stateMultiplier('ak', DEFAULT_RATE_CONFIG)).toBe(1.5)
    expect(stateMultiplier('PR', DEFAULT_RATE_CONFIG)).toBe(2)
    expect(stateMultiplier('OH', DEFAULT_RATE_CONFIG)).toBe(1)
  })
})

describe('estimateDomesticCost', () => {
  it('is the flat rate for a light order to the mainland', () => {
    expect(estimateDomesticCost({ pounds: 2, state: 'OH', config: DEFAULT_RATE_CONFIG })).toBe(6.99)
  })

  it('applies the state multiplier, matching the calculator rounding', () => {
    // 6.99 * 1.5 = 10.485 → 10.48 (toFixed, not round-half-up)
    expect(estimateDomesticCost({ pounds: 2, state: 'AK', config: DEFAULT_RATE_CONFIG })).toBe(10.48)
  })

  it('switches to weight-based pricing above the threshold', () => {
    // 10 lb: base 4.99 + (10 - 5) * 0.50 = 7.49, which beats the 6.99 flat.
    expect(estimateDomesticCost({ pounds: 10, state: 'OH', config: DEFAULT_RATE_CONFIG })).toBe(7.49)
  })

  it('keeps the flat rate at exactly the threshold weight', () => {
    expect(estimateDomesticCost({ pounds: 5, state: 'OH', config: DEFAULT_RATE_CONFIG })).toBe(6.99)
  })

  it('honours overridden config numbers', () => {
    const config = resolveRateConfig({ flatRateCents: 500, stateSurcharges: { AK: 2 } })
    expect(estimateDomesticCost({ pounds: 1, state: 'OH', config })).toBe(5)
    expect(estimateDomesticCost({ pounds: 1, state: 'AK', config })).toBe(10)
  })
})

describe('flatEstimateCost / internationalCost', () => {
  it('flatEstimateCost ignores weight and scales by state only', () => {
    expect(flatEstimateCost('OH', DEFAULT_RATE_CONFIG)).toBe(6.99)
    expect(flatEstimateCost('HI', DEFAULT_RATE_CONFIG)).toBe(10.48)
  })

  it('internationalCost is the flat international rate', () => {
    expect(internationalCost(DEFAULT_RATE_CONFIG)).toBe(24.99)
  })
})
