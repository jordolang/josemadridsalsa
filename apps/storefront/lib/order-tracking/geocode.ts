import prisma from '@/lib/prisma'
import { isMissingTableError, logMissingTableWarning } from '@/lib/prisma-errors'

export interface LatLng {
  lat: number
  lng: number
}

/**
 * Where OpenStreetMap's Nominatim geocoder lives. Free, no key, no per-request charge; its
 * usage policy asks for a User-Agent that identifies the app and at most one request a second.
 */
const NOMINATIM_URL = 'https://nominatim.openstreetmap.org/search'
const USER_AGENT = 'josemadridsalsa.com order tracking (https://www.josemadridsalsa.com/contact)'
const MIN_GAP_MS = 1100
const TIMEOUT_MS = 8000

// Requests leave one at a time, a second apart, however many pages are geocoding at once.
let queue: Promise<unknown> = Promise.resolve()
let lastRequestAt = 0

/**
 * Coordinates for a place, from the `geocoded_places` cache or, the first time a place is
 * seen, from Nominatim. The answer is cached either way, so a place is only ever sent to the
 * geocoder once. Returns null when the place is unknown or the geocoder can't be reached;
 * only a definite "no match" is cached, so an outage is retried on the next view.
 */
export async function geocode(query: string): Promise<LatLng | null> {
  const normalized = query.replace(/\s+/g, ' ').trim()
  if (!normalized) return null

  let cached: { lat: number | null; lng: number | null } | null
  try {
    cached = await prisma.geocodedPlace.findUnique({ where: { query: normalized } })
  } catch (error) {
    // Without the cache every view would re-geocode, which Nominatim's policy forbids.
    if (isMissingTableError(error)) {
      logMissingTableWarning('order-tracking map', 'geocoded_places')
      return null
    }
    throw error
  }
  if (cached) return cached.lat !== null && cached.lng !== null ? { lat: cached.lat, lng: cached.lng } : null

  const result = await lookup(normalized)
  if (result === undefined) return null

  await prisma.geocodedPlace.upsert({
    where: { query: normalized },
    create: { query: normalized, lat: result?.lat ?? null, lng: result?.lng ?? null },
    update: {},
  })
  return result
}

/** `undefined` when the geocoder could not be asked; `null` when it had no match. */
async function lookup(query: string): Promise<LatLng | null | undefined> {
  const run = queue.then(async () => {
    const wait = lastRequestAt + MIN_GAP_MS - Date.now()
    if (wait > 0) await new Promise((resolve) => setTimeout(resolve, wait))
    lastRequestAt = Date.now()
    return fetchNominatim(query)
  })
  queue = run.catch(() => undefined)
  return run
}

async function fetchNominatim(query: string): Promise<LatLng | null | undefined> {
  const url = `${NOMINATIM_URL}?format=jsonv2&limit=1&q=${encodeURIComponent(query)}`
  try {
    const response = await fetch(url, {
      headers: { 'User-Agent': USER_AGENT, Accept: 'application/json' },
      signal: AbortSignal.timeout(TIMEOUT_MS),
    })
    if (!response.ok) {
      console.error('Geocoder returned', response.status, 'for', query)
      return undefined
    }
    const results = (await response.json()) as Array<{ lat?: string; lon?: string }>
    const first = results[0]
    if (!first) return null
    const lat = Number(first.lat)
    const lng = Number(first.lon)
    return Number.isFinite(lat) && Number.isFinite(lng) ? { lat, lng } : null
  } catch (error) {
    console.error('Geocoder unreachable for', query, error)
    return undefined
  }
}
