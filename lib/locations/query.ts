import { unstable_cache } from 'next/cache'
import { prisma } from '@/lib/prisma'
import {
  filterLocations,
  normalizeFilters,
  type LocationFilters,
  type NormalizedLocationFilters,
  type RetailLocationRecord,
  type LocationsQueryResult,
} from './shared'

const loadAllLocations = unstable_cache(
  async () => {
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

    return locations.map((location) => ({
      ...location,
      latitude: location.latitude !== null ? Number(location.latitude) : null,
      longitude: location.longitude !== null ? Number(location.longitude) : null,
    })) as RetailLocationRecord[]
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

export async function getLocationFacets() {
  const locations = await getAllLocations()
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
