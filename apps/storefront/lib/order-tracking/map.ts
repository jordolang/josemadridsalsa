import { geocode, type LatLng } from '@/lib/order-tracking/geocode'
import { carrierLocation, type CarrierEvent } from '@/lib/order-tracking/timeline'

export interface MapStop extends LatLng {
  /** What the tooltip says, e.g. "Columbus, OH". */
  label: string
}

/** What the tracking map draws. */
export interface ShipmentMapData {
  /** Where the salsa is right now. */
  salsa: MapStop
  /** Everywhere the salsa has been, headquarters first; the blue line joins these in order. */
  path: MapStop[]
  /** Where the order is going, when the viewer may see it. */
  destination: MapStop | null
  shipped: boolean
  delivered: boolean
}

export const HQ_ADDRESS = '601 Putnam Ave, Zanesville, OH 43701'
export const HQ_LABEL = 'Jose Madrid Salsa headquarters'
/** Roughly 601 Putnam Ave; used only when the geocoder has never answered for it. */
const HQ_FALLBACK: LatLng = { lat: 39.9336, lng: -82.0149 }

export interface ShipmentScan {
  label: string
  /** Epoch milliseconds of the scan. */
  at: number
  point: LatLng | null
}

/**
 * The salsa's journey so far, from carrier scans that could be placed on the map.
 *
 * Until the carrier scans the package it is still at headquarters. Each scan in a new place
 * extends the path; repeated scans in one place (a package can be scanned several times at a
 * facility) collapse into a single stop. Once delivered, the path ends at the destination.
 */
export function buildShipmentRoute(input: {
  hq: MapStop
  destination: MapStop | null
  scans: ShipmentScan[]
  shipped: boolean
  delivered: boolean
}): ShipmentMapData {
  const path: MapStop[] = [input.hq]
  const placed = input.scans
    .filter((scan): scan is ShipmentScan & { point: LatLng } => scan.point !== null)
    .sort((a, b) => a.at - b.at)
  for (const scan of placed) {
    const stop = { ...scan.point, label: scan.label }
    if (!samePlace(path[path.length - 1], stop)) path.push(stop)
  }
  if (input.delivered && input.destination && !samePlace(path[path.length - 1], input.destination)) {
    path.push(input.destination)
  }
  return {
    salsa: path[path.length - 1],
    path,
    destination: input.destination,
    shipped: input.shipped,
    delivered: input.delivered,
  }
}

function samePlace(a: LatLng, b: LatLng): boolean {
  return a.lat === b.lat && a.lng === b.lng
}

export interface ShippingAddress {
  street: string
  city: string
  state: string
  zipCode: string
  country: string
}

/**
 * Geocode everything the map needs and build the route. Each place is geocoded once and
 * cached, so after the first view this is only database reads.
 */
export async function loadShipmentMap(input: {
  shippingAddress: ShippingAddress | null
  carrierEvents: CarrierEvent[]
  shipped: boolean
  delivered: boolean
}): Promise<ShipmentMapData> {
  const hq = { ...((await geocode(HQ_ADDRESS)) ?? HQ_FALLBACK), label: HQ_LABEL }
  const destination = input.shippingAddress ? await geocodeDestination(input.shippingAddress) : null

  const scans: ShipmentScan[] = []
  for (const event of input.carrierEvents) {
    const label = carrierLocation(event)
    const at = event.datetime ? new Date(event.datetime).getTime() : NaN
    if (!label || Number.isNaN(at)) continue
    scans.push({ label, at, point: await geocode(scanQuery(event, label)) })
  }

  return buildShipmentRoute({ hq, destination, scans, shipped: input.shipped, delivered: input.delivered })
}

/** The full address first; if the geocoder doesn't know the street, the city will do. */
async function geocodeDestination(address: ShippingAddress): Promise<MapStop | null> {
  const country = address.country || 'US'
  const cityLine = `${address.city}, ${address.state} ${address.zipCode}, ${country}`
  const point = (await geocode(`${address.street}, ${cityLine}`)) ?? (await geocode(cityLine))
  return point ? { ...point, label: `${address.city}, ${address.state}` } : null
}

/** "Columbus, OH 43215, US": the zip pins the carrier facility better than the city alone. */
function scanQuery(event: CarrierEvent, label: string): string {
  const loc = event.tracking_location
  return [[label, loc?.zip].filter(Boolean).join(' '), loc?.country || 'US'].join(', ')
}
