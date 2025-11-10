export type LocationFilters = {
  q?: string
  state?: string
  city?: string
  sort?: 'alphabetical' | 'distance'
  lat?: number
  lng?: number
  hasWebsite?: boolean
  hasPhone?: boolean
}

export type NormalizedLocationFilters = Required<Pick<LocationFilters, 'sort'>> & {
  q?: string
  state?: string
  city?: string
  lat?: number
  lng?: number
  hasWebsite?: boolean
  hasPhone?: boolean
}

export type RetailLocationRecord = {
  id: string
  businessName: string
  address: string
  city: string
  state: string
  zipCode: string | null
  phone: string | null
  website: string | null
  photoUrl: string | null
  latitude: number | null
  longitude: number | null
  distanceMiles?: number | null
}

export type LocationsQueryResult = {
  locations: RetailLocationRecord[]
  total: number
  appliedFilters: NormalizedLocationFilters
}

const normalizeString = (value?: string | null) => value?.trim() || undefined

const haversineMiles = (lat1: number, lon1: number, lat2: number, lon2: number) => {
  const toRad = (deg: number) => (deg * Math.PI) / 180
  const R = 3958.8
  const dLat = toRad(lat2 - lat1)
  const dLon = toRad(lon2 - lon1)
  const a =
    Math.sin(dLat / 2) * Math.sin(dLat / 2) +
    Math.cos(toRad(lat1)) * Math.cos(toRad(lat2)) *
      Math.sin(dLon / 2) * Math.sin(dLon / 2)
  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a))
  return R * c
}

export function normalizeFilters(filters: LocationFilters = {}): NormalizedLocationFilters {
  const normalized: NormalizedLocationFilters = {
    sort: filters.sort === 'distance' ? 'distance' : 'alphabetical',
  }

  if (filters.q) {
    normalized.q = filters.q.trim()
  }

  if (filters.state) {
    const state = filters.state.trim().toUpperCase()
    if (/^[A-Z]{2}$/.test(state)) {
      normalized.state = state
    }
  }

  if (filters.city) {
    normalized.city = filters.city.trim()
  }

  if (typeof filters.lat === 'number' && Number.isFinite(filters.lat)) {
    normalized.lat = Number(filters.lat)
  }

  if (typeof filters.lng === 'number' && Number.isFinite(filters.lng)) {
    normalized.lng = Number(filters.lng)
  }

  if (normalized.sort === 'distance' && (normalized.lat === undefined || normalized.lng === undefined)) {
    normalized.sort = 'alphabetical'
  }

  if (typeof filters.hasWebsite === 'boolean') {
    normalized.hasWebsite = filters.hasWebsite
  }

  if (typeof filters.hasPhone === 'boolean') {
    normalized.hasPhone = filters.hasPhone
  }

  return normalized
}

export function filterLocations(locations: RetailLocationRecord[], filters?: LocationFilters): LocationsQueryResult {
  const appliedFilters = normalizeFilters(filters)
  const query = normalizeString(appliedFilters.q)?.toLowerCase()
  const city = normalizeString(appliedFilters.city)?.toLowerCase()
  const state = appliedFilters.state
  const hasDistanceSort = appliedFilters.sort === 'distance'
  let filtered = locations

  if (state) {
    filtered = filtered.filter((location) => location.state.toUpperCase() === state)
  }

  if (city) {
    filtered = filtered.filter((location) => location.city.toLowerCase() === city)
  }

  if (query) {
    filtered = filtered.filter((location) => {
      const haystack = `${location.businessName} ${location.address} ${location.city} ${location.state}`.toLowerCase()
      return haystack.includes(query)
    })
  }

  if (appliedFilters.hasWebsite) {
    filtered = filtered.filter((location) => Boolean(location.website))
  }

  if (appliedFilters.hasPhone) {
    filtered = filtered.filter((location) => Boolean(location.phone))
  }

  let enriched: RetailLocationRecord[] = filtered

  if (hasDistanceSort && appliedFilters.lat !== undefined && appliedFilters.lng !== undefined) {
    enriched = filtered.map((location) => {
      if (location.latitude === null || location.longitude === null) {
        return { ...location, distanceMiles: null }
      }
      return {
        ...location,
        distanceMiles: haversineMiles(appliedFilters.lat!, appliedFilters.lng!, location.latitude, location.longitude),
      }
    })

    enriched = enriched.sort((a, b) => {
      if (a.distanceMiles == null && b.distanceMiles == null) return a.businessName.localeCompare(b.businessName)
      if (a.distanceMiles == null) return 1
      if (b.distanceMiles == null) return -1
      return a.distanceMiles - b.distanceMiles
    })
  } else {
    enriched = [...filtered].sort((a, b) => {
      if (a.state === b.state) {
        if (a.city === b.city) {
          return a.businessName.localeCompare(b.businessName)
        }
        return a.city.localeCompare(b.city)
      }
      return a.state.localeCompare(b.state)
    })
  }

  return {
    locations: enriched,
    total: enriched.length,
    appliedFilters,
  }
}
