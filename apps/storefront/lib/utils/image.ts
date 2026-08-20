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
 * Gets the appropriate image URL for display, proxying Google Places URLs
 * to hide API keys from the client.
 *
 * @param url - The original image URL (may be null/undefined)
 * @param placeId - Optional Google Place ID to fetch fresh photos (used as fallback)
 * @returns The final URL to use in Image components
 */
export function getLocationImageUrl(url?: string | null, placeId?: string | null): string {
  // Prefer stored URL if available and not a low-quality fallback
  if (url && !isFaviconUrl(url)) {
    // Proxy Google Places images through our API to hide the API key
    // This prevents API key exposure in client-side HTML/network requests
    if (isGooglePlacesUrl(url)) {
      return `/api/image-proxy?url=${encodeURIComponent(url)}`
    }

    // For non-Google URLs, return as-is
    return url
  }

  // Fallback to Place ID to fetch fresh photos if no good URL stored
  if (placeId) {
    return `/api/image-proxy?placeId=${encodeURIComponent(placeId)}`
  }

  // Last resort: return placeholder
  return FALLBACK_IMAGE
}

/**
 * Gets the fallback placeholder image path
 */
export function getFallbackImage(): string {
  return FALLBACK_IMAGE
}
