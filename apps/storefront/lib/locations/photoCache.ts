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
  northeast: 'ne',
  northwest: 'nw',
  southeast: 'se',
  southwest: 'sw',
}

const DIRECTIONS = new Set(['n', 's', 'e', 'w', 'ne', 'nw', 'se', 'sw'])
const STREET_TYPES = new Set(['st', 'ave', 'rd', 'dr', 'blvd', 'ln', 'ct', 'hwy', 'pkwy', 'pl'])

const normalizeStreet = (value: string) =>
  value
    .toLowerCase()
    .replace(/[.,#]/g, ' ')
    .split(/\s+/)
    .filter(Boolean)
    .map((word) => STREET_SUFFIXES[word] ?? word)

const pick = (words: string[], set: Set<string>) => [...new Set(words.filter((word) => set.has(word)))].sort().join(' ')

/**
 * Checks that the address Google returned is the store we asked about: the same house
 * number, at least one shared street word, and no conflicting direction (N vs S) or street
 * type (St vs Ave). A side that leaves out the direction or type is not a conflict.
 */
export function addressesMatch(stored: string, googleFormatted?: string | null): boolean {
  if (!googleFormatted) return false
  const storedWords = normalizeStreet(stored)
  const googleWords = normalizeStreet(googleFormatted.split(',')[0] ?? '')

  const storedNumber = storedWords[0]?.match(/^\d+$/)?.[0]
  const googleNumber = googleWords[0]?.match(/^\d+$/)?.[0]
  if (storedNumber && googleNumber && storedNumber !== googleNumber) return false

  for (const set of [DIRECTIONS, STREET_TYPES]) {
    const storedPart = pick(storedWords, set)
    const googlePart = pick(googleWords, set)
    if (storedPart && googlePart && storedPart !== googlePart) return false
  }

  const storedNames = storedWords.filter((word) => !/^\d+$/.test(word) && !DIRECTIONS.has(word) && !STREET_TYPES.has(word))
  if (storedNames.length === 0) return Boolean(storedNumber && storedNumber === googleNumber)
  const googleSet = new Set(googleWords)
  return storedNames.some((word) => googleSet.has(word))
}
