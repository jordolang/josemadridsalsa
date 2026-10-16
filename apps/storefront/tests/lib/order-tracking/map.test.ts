import { beforeEach, describe, expect, it, vi } from 'vitest'

vi.mock('@/lib/order-tracking/geocode', () => ({
  geocode: vi.fn(),
  geocodeBudget: () => ({ deadline: Number.MAX_SAFE_INTEGER, failed: false }),
}))

import { geocode } from '@/lib/order-tracking/geocode'
import { buildShipmentRoute, HQ_ADDRESS, HQ_LABEL, loadShipmentMap } from '@/lib/order-tracking/map'

const hq = { lat: 39.93, lng: -82.01, label: HQ_LABEL }
const columbus = { lat: 39.96, lng: -83.0 }
const chicago = { lat: 41.88, lng: -87.63 }
const destination = { lat: 41.9, lng: -87.7, label: 'Chicago, IL' }

describe('buildShipmentRoute', () => {
  it('keeps the salsa at headquarters until the carrier scans it', () => {
    const route = buildShipmentRoute({ hq, destination, scans: [], shipped: false, delivered: false })
    expect(route.salsa).toEqual(hq)
    expect(route.path).toEqual([hq])
    expect(route.destination).toEqual(destination)
  })

  it('traces the scans in time order, collapsing repeats at one place', () => {
    const route = buildShipmentRoute({
      hq,
      destination,
      scans: [
        { label: 'Chicago, IL', at: 3, point: chicago },
        { label: 'Columbus, OH', at: 1, point: columbus },
        { label: 'Columbus, OH', at: 2, point: columbus },
      ],
      shipped: true,
      delivered: false,
    })
    expect(route.path.map((p) => p.label)).toEqual([HQ_LABEL, 'Columbus, OH', 'Chicago, IL'])
    expect(route.salsa).toEqual({ ...chicago, label: 'Chicago, IL' })
  })

  it('skips scans that could not be placed', () => {
    const route = buildShipmentRoute({
      hq,
      destination: null,
      scans: [{ label: 'Somewhere', at: 1, point: null }],
      shipped: true,
      delivered: false,
    })
    expect(route.path).toEqual([hq])
  })

  it('ends at the destination once delivered', () => {
    const route = buildShipmentRoute({
      hq,
      destination,
      scans: [{ label: 'Chicago, IL', at: 1, point: chicago }],
      shipped: true,
      delivered: true,
    })
    expect(route.path.map((p) => p.label)).toEqual([HQ_LABEL, 'Chicago, IL', 'Chicago, IL'])
    expect(route.salsa).toEqual(destination)
  })
})

describe('loadShipmentMap', () => {
  beforeEach(() => vi.mocked(geocode).mockReset())

  it('geocodes headquarters, the address and each scan by zip', async () => {
    const answers: Record<string, { lat: number; lng: number } | null> = {
      [HQ_ADDRESS]: hq,
      '12 Lake St, Chicago, IL 60601, US': destination,
      'Columbus, OH 43215, US': columbus,
    }
    vi.mocked(geocode).mockImplementation(async (query) => answers[query] ?? null)

    const map = await loadShipmentMap({
      shippingAddress: { street: '12 Lake St', city: 'Chicago', state: 'IL', zipCode: '60601', country: 'US' },
      carrierEvents: [
        {
          status: 'in_transit',
          datetime: '2026-10-02T10:00:00Z',
          tracking_location: { city: 'COLUMBUS', state: 'OH', zip: '43215', country: 'US' },
        },
        { status: 'pre_transit', datetime: '2026-10-01T10:00:00Z', tracking_location: null },
      ],
      shipped: true,
      delivered: false,
    })

    expect(map.destination).toEqual({ ...destination, label: 'Chicago, IL' })
    expect(map.path.map((p) => p.label)).toEqual([HQ_LABEL, 'Columbus, OH'])
    expect(vi.mocked(geocode).mock.calls.map(([q]) => q)).toEqual([
      HQ_ADDRESS,
      '12 Lake St, Chicago, IL 60601, US',
      'Columbus, OH 43215, US',
    ])
  })

  it('falls back to the city when the street is unknown, and to fixed coordinates for headquarters', async () => {
    vi.mocked(geocode).mockImplementation(async (query) =>
      query === 'Chicago, IL 60601, US' ? destination : null
    )

    const map = await loadShipmentMap({
      shippingAddress: { street: 'Nowhere', city: 'Chicago', state: 'IL', zipCode: '60601', country: 'US' },
      carrierEvents: [],
      shipped: false,
      delivered: false,
    })

    expect(map.destination).toEqual({ ...destination, label: 'Chicago, IL' })
    expect(map.salsa.label).toBe(HQ_LABEL)
    expect(map.salsa.lat).toBeCloseTo(39.93, 1)
  })
})
