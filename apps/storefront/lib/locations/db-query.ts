/**
 * Database query functions for retail locations
 * Replaces the file-based query system with database queries
 */

import { prisma } from '@/lib/prisma'
import { Prisma } from '@prisma/client'
import type {
  RetailLocationRecord,
  LocationFilters,
  NormalizedLocationFilters,
  LocationsQueryResult,
} from './shared'
import { normalizeFilters, normalizeWebsiteUrl } from './shared'

// Type for location with photos included
type LocationWithPhotos = Prisma.RetailLocationGetPayload<{
  include: {
    photos: true
  }
}>

// Haversine distance formula (miles)
function haversineMiles(
  lat1: number,
  lon1: number,
  lat2: number,
  lon2: number
): number {
  const toRad = (deg: number) => (deg * Math.PI) / 180
  const R = 3958.8 // Earth radius in miles
  const dLat = toRad(lat2 - lat1)
  const dLon = toRad(lon2 - lon1)
  const a =
    Math.sin(dLat / 2) * Math.sin(dLat / 2) +
    Math.cos(toRad(lat1)) *
      Math.cos(toRad(lat2)) *
      Math.sin(dLon / 2) *
      Math.sin(dLon / 2)
  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a))
  return R * c
}

// Transform database location to RetailLocationRecord
function transformLocation(
  loc: LocationWithPhotos,
  userLat?: number,
  userLng?: number
): RetailLocationRecord {
  const latitude = loc.latitude ? Number(loc.latitude) : null
  const longitude = loc.longitude ? Number(loc.longitude) : null

  // Build Google Maps URLs
  const googleMapsUrl = latitude && longitude
    ? `https://www.google.com/maps/search/?api=1&query=${latitude},${longitude}`
    : null

  const directionsUrl = latitude && longitude
    ? `https://www.google.com/maps/dir/?api=1&destination=${latitude},${longitude}`
    : null

  // Calculate distance if user location provided
  let distanceMiles: number | null = null
  if (
    userLat !== undefined &&
    userLng !== undefined &&
    latitude !== null &&
    longitude !== null
  ) {
    distanceMiles = haversineMiles(userLat, userLng, latitude, longitude)
  }

  // Transform photos array to photoGallery
  const photoGallery = loc.photos
    ? loc.photos.sort((a, b) => a.sortOrder - b.sortOrder).map((p) => p.url)
    : []

  return {
    id: loc.id,
    businessName: loc.businessName,
    address: loc.address,
    city: loc.city,
    state: loc.state,
    zipCode: loc.zipCode,
    phone: loc.phone,
    website: normalizeWebsiteUrl(loc.website),
    photoUrl: loc.photoUrl,
    photoGallery,
    latitude,
    longitude,
    googlePlaceId: loc.googlePlacesId,
    googleMapsUrl,
    directionsUrl,
    distanceMiles,
  }
}

/**
 * Get all active locations from database
 */
export async function getAllLocationsFromDB(): Promise<RetailLocationRecord[]> {
  const locations = await prisma.retailLocation.findMany({
    where: {
      isActive: true,
    },
    include: {
      photos: {
        orderBy: {
          sortOrder: 'asc',
        },
      },
    },
    orderBy: [
      { state: 'asc' },
      { city: 'asc' },
      { businessName: 'asc' },
    ],
  })

  return locations.map((loc) => transformLocation(loc))
}

/**
 * Get a single location by ID
 */
export async function getLocationByIdFromDB(
  id: string
): Promise<RetailLocationRecord | null> {
  const location = await prisma.retailLocation.findUnique({
    where: { id },
    include: {
      photos: {
        orderBy: {
          sortOrder: 'asc',
        },
      },
    },
  })

  if (!location) {
    return null
  }

  return transformLocation(location)
}

/**
 * Filter and search locations with database queries
 */
export async function filterLocationsFromDB(
  filters: LocationFilters = {}
): Promise<LocationsQueryResult> {
  const normalized = normalizeFilters(filters)

  // Build where clause
  const where: Prisma.RetailLocationWhereInput = {
    isActive: true,
  }

  // State filter
  if (normalized.state) {
    where.state = normalized.state
  }

  // City filter
  if (normalized.city) {
    where.city = {
      equals: normalized.city,
      mode: 'insensitive',
    }
  }

  // Website filter
  if (normalized.hasWebsite) {
    where.website = {
      not: null,
    }
  }

  // Phone filter
  if (normalized.hasPhone) {
    where.phone = {
      not: null,
    }
  }

  // Search query (full-text search across multiple fields)
  if (normalized.q) {
    where.OR = [
      {
        businessName: {
          contains: normalized.q,
          mode: 'insensitive',
        },
      },
      {
        address: {
          contains: normalized.q,
          mode: 'insensitive',
        },
      },
      {
        city: {
          contains: normalized.q,
          mode: 'insensitive',
        },
      },
      {
        state: {
          contains: normalized.q,
          mode: 'insensitive',
        },
      },
    ]
  }

  // Fetch locations
  const locations = await prisma.retailLocation.findMany({
    where,
    include: {
      photos: {
        orderBy: {
          sortOrder: 'asc',
        },
      },
    },
  })

  // Transform and add distance calculations
  let results = locations.map((loc) =>
    transformLocation(loc, normalized.lat, normalized.lng)
  )

  // Sort results
  if (normalized.sort === 'distance' && normalized.lat && normalized.lng) {
    results.sort((a, b) => {
      const distA = a.distanceMiles ?? Infinity
      const distB = b.distanceMiles ?? Infinity
      return distA - distB
    })
  } else {
    // Alphabetical sort (state -> city -> business name)
    results.sort((a, b) => {
      if (a.state !== b.state) return a.state.localeCompare(b.state)
      if (a.city !== b.city) return a.city.localeCompare(b.city)
      return a.businessName.localeCompare(b.businessName)
    })
  }

  return {
    locations: results,
    total: results.length,
    appliedFilters: normalized,
  }
}

/**
 * Get unique facets for filtering (states and cities)
 */
export async function getLocationFacetsFromDB(): Promise<{
  states: Array<{ code: string; count: number }>
  cities: Array<{ name: string; state: string; count: number }>
}> {
  // Get unique states with counts
  const stateGroups = await prisma.retailLocation.groupBy({
    by: ['state'],
    where: {
      isActive: true,
    },
    _count: {
      state: true,
    },
    orderBy: {
      state: 'asc',
    },
  })

  const states = stateGroups.map((group) => ({
    code: group.state,
    count: group._count.state,
  }))

  // Get unique city/state combinations with counts
  const cityGroups = await prisma.retailLocation.groupBy({
    by: ['city', 'state'],
    where: {
      isActive: true,
    },
    _count: {
      city: true,
    },
    orderBy: [
      { state: 'asc' },
      { city: 'asc' },
    ],
  })

  const cities = cityGroups.map((group) => ({
    name: group.city,
    state: group.state,
    count: group._count.city,
  }))

  return {
    states,
    cities,
  }
}
