import { describe, expect, it } from 'vitest'

import {
  buildReturnAddresses,
  selectReturnRate,
  type CustomerAddressInput,
} from '@/lib/shipping/return-label'

const customer: CustomerAddressInput = {
  firstName: 'Dana',
  lastName: 'Reyes',
  street: '14 Maple St',
  city: 'Columbus',
  state: 'OH',
  zipCode: '43004',
  country: 'US',
  phone: '6145550111',
}

const warehouse = {
  name: 'Jose Madrid Salsa',
  street: '321 Market St',
  city: 'Zanesville',
  state: 'OH',
  zipCode: '43701',
  country: 'US',
}

describe('buildReturnAddresses', () => {
  it('swaps the addresses so the customer ships and the warehouse receives', () => {
    const result = buildReturnAddresses(customer, warehouse)
    expect(result.ok).toBe(true)
    if (!result.ok) return

    // The whole point of the module: getting this backwards ships the goods to the customer
    // a second time.
    expect(result.addresses.from.city).toBe('Columbus')
    expect(result.addresses.to.city).toBe('Zanesville')
  })

  it('names the customer from their address', () => {
    const result = buildReturnAddresses(customer, warehouse)
    if (!result.ok) throw new Error('expected addresses')
    expect(result.addresses.from.name).toBe('Dana Reyes')
  })

  it('falls back to a placeholder rather than an empty sender name', () => {
    const result = buildReturnAddresses(
      { ...customer, firstName: null, lastName: '  ' },
      warehouse
    )
    if (!result.ok) throw new Error('expected addresses')
    expect(result.addresses.from.name).toBe('Customer')
  })

  it('refuses when the order has no shipping address', () => {
    const result = buildReturnAddresses(null, warehouse)
    expect(result.ok).toBe(false)
    if (result.ok) return
    expect(result.error.code).toBe('NO_CUSTOMER_ADDRESS')
  })

  it('refuses an incomplete warehouse address and says what is missing', () => {
    // EasyPost accepts a partial address and prints an undeliverable label, so this has to
    // fail here rather than at the carrier.
    const result = buildReturnAddresses(customer, { ...warehouse, city: '', zipCode: '   ' })
    expect(result.ok).toBe(false)
    if (result.ok) return
    expect(result.error.code).toBe('INCOMPLETE_WAREHOUSE_ADDRESS')
    if (result.error.code !== 'INCOMPLETE_WAREHOUSE_ADDRESS') return
    expect(result.error.missing).toEqual(['city', 'postal code'])
  })

  it('defaults the country on both ends', () => {
    const result = buildReturnAddresses(
      { ...customer, country: null },
      { ...warehouse, country: undefined }
    )
    if (!result.ok) throw new Error('expected addresses')
    expect(result.addresses.from.country).toBe('US')
    expect(result.addresses.to.country).toBe('US')
  })

  it('omits the phone rather than sending an empty one', () => {
    const result = buildReturnAddresses({ ...customer, phone: null }, warehouse)
    if (!result.ok) throw new Error('expected addresses')
    expect(result.addresses.from.phone).toBeUndefined()
  })
})

describe('selectReturnRate', () => {
  const rates = [
    { id: 'rate_a', carrier: 'USPS', service: 'GroundAdvantage', rate: 7.45 },
    { id: 'rate_b', carrier: 'UPS', service: 'Ground', rate: 11.2 },
    { id: 'rate_c', carrier: 'USPS', service: 'Priority', rate: 9.1 },
  ]

  it('buys the cheapest rate by default, since the business is paying', () => {
    const result = selectReturnRate(rates)
    if (!result.ok) throw new Error('expected a rate')
    expect(result.rate.id).toBe('rate_a')
  })

  it('honours a pinned rate', () => {
    const result = selectReturnRate(rates, 'rate_b')
    if (!result.ok) throw new Error('expected a rate')
    expect(result.rate.id).toBe('rate_b')
  })

  it('errors on a pinned rate that has expired rather than silently buying the cheapest', () => {
    const result = selectReturnRate(rates, 'rate_gone')
    expect(result.ok).toBe(false)
    if (result.ok) return
    expect(result.message).toContain('no longer available')
  })

  it('errors when no carrier quoted anything', () => {
    const result = selectReturnRate([])
    expect(result.ok).toBe(false)
    if (result.ok) return
    expect(result.message).toContain('No carrier')
  })
})
