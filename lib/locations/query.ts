import { unstable_cache } from 'next/cache'
import { prisma } from '@/lib/prisma'
import { buildStreetViewOrMapImageUrl, parseFindUsMarkdown, readFindUsMarkdownAbsolute } from '@/lib/find-us-parser'
import {
  filterLocations,
  normalizeFilters,
  type LocationFilters,
  type NormalizedLocationFilters,
  type RetailLocationRecord,
  type LocationsQueryResult,
} from './shared'

async function loadLocationsFromMarkdown(): Promise<RetailLocationRecord[]> {
  try {
    const mdPath = await readFindUsMarkdownAbsolute()
    const parsed = await parseFindUsMarkdown(mdPath)
    return parsed.map((location) => ({
      id: `md-${location.id}`,
      businessName: location.businessName,
      address: location.address,
      city: location.city,
      state: location.state.toUpperCase(),
      zipCode: location.zipCode ?? null,
      phone: location.phone ?? null,
      website: location.website ?? null,
      photoUrl: buildStreetViewOrMapImageUrl(location.address, location.city, location.state),
      latitude: null,
      longitude: null,
      distanceMiles: null,
    }))
  } catch (error) {
    console.error('[FindUs] Failed to read markdown fallback for retail locations:', error)
    return []
  }
}

const loadAllLocations = unstable_cache(
  async () => {
    try {
      const locations = await prisma.retailLocation.findMany({
        where: { isActive: true },
        select: {
          id: true,
          businessName: true,
          address: true,
          city: true,
          state: true,
          zipCode: true,
          phone: true,
          website: true,
          photoUrl: true,
          latitude: true,
          longitude: true,
        },
        orderBy: [{ state: 'asc' }, { city: 'asc' }, { sortOrder: 'asc' }, { businessName: 'asc' }],
      })

      if (locations.length > 0) {
        return locations.map((location) => ({
          ...location,
          latitude: location.latitude !== null ? Number(location.latitude) : null,
          longitude: location.longitude !== null ? Number(location.longitude) : null,
        })) as RetailLocationRecord[]
      }

      console.warn('[FindUs] No active retail locations returned from database, falling back to markdown data.')
    } catch (error) {
      console.error('[FindUs] Failed to load retail locations from database, falling back to markdown data.', error)
    }

    const fallback = await loadLocationsFromMarkdown()
    if (fallback.length === 0) {
      throw new Error('Unable to load retail locations from database or markdown fallback.')
    }
    return fallback
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
