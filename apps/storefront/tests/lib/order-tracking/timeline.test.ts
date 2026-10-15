import { describe, expect, it } from 'vitest'
import {
  buildCustomerTimeline,
  carrierLocation,
  firstLineOf,
  latestCarrierLocation,
  statusLabel,
} from '@/lib/order-tracking/timeline'

const placed = new Date('2026-10-01T15:00:00Z')

describe('buildCustomerTimeline', () => {
  it('always starts with the order being received', () => {
    const entries = buildCustomerTimeline({ order: { createdAt: placed } })
    expect(entries).toEqual([{ kind: 'received', at: placed, title: 'Order received' }])
  })

  it('merges every source newest first', () => {
    const entries = buildCustomerTimeline({
      order: { createdAt: placed },
      payments: [{ paidAt: new Date('2026-10-01T15:01:00Z') }, { paidAt: null }],
      statusChanges: [{ at: new Date('2026-10-02T12:00:00Z'), status: 'PROCESSING' }],
      updates: [{ at: new Date('2026-10-03T12:00:00Z'), kind: 'DELAY', message: 'At an event this weekend.' }],
      inboundEmails: [
        { at: new Date('2026-10-04T12:00:00Z'), subject: 'Where is my order?', body: '\nHi,\nIt has been a week.' },
      ],
      outboundEmails: [{ at: new Date('2026-10-01T15:02:00Z'), subject: 'Order JMS-1 confirmed' }],
    })

    expect(entries.map((e) => [e.kind, e.title])).toEqual([
      ['email_in', 'Email received: Where is my order?'],
      ['delay', 'Delay'],
      ['status', 'Status: Processing'],
      ['email_out', 'Email sent to you: Order JMS-1 confirmed'],
      ['payment', 'Payment received'],
      ['received', 'Order received'],
    ])
    expect(entries[0].detail).toBe('Hi,')
    expect(entries[1].detail).toBe('At an event this weekend.')
  })

  it('lists carrier scans with their location', () => {
    const entries = buildCustomerTimeline({
      order: { createdAt: placed },
      carrierEvents: [
        {
          status: 'in_transit',
          message: 'Arrived at USPS Regional Facility',
          datetime: '2026-10-05T08:00:00Z',
          tracking_location: { city: 'COLUMBUS', state: 'oh' },
        },
      ],
    })
    expect(entries[0]).toMatchObject({
      kind: 'carrier',
      title: 'Arrived at USPS Regional Facility',
      location: 'Columbus, OH',
    })
  })

  it('skips carrier scans without a usable time', () => {
    const entries = buildCustomerTimeline({
      order: { createdAt: placed },
      carrierEvents: [{ status: 'in_transit', message: 'No time', datetime: null }],
    })
    expect(entries).toHaveLength(1)
  })

  it('does not repeat delivery when the carrier already reported it', () => {
    const deliveredAt = new Date('2026-10-06T18:00:00Z')
    const entries = buildCustomerTimeline({
      order: { createdAt: placed, deliveredAt },
      carrierEvents: [{ status: 'delivered', message: 'Delivered', datetime: deliveredAt.toISOString() }],
    })
    expect(entries.filter((e) => e.kind === 'delivered')).toHaveLength(1)
  })

  it('falls back to the order timestamps when there are no scans', () => {
    const entries = buildCustomerTimeline({
      order: {
        createdAt: placed,
        shippedAt: new Date('2026-10-05T12:00:00Z'),
        deliveredAt: new Date('2026-10-07T12:00:00Z'),
        carrierName: 'USPS',
        trackingNumber: '9400',
      },
    })
    expect(entries.map((e) => e.kind)).toEqual(['delivered', 'shipped', 'received'])
    expect(entries[1].detail).toBe('USPS · 9400')
  })
})

describe('firstLineOf', () => {
  it('skips blank lines and quoted reply text', () => {
    expect(firstLineOf('\n\n> earlier message\nOn Mon, Oct 1, Jose wrote:\nThanks!')).toBe('Thanks!')
  })

  it('shortens a long first line', () => {
    const line = firstLineOf('x'.repeat(500))
    expect(line?.length).toBeLessThanOrEqual(140)
    expect(line?.endsWith('…')).toBe(true)
  })

  it('returns null for empty text', () => {
    expect(firstLineOf('')).toBeNull()
    expect(firstLineOf(null)).toBeNull()
  })
})

describe('carrier locations', () => {
  it('formats a city and state', () => {
    expect(carrierLocation({ tracking_location: { city: 'NEW YORK', state: 'ny' } })).toBe('New York, NY')
  })

  it('falls back to the country', () => {
    expect(carrierLocation({ tracking_location: { country: 'US' } })).toBe('US')
  })

  it('picks the newest scan that has a place', () => {
    expect(
      latestCarrierLocation([
        { datetime: '2026-10-05T08:00:00Z', tracking_location: { city: 'Columbus', state: 'OH' } },
        { datetime: '2026-10-06T08:00:00Z', tracking_location: null },
        { datetime: '2026-10-04T08:00:00Z', tracking_location: { city: 'Zanesville', state: 'OH' } },
      ])
    ).toBe('Columbus, OH')
  })

  it('returns null without scans', () => {
    expect(latestCarrierLocation([])).toBeNull()
    expect(latestCarrierLocation(null)).toBeNull()
  })
})

describe('statusLabel', () => {
  it('names known statuses and title-cases unknown ones', () => {
    expect(statusLabel('PROCESSING')).toBe('Processing')
    expect(statusLabel('ON_HOLD')).toBe('On Hold')
  })
})
