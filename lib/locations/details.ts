import { buildPlacesPhotoUrl } from '@/lib/google-places'

const API_KEY = process.env.GOOGLE_PLACES_API_KEY || process.env.NEXT_PUBLIC_GOOGLE_MAPS_API_KEY
const PLACES_API_BASE = 'https://places.googleapis.com/v1'
const CACHE_TTL_MS = 1000 * 60 * 60 * 2 // 2 hours

export type LocationDetails = {
  placeId: string
  rating: number | null
  reviewCount: number | null
  hours: string[]
  phone: string | null
  website: string | null
  photos: string[]
  fetchedAt: number
}

const detailsCache = new Map<string, { expiresAt: number; data: LocationDetails }>()

const isCacheValid = (entry?: { expiresAt: number }) => {
  if (!entry) return false
  return entry.expiresAt > Date.now()
}

const buildPhotoGallery = (photos?: Array<{ name: string; widthPx?: number }>) => {
  if (!photos || photos.length === 0) {
    return []
  }

  const gallery: string[] = []

  photos.forEach((photo) => {
    try {
      const width = photo.widthPx ? Math.min(photo.widthPx, 1600) : 1200
      gallery.push(buildPlacesPhotoUrl(photo.name, width))
    } catch {
      // Ignore photos we can't build
    }
  })

  return gallery
}

export async function getLocationDetails(placeId: string): Promise<LocationDetails | null> {
  if (!placeId) {
    return null
  }

  const cached = detailsCache.get(placeId)
  if (isCacheValid(cached)) {
    return cached?.data ?? null
  }

  if (!API_KEY) {
    return null
  }

  try {
    const response = await fetch(`${PLACES_API_BASE}/places/${placeId}`, {
      headers: {
        'Content-Type': 'application/json',
        'X-Goog-Api-Key': API_KEY,
        'X-Goog-FieldMask': [
          'rating',
          'userRatingCount',
          'internationalPhoneNumber',
          'nationalPhoneNumber',
          'websiteUri',
          'regularOpeningHours.weekdayDescriptions',
          'currentOpeningHours.weekdayDescriptions',
          'photos.name',
          'photos.widthPx',
        ].join(','),
      },
      next: { revalidate: CACHE_TTL_MS / 1000 },
    })

    if (!response.ok) {
      console.warn('[FindUs] Failed to fetch Google Places details', await response.text())
      return null
    }

    const data = await response.json()
    const hours: string[] =
      data.currentOpeningHours?.weekdayDescriptions ??
      data.regularOpeningHours?.weekdayDescriptions ??
      []

    const result: LocationDetails = {
      placeId,
      rating: typeof data.rating === 'number' ? data.rating : null,
      reviewCount: typeof data.userRatingCount === 'number' ? data.userRatingCount : null,
      phone: data.nationalPhoneNumber ?? data.internationalPhoneNumber ?? null,
      website: data.websiteUri ?? null,
      hours,
      photos: buildPhotoGallery(data.photos),
      fetchedAt: Date.now(),
    }

    detailsCache.set(placeId, {
      data: result,
      expiresAt: Date.now() + CACHE_TTL_MS,
    })

    return result
  } catch (error) {
    console.error('[FindUs] Unable to load place details', error)
    return null
  }
}
