import { describe, expect, it } from 'vitest'
import { parseCsv } from '@/lib/csv'
import {
  DEFAULT_UNIT_WEIGHT_LB,
  PACKAGING_TARE_LB,
  PIRATE_SHIP_HEADERS,
  buildPirateShipCsv,
  buildPirateShipRow,
  computeParcel,
  parseTrackingRows,
  trackingUrlFor,
  type ComputedParcel,
  type PirateShipRecipient,
} from '@/lib/shipping/pirate-ship'

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
  it('sums product weights, adds tare, and rounds up to whole ounces', () => {
    // 2 units x 1 lb + 0.5 lb tare = 2.5 lb = 40 oz
    const result = computeParcel([{ quantity: 2, weightLb: 1 }])
    expect(result.totalOunces).toBe(Math.ceil((2 * 1 + PACKAGING_TARE_LB) * 16))
    expect(result.totalOunces).toBe(40)
    expect(result.weightLb).toBe(2)
    expect(result.weightOz).toBe(8)
  })

  it('falls back to the default unit weight when a product has no weight', () => {
    const result = computeParcel([{ quantity: 1, weightLb: null }])
    const expected = Math.ceil((DEFAULT_UNIT_WEIGHT_LB + PACKAGING_TARE_LB) * 16)
    expect(result.totalOunces).toBe(expected)
  })

  it('rounds partial ounces up so postage is never underpaid', () => {
    // 0.01 lb + 0.5 tare = 0.51 lb = 8.16 oz -> ceil 9
    const result = computeParcel([{ quantity: 1, weightLb: 0.01 }])
    expect(result.totalOunces).toBe(9)
  })

  it('never returns zero weight for an empty order', () => {
    const result = computeParcel([])
    // Just the tare, rounded up.
    expect(result.totalOunces).toBe(Math.ceil(PACKAGING_TARE_LB * 16))
    expect(result.totalOunces).toBeGreaterThan(0)
  })

  it('picks a small box for a few units when no product dims are set', () => {
    const result = computeParcel([{ quantity: 3, weightLb: 1 }])
    expect({ l: result.lengthIn, w: result.widthIn, h: result.heightIn }).toEqual({
      l: 8,
      w: 6,
      h: 4,
    })
    expect(result.unitCount).toBe(3)
  })

  it('escalates box size as unit count grows', () => {
    const large = computeParcel([{ quantity: 12, weightLb: 1 }])
    expect(large.lengthIn).toBe(16)
    const xl = computeParcel([{ quantity: 40, weightLb: 1 }])
    expect(xl.lengthIn).toBe(18)
  })

  it('uses the largest product dimensions when items carry their own', () => {
    const result = computeParcel([
      { quantity: 1, weightLb: 1, lengthIn: 10, widthIn: 4, heightIn: 4 },
      { quantity: 1, weightLb: 1, lengthIn: 6, widthIn: 9, heightIn: 3 },
    ])
    expect(result.lengthIn).toBe(10)
    expect(result.widthIn).toBe(9)
    expect(result.heightIn).toBe(4)
  })

  it('ignores non-positive quantities', () => {
    const result = computeParcel([
      { quantity: 0, weightLb: 5 },
      { quantity: -2, weightLb: 5 },
      { quantity: 1, weightLb: 1 },
    ])
    expect(result.unitCount).toBe(1)
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
