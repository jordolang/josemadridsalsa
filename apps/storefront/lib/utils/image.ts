/**
 * Utility functions for handling image URLs, particularly Google Places images
 */

export const GOOGLE_PLACES_HOST = 'places.googleapis.com'
const LEGACY_PLACES_HOST = 'maps.googleapis.com'
const FALLBACK_IMAGE = 'https://can9pwc8drhj1bme.public.blob.vercel-storage.com/site/images/shared/Hero-Image-Mike.webp'

/**
 * Validates if a URL is a Google Places image URL (supports both new and legacy API)
 */
export function isGooglePlacesUrl(url: string): boolean {
  try {
    const urlObj = new URL(url)
    if (urlObj.protocol !== 'https:') return false
    return urlObj.hostname === GOOGLE_PLACES_HOST || urlObj.hostname === LEGACY_PLACES_HOST
  } catch {
    return false
  }
}

/**
 * Checks if a URL is a favicon (low-quality fallback we don't want to use)
 */
export function isFaviconUrl(url: string): boolean {
  return url.includes('google.com/s2/favicons') ||
         url.includes('store-placeholder.png') ||
         url.length < 50 // Very short URLs are likely placeholders
}

/**
 * Gets the image URL to display for a retail location.
 *
 * Google Places photos are never shown: every one was a billable Places API (New)
 * "Place Details Photos" request, made again on each page view, and the stored photo
 * names expire, so most of them failed anyway. Places photos and Place IDs fall back to
 * the placeholder; any other stored URL (Blob, a retailer's own site) is used as-is.
 *
 * @param url - The stored image URL (may be null/undefined)
 * @returns The final URL to use in Image components
 */
export function getLocationImageUrl(url?: string | null): string {
  if (url && !isFaviconUrl(url) && !isGooglePlacesUrl(url)) {
    return url
  }

  return FALLBACK_IMAGE
}

/**
 * Gets the fallback placeholder image path
 */
export function getFallbackImage(): string {
  return FALLBACK_IMAGE
}
