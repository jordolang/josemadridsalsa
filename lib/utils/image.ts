/**
 * Utility functions for handling image URLs, particularly Google Places images
 */

const GOOGLE_PLACES_HOST = 'places.googleapis.com'
const FALLBACK_IMAGE = '/images/Hero-Image-5.png'

/**
 * Validates if a URL is a Google Places image URL
 */
export function isGooglePlacesUrl(url: string): boolean {
  try {
    const urlObj = new URL(url)
    return urlObj.hostname === GOOGLE_PLACES_HOST
  } catch {
    return false
  }
}

/**
 * Gets the appropriate image URL for display, proxying Google Places URLs
 * to hide API keys from the client.
 *
 * @param url - The original image URL (may be null/undefined)
 * @returns The final URL to use in Image components
 */
export function getLocationImageUrl(url?: string | null): string {
  // Return placeholder if no URL provided
  if (!url) return FALLBACK_IMAGE

  // Proxy Google Places images through our API to hide the API key
  // This prevents API key exposure in client-side HTML/network requests
  if (isGooglePlacesUrl(url)) {
    return `/api/image-proxy?url=${encodeURIComponent(url)}`
  }

  // For non-Google URLs, return as-is
  return url
}

/**
 * Gets the fallback placeholder image path
 */
export function getFallbackImage(): string {
  return FALLBACK_IMAGE
}
