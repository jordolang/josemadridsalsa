import { describe, it, expect } from 'vitest'
import { isShippingAddressReadyForRates } from '@/lib/checkout/shipping-address'

const complete = {
  address1: '1 Main St',
  city: 'Zanesville',
  state: 'OH',
  postalCode: '43701',
}

describe('isShippingAddressReadyForRates', () => {
  it('accepts a complete address that would pass server validation', () => {
    expect(isShippingAddressReadyForRates(complete)).toBe(true)
  })

  it('accepts a 9-digit ZIP+4', () => {
    expect(
      isShippingAddressReadyForRates({ ...complete, postalCode: '43701-1234' })
    ).toBe(true)
  })

  // Regression: the client used to fire the rate request on presence alone,
  // so a mid-typed ZIP (< 5 chars) or state (< 2 chars) triggered a request
  // the server rejected with "Invalid shipping calculation request".
  it('rejects a ZIP that is still being typed (fewer than 5 chars)', () => {
    expect(
      isShippingAddressReadyForRates({ ...complete, postalCode: '4370' })
    ).toBe(false)
  })

  it('rejects a state that is still being typed (fewer than 2 chars)', () => {
    expect(isShippingAddressReadyForRates({ ...complete, state: 'O' })).toBe(
      false
    )
  })

  it('rejects whitespace-only required fields', () => {
    expect(isShippingAddressReadyForRates({ ...complete, city: '   ' })).toBe(
      false
    )
    expect(
      isShippingAddressReadyForRates({ ...complete, address1: '  ' })
    ).toBe(false)
  })

  it('rejects an empty address', () => {
    expect(
      isShippingAddressReadyForRates({
        address1: '',
        city: '',
        state: '',
        postalCode: '',
      })
    ).toBe(false)
  })
})
