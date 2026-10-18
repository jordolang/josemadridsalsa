/**
 * Helpers for `scripts/cache-location-photos.ts`, which downloads one storefront photo per
 * retail location, stores it in Vercel Blob and saves the Blob URL on the location.
 *
 * The site never calls Google for these photos at runtime (see `getLocationImageUrl`), so
 * the photos are fetched once, on purpose, and served from Blob from then on.
 */

export type PlacePhoto = {
  name: string
  widthPx?: number
  heightPx?: number
}

const BLOB_HOST_SUFFIX = '.public.blob.vercel-storage.com'

/** Blob pathname for a location's cached storefront photo. */
export function locationPhotoPathname(locationId: string): string {
  return `site/images/locations/${locationId}.webp`
}

/** True when the URL already points at a photo in our Blob store. */
export function isBlobPhotoUrl(url?: string | null): boolean {
  if (!url) return false
  try {
    const { protocol, hostname } = new URL(url)
    return protocol === 'https:' && hostname.endsWith(BLOB_HOST_SUFFIX)
  } catch {
    return false
  }
}

/**
 * Picks the photo most likely to show the storefront: landscape first, then the largest.
 * Google lists the place's own photos first, so ties keep Google's order.
 */
export function pickBestPlacePhoto(photos: PlacePhoto[] | undefined | null): PlacePhoto | null {
  const sized = (photos ?? []).filter((photo) => photo.name && photo.widthPx && photo.heightPx)
  if (sized.length === 0) return null

  const landscape = sized.filter((photo) => photo.widthPx! / photo.heightPx! >= 1.2)
  const pool = landscape.length > 0 ? landscape : sized
  return pool.reduce((best, photo) =>
    Math.min(photo.widthPx!, 1600) > Math.min(best.widthPx!, 1600) ? photo : best,
  )
}

const STREET_SUFFIXES: Record<string, string> = {
  street: 'st',
  avenue: 'ave',
  road: 'rd',
  drive: 'dr',
  boulevard: 'blvd',
  lane: 'ln',
  court: 'ct',
  highway: 'hwy',
  parkway: 'pkwy',
  place: 'pl',
  pike: 'pike',
  north: 'n',
  south: 's',
  east: 'e',
  west: 'w',
}

const normalizeStreet = (value: string) =>
  value
    .toLowerCase()
    .replace(/[.,#]/g, ' ')
    .split(/\s+/)
    .filter(Boolean)
    .map((word) => STREET_SUFFIXES[word] ?? word)
    .join(' ')

/**
 * Checks that the address Google returned is the store we asked about: the same house
 * number and at least one shared street word. Used to flag photos that may be of the
 * wrong business, never to reject them silently.
 */
export function addressesMatch(stored: string, googleFormatted?: string | null): boolean {
  if (!googleFormatted) return false
  const storedStreet = normalizeStreet(stored)
  const googleStreet = normalizeStreet(googleFormatted.split(',')[0] ?? '')

  const storedNumber = storedStreet.match(/^\d+/)?.[0]
  const googleNumber = googleStreet.match(/^\d+/)?.[0]
  if (storedNumber && googleNumber && storedNumber !== googleNumber) return false

  const ignore = new Set(['n', 's', 'e', 'w', 'st', 'ave', 'rd', 'dr', 'blvd', 'ln', 'ct', 'hwy', 'pkwy', 'pl'])
  const storedWords = storedStreet.split(' ').filter((word) => !/^\d+$/.test(word) && !ignore.has(word))
  const googleWords = new Set(googleStreet.split(' '))
  if (storedWords.length === 0) return Boolean(storedNumber && storedNumber === googleNumber)
  return storedWords.some((word) => googleWords.has(word))
}
