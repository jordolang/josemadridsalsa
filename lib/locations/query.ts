import { parseFindUsMarkdown, readFindUsMarkdownAbsolute } from '@/lib/find-us-parser'
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
      .map((location) => ({
        id: location.id,
        businessName: location.businessName,
        address: location.address || '',
        city: location.city,
        state: location.state.toUpperCase(),
        zipCode: location.zipCode ?? null,
        phone: location.phone ?? null,
        website: location.website ?? null,
        photoUrl: null,
        latitude: null,
        longitude: null,
        distanceMiles: null,
      }))
    
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
    // Return empty array instead of throwing to prevent page crash
    return []
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
