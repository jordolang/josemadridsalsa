import { unstable_cache } from 'next/cache'
import { parseFindUsMarkdown, readFindUsMarkdownAbsolute } from '@/lib/find-us-parser'
import {
  filterLocations,
  normalizeFilters,
  type LocationFilters,
  type NormalizedLocationFilters,
  type RetailLocationRecord,
  type LocationsQueryResult,
} from './shared'

// Load locations directly from markdown - simplified to avoid Prisma connection issues
const loadAllLocations = unstable_cache(
  async () => {
    try {
      console.log('[FindUs] Loading locations from markdown...')
      const mdPath = await readFindUsMarkdownAbsolute()
      const parsed = await parseFindUsMarkdown(mdPath)
      
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
      
      console.log(`[FindUs] Successfully loaded ${locations.length} locations from markdown`)
      return locations as RetailLocationRecord[]
    } catch (error) {
      console.error('[FindUs] Failed to load locations from markdown:', error)
      // Return empty array instead of throwing to prevent page crash
      return []
    }
  },
  ['locations:all'],
  { revalidate: 3600, tags: ['locations'] },
)

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
