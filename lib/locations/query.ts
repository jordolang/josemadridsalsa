import { parseFindUsMarkdown, readFindUsMarkdownAbsolute } from '@/lib/find-us-parser'
import locationPhotos from '@/public/location-photos.json' assert { type: 'json' }
import { readFile } from 'fs/promises'
import { join } from 'path'
import {
  filterLocations,
  normalizeFilters,
  type LocationFilters,
  type NormalizedLocationFilters,
  type RetailLocationRecord,
  type LocationsQueryResult,
} from './shared'

// Simple in-memory cache
let cachedLocations: RetailLocationRecord[] | null = null
let cacheTimestamp = 0
const CACHE_TTL = 3600 * 1000 // 1 hour in milliseconds

const LOCATION_PHOTO_MAP = locationPhotos as Record<string, string>
const DEFAULT_REVIEW_RATING = 4.3
const DEFAULT_REVIEW_COUNT = 149
const DEFAULT_HOURS_SUMMARY = 'Call store for the latest hours'

const formatFullAddress = (address: string, city: string, state: string, zipCode?: string | null) =>
  `${address}, ${city}, ${state}${zipCode ? ` ${zipCode}` : ''}`

const buildDirectionsUrl = (address: string, city: string, state: string, zipCode?: string | null) =>
  `https://www.google.com/maps/dir/?api=1&destination=${encodeURIComponent(formatFullAddress(address, city, state, zipCode))}`

const buildGoogleMapsUrl = (
  address: string,
  city: string,
  state: string,
  zipCode: string | null,
  placeId?: string | null,
) => {
  if (placeId) {
    return `https://www.google.com/maps/place/?q=place_id:${placeId}`
  }
  return `https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(formatFullAddress(address, city, state, zipCode))}`
}

const extractPlaceIdFromPhotoUrl = (url?: string | null): string | null => {
  if (!url) return null
  const match = url.match(/\/places\/([^/]+)\/photos\//i)
  return match ? match[1] : null
}

const normalizePhoto = (id: string): { url: string; placeId: string | null } => {
  const url = LOCATION_PHOTO_MAP[id]
  if (!url) {
    return { url: '/images/store-placeholder.png', placeId: null }
  }
  return { url, placeId: extractPlaceIdFromPhotoUrl(url) }
}

const attachComputedFields = (
  location: Pick<RetailLocationRecord, 'id' | 'address' | 'city' | 'state' | 'zipCode'> &
    Partial<RetailLocationRecord>,
): Pick<
  RetailLocationRecord,
  | 'photoUrl'
  | 'photoGallery'
  | 'googlePlaceId'
  | 'googleMapsUrl'
  | 'directionsUrl'
  | 'reviewRating'
  | 'reviewCount'
  | 'reviewSummary'
  | 'hours'
  | 'hoursSummary'
> => {
  const address = location.address || ''
  const stateCode = (location.state || '').toUpperCase()
  const zip = location.zipCode ?? null
  const initialPhoto = location.photoUrl
    ? { url: location.photoUrl, placeId: location.googlePlaceId ?? extractPlaceIdFromPhotoUrl(location.photoUrl) }
    : normalizePhoto(location.id)
  const reviewRating = location.reviewRating ?? DEFAULT_REVIEW_RATING
  const reviewCount = location.reviewCount ?? DEFAULT_REVIEW_COUNT
  const reviewSummary =
    location.reviewSummary ?? `${reviewRating.toFixed(1)} out of 5 stars · ${reviewCount.toLocaleString()} Google reviews`

  return {
    photoUrl: initialPhoto.url,
    photoGallery:
      location.photoGallery && location.photoGallery.length > 0
        ? location.photoGallery
        : initialPhoto.url
          ? [initialPhoto.url]
          : [],
    googlePlaceId: initialPhoto.placeId,
    googleMapsUrl: location.googleMapsUrl ?? buildGoogleMapsUrl(address, location.city, stateCode, zip, initialPhoto.placeId),
    directionsUrl: location.directionsUrl ?? buildDirectionsUrl(address, location.city, stateCode, zip),
    reviewRating,
    reviewCount,
    reviewSummary,
    hours: location.hours ?? null,
    hoursSummary: location.hoursSummary ?? DEFAULT_HOURS_SUMMARY,
  }
}

// Load locations directly from markdown
async function loadAllLocations(): Promise<RetailLocationRecord[]> {
  // Check cache
  const now = Date.now()
  if (cachedLocations && (now - cacheTimestamp) < CACHE_TTL) {
    console.log('[FindUs] Returning cached locations')
    return cachedLocations
  }

  try {
    console.log('[FindUs] Loading locations from markdown...')
    console.log('[FindUs] process.cwd():', process.cwd())
    
    const mdPath = await readFindUsMarkdownAbsolute()
    console.log('[FindUs] Found markdown at:', mdPath)
    
    const parsed = await parseFindUsMarkdown(mdPath)
    console.log('[FindUs] Parsed', parsed.length, 'raw locations')
    
    const locations = parsed
      .filter(location => location.state && location.city && location.businessName)
      .map((location) => {
        const address = location.address || ''
        const baseRecord = {
          id: location.id,
          businessName: location.businessName,
          address,
          city: location.city,
          state: location.state.toUpperCase(),
          zipCode: location.zipCode ?? null,
          phone: location.phone ?? null,
          website: location.website ?? null,
        }
        const computed = attachComputedFields(baseRecord)

        return {
          ...baseRecord,
          ...computed,
          latitude: null,
          longitude: null,
          distanceMiles: null,
        }
      })
    
    console.log(`[FindUs] After filtering: ${locations.length} valid locations`)
    console.log(`[FindUs] Sample location:`, locations[0])
    
    // Update cache
    cachedLocations = locations as RetailLocationRecord[]
    cacheTimestamp = now
    
    return cachedLocations
  } catch (error) {
    console.error('[FindUs] ERROR loading locations from markdown:')
    console.error('[FindUs] Error type:', error instanceof Error ? error.constructor.name : typeof error)
    console.error('[FindUs] Error message:', error instanceof Error ? error.message : String(error))
    console.error('[FindUs] Error stack:', error instanceof Error ? error.stack : 'No stack trace')
    
    // Fallback to bundled JSON data
    try {
      console.log('[FindUs] Falling back to bundled JSON data...')
      const jsonPath = join(process.cwd(), 'lib', 'locations', 'locations-data.json')
      const jsonContent = await readFile(jsonPath, 'utf-8')
      const locationsData = JSON.parse(jsonContent) as RetailLocationRecord[]
      cachedLocations = locationsData.map((location) => ({
        ...location,
        ...attachComputedFields(location),
      }))
      cacheTimestamp = now
      console.log(`[FindUs] Loaded ${cachedLocations.length} locations from JSON fallback`)
      return cachedLocations
    } catch (jsonError) {
      console.error('[FindUs] JSON fallback also failed:', jsonError)
      return []
    }
  }
}

export type {
  LocationFilters,
  NormalizedLocationFilters,
  RetailLocationRecord,
  LocationsQueryResult,
} from './shared'

export { filterLocations, normalizeFilters } from './shared'

export async function getAllLocations() {
  return loadAllLocations()
}

export async function queryLocations(filters?: LocationFilters) {
  const locations = await getAllLocations()
  return filterLocations(locations, filters)
}

export async function getLocationFacets(preloaded?: RetailLocationRecord[]) {
  const locations = preloaded ?? (await getAllLocations())
  const stateCounts = new Map<string, number>()
  const citiesByState: Record<string, string[]> = {}

  locations.forEach((location) => {
    // Defensive: skip locations with missing state or city
    if (!location.state || !location.city) {
      console.warn('[FindUs] Skipping location with missing state or city:', location)
      return
    }
    const state = location.state.toUpperCase()
    stateCounts.set(state, (stateCounts.get(state) ?? 0) + 1)
    if (!citiesByState[state]) {
      citiesByState[state] = []
    }
    if (!citiesByState[state].includes(location.city)) {
      citiesByState[state].push(location.city)
    }
  })

  const states = Array.from(stateCounts.entries())
    .map(([code, count]) => ({ code, count }))
    .sort((a, b) => a.code.localeCompare(b.code))

  Object.keys(citiesByState).forEach((state) => {
    citiesByState[state] = citiesByState[state].sort((a, b) => a.localeCompare(b))
  })

  return { states, citiesByState }
}

export async function getLocationById(id: string) {
  const locations = await getAllLocations()
  return locations.find((location) => location.id === id) ?? null
}
