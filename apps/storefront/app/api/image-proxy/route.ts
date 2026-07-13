import { NextRequest, NextResponse } from 'next/server'
import { z } from 'zod'

const GOOGLE_PLACES_API_KEY = process.env.GOOGLE_PLACES_API_KEY || process.env.NEXT_PUBLIC_GOOGLE_MAPS_API_KEY
const FALLBACK_REFERER = 'https://www.josemadrid.net'

// Validation schema for query parameters
const ImageProxyQuerySchema = z.object({
  url: z.string().url().nullish(),
  placeId: z.string().min(1).nullish(),
  maxWidth: z.string().nullish().transform((val) => {
    if (!val) return 1200
    const num = parseInt(val, 10)
    if (isNaN(num) || num < 100 || num > 4000) return 1200
    return num
  }),
}).refine(
  (data) => data.url || data.placeId,
  {
    message: 'Either url or placeId must be provided',
    path: ['url', 'placeId'],
  }
)

// Updated to support both legacy and new API formats
const LEGACY_PLACES_HOST = 'maps.googleapis.com'
const NEW_PLACES_HOST = 'places.googleapis.com'

// Cache for Place ID -> Photo URL mappings (in-memory, 24 hours TTL)
// Place photo names from Google expire after ~2 days, so 24h is safe and avoids
// hammering the Places API on every page load for 150+ locations.
const placePhotoCache = new Map<string, { url: string; timestamp: number }>()
const PHOTO_CACHE_TTL = 24 * 60 * 60 * 1000 // 24 hours

/**
 * Validates if URL is from Google Places (legacy or new API)
 */
const isGooglePlacesUrl = (url: string): boolean => {
  try {
    const urlObj = new URL(url)
    return urlObj.hostname === LEGACY_PLACES_HOST || urlObj.hostname === NEW_PLACES_HOST
  } catch {
    return false
  }
}

/**
 * Checks if URL is from legacy Places API
 */
const isLegacyPlacesUrl = (url: string): boolean => {
  return url.includes('maps.googleapis.com/maps/api/place/photo')
}

/**
 * Determines if this is a New Places API URL
 */
const isNewPlacesApiUrl = (url: string): boolean => {
  return url.includes('places.googleapis.com/v1/')
}

/**
 * Fetches a fresh photo URL from a Google Place ID
 * This solves the problem of expired photo names by getting current photos on-demand
 */
async function getFreshPhotoFromPlaceId(placeId: string, maxWidth = 1200): Promise<string | null> {
  // Check cache first
  const cached = placePhotoCache.get(placeId)
  if (cached && (Date.now() - cached.timestamp) < PHOTO_CACHE_TTL) {
    console.log('[image-proxy] Using cached photo URL for place:', placeId)
    return cached.url
  }

  try {
    console.log('[image-proxy] Fetching fresh photo for place ID:', placeId)

    // Fetch place details with photos using New Places API
    const url = `https://places.googleapis.com/v1/places/${placeId}`
    const response = await fetch(url, {
      method: 'GET',
      headers: {
        'Content-Type': 'application/json',
        'X-Goog-Api-Key': GOOGLE_PLACES_API_KEY!,
        'X-Goog-FieldMask': 'photos',
      },
    })

    if (!response.ok) {
      console.error(`[image-proxy] Failed to fetch place details: ${response.status}`)
      return null
    }

    const data = await response.json()

    if (!data.photos || data.photos.length === 0) {
      console.warn('[image-proxy] No photos found for place:', placeId)
      return null
    }

    // Pick the best photo (first one, or prioritize landscape orientation)
    const photos = data.photos
      .filter((p: any) => p.widthPx && p.heightPx)
      .sort((a: any, b: any) => {
        const aRatio = a.widthPx / a.heightPx
        const bRatio = b.widthPx / b.heightPx
        // Prefer landscape (wider aspect ratio)
        if (Math.abs(aRatio - bRatio) > 0.3) return bRatio - aRatio
        // Then prefer larger images
        const aSize = Math.min(a.widthPx, maxWidth)
        const bSize = Math.min(b.widthPx, maxWidth)
        return bSize - aSize
      })

    if (photos.length === 0) {
      console.warn('[image-proxy] No valid photos found for place:', placeId)
      return null
    }

    const bestPhoto = photos[0]
    const photoName = bestPhoto.name
    const photoMaxWidth = Math.min(bestPhoto.widthPx, maxWidth)

    // Build the media URL
    const photoUrl = `https://places.googleapis.com/v1/${photoName}/media?key=${GOOGLE_PLACES_API_KEY}&maxWidthPx=${photoMaxWidth}`

    // Cache the result
    placePhotoCache.set(placeId, { url: photoUrl, timestamp: Date.now() })

    console.log('[image-proxy] Got fresh photo URL for place:', placeId)
    return photoUrl
  } catch (error) {
    console.error('[image-proxy] Error fetching fresh photo for place:', placeId, error)
    return null
  }
}

/**
 * Rewrites a Google Places photo URL to use the current API key from environment variables.
 * Handles both legacy and new API formats.
 */
const rewriteGooglePhotoUrl = (originalUrl: string): string => {
  if (!isGooglePlacesUrl(originalUrl)) {
    return originalUrl
  }

  try {
    const url = new URL(originalUrl)

    if (isNewPlacesApiUrl(originalUrl)) {
      // New API: Ensure we have required size parameters
      if (!url.searchParams.has('maxHeightPx') && !url.searchParams.has('maxWidthPx')) {
        // Add default size if missing
        url.searchParams.set('maxWidthPx', '1600')
      }

      // CRITICAL: Always replace the API key (old keys in database may be expired/invalid)
      if (GOOGLE_PLACES_API_KEY) {
        url.searchParams.delete('key')
        url.searchParams.set('key', GOOGLE_PLACES_API_KEY)
      }
    } else if (isLegacyPlacesUrl(originalUrl)) {
      // Legacy API: photo_reference format uses query parameter auth
      if (GOOGLE_PLACES_API_KEY) {
        url.searchParams.delete('key')
        url.searchParams.set('key', GOOGLE_PLACES_API_KEY)
      }

      // Ensure we have size parameters for legacy API
      if (!url.searchParams.has('maxwidth')) {
        url.searchParams.set('maxwidth', '1600')
      }
    } else {
      // Legacy Maps API (not Places API) - still replace key
      if (GOOGLE_PLACES_API_KEY) {
        url.searchParams.delete('key')
        url.searchParams.set('key', GOOGLE_PLACES_API_KEY)
      }
    }

    return url.toString()
  } catch (error) {
    console.warn('[image-proxy] Failed to rewrite Google photo URL:', error)
    return originalUrl
  }
}

/**
 * Image proxy route that securely fetches Google Places images while hiding the API key from clients.
 *
 * Security Model:
 * - PUBLIC endpoint (no authentication required) - needed for public location pages
 * - Whitelist-only: ONLY Google Places API URLs allowed (prevents SSRF attacks)
 * - Server-side API key: Never exposes API key to clients
 * - Content validation: Ensures response is an image
 * - Timeout protection: 10 second timeout prevents hanging requests
 * - Rate limiting: Should be configured at reverse proxy/CDN level (Vercel)
 *
 * Query Parameters:
 * - url: Google Places photo URL (either url or placeId required)
 * - placeId: Google Place ID to fetch fresh photos (either url or placeId required)
 * - maxWidth: Maximum width in pixels (100-4000, default: 1200)
 *
 * @public No authentication required - security through URL whitelisting
 */
export async function GET(request: NextRequest) {
  const searchParams = request.nextUrl.searchParams

  // Validate query parameters with Zod
  const validation = ImageProxyQuerySchema.safeParse({
    url: searchParams.get('url'),
    placeId: searchParams.get('placeId'),
    maxWidth: searchParams.get('maxWidth'),
  })

  if (!validation.success) {
    console.warn('[image-proxy] Invalid parameters:', validation.error.flatten())
    return NextResponse.json(
      {
        error: 'Invalid parameters',
        details: validation.error.flatten().fieldErrors,
      },
      { status: 400 }
    )
  }

  const { url: rawUrl, placeId, maxWidth } = validation.data

  // Verify API key is available
  if (!GOOGLE_PLACES_API_KEY) {
    console.error('[image-proxy] Missing API key')
    return NextResponse.json({ error: 'API key not configured' }, { status: 500 })
  }

  try {
    let imageUrl: string

    // If Place ID is provided, fetch fresh photo URL
    if (placeId) {
      console.log('[image-proxy] Fetching image via Place ID:', placeId)
      const freshPhotoUrl = await getFreshPhotoFromPlaceId(placeId, maxWidth)

      if (!freshPhotoUrl) {
        console.warn('[image-proxy] Could not get fresh photo for place:', placeId)
        return new NextResponse(null, { status: 404 })
      }

      imageUrl = freshPhotoUrl
    } else {
      // Decode the URL if it's double-encoded (browser may have encoded it again)
      imageUrl = rawUrl!
      try {
        // If the URL contains %3A (encoded :), it's likely double-encoded
        if (rawUrl!.includes('%3A') || rawUrl!.includes('%3a')) {
          imageUrl = decodeURIComponent(rawUrl!)
          console.log('[image-proxy] URL was double-encoded, decoded to:', imageUrl.substring(0, 100))
        }
      } catch (error) {
        console.warn('[image-proxy] Failed to decode URL:', error)
      }

      // Security: Only allow Google Places images to prevent SSRF and unauthorized API usage
      if (!isGooglePlacesUrl(imageUrl)) {
        const truncatedUrl = imageUrl.length > 100 ? imageUrl.substring(0, 100) + '...' : imageUrl
        console.warn('[image-proxy] Rejected non-Google Places URL:', truncatedUrl)
        return NextResponse.json({ error: 'Only Google Places images are allowed' }, { status: 400 })
      }

      // Additional validation: Ensure it's actually an HTTPS URL
      if (!imageUrl.startsWith('https://')) {
        console.warn('[image-proxy] Rejected non-HTTPS URL')
        return NextResponse.json({ error: 'Only HTTPS URLs are allowed' }, { status: 400 })
      }
    }

    // Always rewrite the URL to ensure the current API key is used
    // (stored URLs in the database may contain old/expired API keys)
    const rewrittenUrl = rewriteGooglePhotoUrl(imageUrl)

    const truncatedOriginal = imageUrl.length > 100 ? imageUrl.substring(0, 100) + '...' : imageUrl
    console.log('[image-proxy] Original URL:', truncatedOriginal)
    console.log('[image-proxy] Rewritten URL:', rewrittenUrl.replace(/key=[^&]+/, 'key=***'))
    console.log('[image-proxy] API Key present:', !!GOOGLE_PLACES_API_KEY)
    console.log('[image-proxy] Is New Places API:', isNewPlacesApiUrl(rewrittenUrl))
    console.log('[image-proxy] Is Legacy Places API:', isLegacyPlacesUrl(rewrittenUrl))
    console.log('[image-proxy] Using Place ID method:', !!placeId)

    const headers: HeadersInit = {
      Referer: FALLBACK_REFERER,
    }

    // Fetch the image from Google Places API
    const response = await fetch(rewrittenUrl, {
      headers,
      // Add timeout to prevent hanging requests
      signal: AbortSignal.timeout(10000), // 10 second timeout
    })

    console.log('[image-proxy] Response status:', response.status)
    console.log('[image-proxy] Response headers:', Object.fromEntries(response.headers.entries()))

    if (!response.ok) {
      console.error(`[image-proxy] Failed to fetch image: ${response.status} ${response.statusText}`)
      const errorText = await response.text()
      console.error(`[image-proxy] Error response:`, errorText.substring(0, 500))

      // 400/404 errors often indicate expired photo names
      // Photo names from Google Places API expire and cannot be cached
      if (response.status === 400 || response.status === 404) {
        console.error('[image-proxy] Photo name may be expired. Photo names from Places API cannot be cached.')
      }

      // Return a placeholder or error image
      return new NextResponse(null, { status: response.status })
    }

    // Validate content type is an image
    const contentType = response.headers.get('content-type') || 'image/jpeg'
    if (!contentType.startsWith('image/')) {
      console.warn('[image-proxy] Response is not an image:', contentType)
      return NextResponse.json({ error: 'Invalid content type' }, { status: 400 })
    }

    const imageBuffer = await response.arrayBuffer()

    return new NextResponse(imageBuffer, {
      status: 200,
      headers: {
        'Content-Type': contentType,
        // Cache for 24 hours at CDN/browser level — reduces repeat Places API calls
        // across page loads. Photo names rarely change within a day.
        'Cache-Control': 'public, max-age=86400, s-maxage=86400, stale-while-revalidate=3600',
        // Security headers
        'X-Content-Type-Options': 'nosniff',
        'X-Frame-Options': 'DENY',
        'Referrer-Policy': 'no-referrer',
      },
    })
  } catch (error) {
    console.error('[image-proxy] Error fetching image:', error)
    return NextResponse.json(
      { error: 'Failed to fetch image' },
      { status: 500 }
    )
  }
}