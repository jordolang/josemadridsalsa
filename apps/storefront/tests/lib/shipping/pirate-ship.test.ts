import { describe, expect, it } from 'vitest'
import { parseCsv } from '@/lib/csv'
import {
  PIRATE_SHIP_HEADERS,
  buildPirateShipCsv,
  buildPirateShipRow,
  computeParcel,
  isReadyToShip,
  parseTrackingRows,
  trackingUrlFor,
  type ComputedParcel,
  type PirateShipRecipient,
} from '@/lib/shipping/pirate-ship'
import { DEFAULT_JAR_CONTENTS_OZ, packJars } from '@/lib/shipping/jar-packing'

const recipient = (overrides: Partial<PirateShipRecipient> = {}): PirateShipRecipient => ({
  reference: 'JMS-1001',
  name: 'Jane Doe',
  address1: '123 Salsa St',
  city: 'Zanesville',
  state: 'OH',
  zip: '43701',
  country: 'US',
  ...overrides,
})

const parcel = (overrides: Partial<ComputedParcel> = {}): ComputedParcel => ({
  weightLb: 2,
  weightOz: 4,
  totalOunces: 36,
  lengthIn: 11,
  widthIn: 8.5,
  heightIn: 5.5,
  unitCount: 4,
  ...overrides,
})

describe('computeParcel', () => {
  it('reads product weight as ounces of contents, not pounds (regression: 6 jars exported as 96 lb)', () => {
    // Product.weight for a 16oz jar is 16. Six of them must be ~11 lb, never 96.
    const result = computeParcel([{ quantity: 6, weightOz: 16 }])
    expect(result.weightLb).toBeLessThan(15)
    expect(result.totalOunces).toBe(Math.ceil(packJars(6, 96).weightOz))
  })

  it('declares the same weight checkout and EasyPost use, rounded up to whole ounces', () => {
    const result = computeParcel([
      { quantity: 2, weightOz: 16 },
      { quantity: 1, weightOz: 13 },
    ])
    const expected = Math.ceil(packJars(3, 2 * 16 + 13).weightOz)
    expect(result.totalOunces).toBe(expected)
    expect(result.weightLb * 16 + result.weightOz).toBe(expected)
  })

  it('falls back to a standard jar when a product has no weight', () => {
    const result = computeParcel([{ quantity: 1, weightOz: null }])
    expect(result.totalOunces).toBe(Math.ceil(packJars(1, DEFAULT_JAR_CONTENTS_OZ).weightOz))
  })

  it('never returns zero weight for an empty order', () => {
    expect(computeParcel([]).totalOunces).toBeGreaterThan(0)
  })

  it('picks the 1–3 jar box for a few units when no product dims are set', () => {
    const result = computeParcel([{ quantity: 3, weightOz: 16 }])
    expect({ l: result.lengthIn, w: result.widthIn, h: result.heightIn }).toEqual({
      l: 10,
      w: 7,
      h: 5,
    })
    expect(result.unitCount).toBe(3)
  })

  it('uses the same warehouse boxes as checkout as unit count grows', () => {
    const dims = (quantity: number) => {
      const r = computeParcel([{ quantity, weightOz: 16 }])
      return [r.lengthIn, r.widthIn, r.heightIn]
    }
    expect(dims(5)).toEqual([12, 9, 6])
    expect(dims(12)).toEqual([14, 10, 8])
    expect(dims(20)).toEqual([20, 15, 9])
  })

  it('uses the largest product dimensions when items carry their own', () => {
    const result = computeParcel([
      { quantity: 1, weightOz: 16, lengthIn: 10, widthIn: 4, heightIn: 4 },
      { quantity: 1, weightOz: 16, lengthIn: 6, widthIn: 9, heightIn: 3 },
    ])
    expect(result.lengthIn).toBe(10)
    expect(result.widthIn).toBe(9)
    expect(result.heightIn).toBe(4)
  })

  it('ignores non-positive quantities', () => {
    const result = computeParcel([
      { quantity: 0, weightOz: 80 },
      { quantity: -2, weightOz: 80 },
      { quantity: 1, weightOz: 16 },
    ])
    expect(result.unitCount).toBe(1)
    expect(result.totalOunces).toBe(Math.ceil(packJars(1, 16).weightOz))
  })
})

describe('buildPirateShipRow', () => {
  it('aligns values to the header order and defaults country to US', () => {
    const row = buildPirateShipRow(recipient({ country: null }), parcel())
    expect(row).toHaveLength(PIRATE_SHIP_HEADERS.length)
    expect(row[PIRATE_SHIP_HEADERS.indexOf('Order')]).toBe('JMS-1001')
    expect(row[PIRATE_SHIP_HEADERS.indexOf('Country')]).toBe('US')
    expect(row[PIRATE_SHIP_HEADERS.indexOf('Weight (lb)')]).toBe('2')
    expect(row[PIRATE_SHIP_HEADERS.indexOf('Weight (oz)')]).toBe('4')
  })

  it('leaves optional fields blank rather than printing null', () => {
    const row = buildPirateShipRow(recipient({ company: null, email: null }), parcel())
    expect(row[PIRATE_SHIP_HEADERS.indexOf('Company')]).toBe('')
    expect(row[PIRATE_SHIP_HEADERS.indexOf('Email')]).toBe('')
  })
})

describe('buildPirateShipCsv', () => {
  it('produces a header row plus one row per shipment that round-trips', () => {
    const csv = buildPirateShipCsv([
      { recipient: recipient(), parcel: parcel() },
      { recipient: recipient({ reference: 'JMS-1002', name: 'Bob, Jr.' }), parcel: parcel() },
    ])
    const { headers, rows } = parseCsv(csv)
    expect(headers).toEqual([...PIRATE_SHIP_HEADERS])
    expect(rows).toHaveLength(2)
    // Comma inside a value survives the round trip.
    expect(rows[1].Name).toBe('Bob, Jr.')
    expect(rows[0].Order).toBe('JMS-1001')
  })
})

describe('parseTrackingRows', () => {
  it('maps varied headers and keeps only rows with reference + tracking', () => {
    const csv = [
      'Order Number,Tracking Number,Carrier',
      'JMS-1001,9400100000000000000000,USPS',
      'JMS-1002,,USPS',
      ',9400111111111111111111,USPS',
    ].join('\n')
    const { headers, rows } = parseCsv(csv)
    const { mapping, parsed } = parseTrackingRows(headers, rows)
    expect(mapping.reference).toBe('Order Number')
    expect(mapping.trackingNumber).toBe('Tracking Number')
    expect(parsed).toHaveLength(1)
    expect(parsed[0]).toEqual({
      reference: 'JMS-1001',
      trackingNumber: '9400100000000000000000',
      carrier: 'USPS',
    })
  })

  it('returns no reference mapping when the column is absent', () => {
    const { headers, rows } = parseCsv('Tracking,Carrier\n94001,USPS')
    const { mapping } = parseTrackingRows(headers, rows)
    expect(mapping.reference).toBeUndefined()
    expect(mapping.trackingNumber).toBe('Tracking')
  })
})

describe('trackingUrlFor', () => {
  it('builds a USPS url from carrier or number prefix', () => {
    expect(trackingUrlFor('USPS', '9400123')).toContain('usps.com')
    expect(trackingUrlFor(null, '9400123')).toContain('usps.com')
  })

  it('builds a UPS url from a 1Z number', () => {
    expect(trackingUrlFor(null, '1Z999AA10123456784')).toContain('ups.com')
  })

  it('returns undefined for an unknown carrier/number', () => {
    expect(trackingUrlFor('DHL', '123456')).toBeUndefined()
  })
})

describe('isReadyToShip', () => {
  const ready = {
    status: 'PROCESSING',
    paymentStatus: 'PAID',
    fulfillmentStatus: 'UNFULFILLED',
    hasShippingAddress: true,
  }

  it('accepts a paid, open, unshipped order with an address', () => {
    expect(isReadyToShip(ready)).toBe(true)
    expect(isReadyToShip({ ...ready, status: 'PENDING', paymentStatus: 'SUCCEEDED' })).toBe(true)
    expect(isReadyToShip({ ...ready, fulfillmentStatus: 'PARTIALLY_FULFILLED' })).toBe(true)
  })

  it('rejects an order with no shipping address', () => {
    expect(isReadyToShip({ ...ready, hasShippingAddress: false })).toBe(false)
  })

  it('rejects an unpaid order', () => {
    expect(isReadyToShip({ ...ready, paymentStatus: 'PENDING' })).toBe(false)
    expect(isReadyToShip({ ...ready, paymentStatus: 'REFUNDED' })).toBe(false)
  })

  it('rejects an order that has shipped or closed', () => {
    expect(isReadyToShip({ ...ready, status: 'SHIPPED' })).toBe(false)
    expect(isReadyToShip({ ...ready, status: 'CANCELLED' })).toBe(false)
    expect(isReadyToShip({ ...ready, fulfillmentStatus: 'FULFILLED' })).toBe(false)
  })
})
