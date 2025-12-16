import { NextRequest, NextResponse } from 'next/server'

const GOOGLE_PLACES_API_KEY = process.env.GOOGLE_PLACES_API_KEY || process.env.NEXT_PUBLIC_GOOGLE_MAPS_API_KEY
const FALLBACK_REFERER = 'https://www.josemadrid.net'

// Updated to support both legacy and new API formats
const LEGACY_PLACES_HOST = 'maps.googleapis.com'
const NEW_PLACES_HOST = 'places.googleapis.com'

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
 * Determines if this is a New Places API URL
 */
const isNewPlacesApiUrl = (url: string): boolean => {
  return url.includes('places.googleapis.com/v1/')
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
      // New Places API supports both query param and header auth, but query param is standard
      if (GOOGLE_PLACES_API_KEY) {
        url.searchParams.delete('key')
        url.searchParams.set('key', GOOGLE_PLACES_API_KEY)
      }
    } else {
      // Legacy API: photo_reference format uses query parameter auth
      // CRITICAL: Always replace the API key (old keys in database may be expired/invalid)
      if (GOOGLE_PLACES_API_KEY) {
        url.searchParams.delete('key')
        url.searchParams.set('key', GOOGLE_PLACES_API_KEY)
      }

      // Ensure we have size parameters for legacy API
      if (!url.searchParams.has('maxwidth') && !url.searchParams.has('maxheight')) {
        url.searchParams.set('maxwidth', '1600')
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
 * Security: Only allows Google Places URLs to prevent SSRF attacks and API key exposure.
 * The API key is kept server-side and never exposed in client-visible URLs.
 */
export async function GET(request: NextRequest) {
  const searchParams = request.nextUrl.searchParams
  const rawUrl = searchParams.get('url')

  if (!rawUrl) {
    console.warn('[image-proxy] Missing url parameter')
    return NextResponse.json({ error: 'Missing url parameter' }, { status: 400 })
  }

  // Decode the URL if it's double-encoded (browser may have encoded it again)
  let imageUrl = rawUrl
  try {
    // If the URL contains %3A (encoded :), it's likely double-encoded
    if (rawUrl.includes('%3A') || rawUrl.includes('%3a')) {
      imageUrl = decodeURIComponent(rawUrl)
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

  try {
    const rewrittenUrl = rewriteGooglePhotoUrl(imageUrl)

    const truncatedOriginal = imageUrl.length > 100 ? imageUrl.substring(0, 100) + '...' : imageUrl
    console.log('[image-proxy] Original URL:', truncatedOriginal)
    console.log('[image-proxy] Rewritten URL:', rewrittenUrl.replace(/key=[^&]+/, 'key=***'))
    console.log('[image-proxy] API Key present:', !!GOOGLE_PLACES_API_KEY)
    console.log('[image-proxy] Is New Places API:', isNewPlacesApiUrl(rewrittenUrl))

    const headers: HeadersInit = {
      Referer: FALLBACK_REFERER,
    }

    // Verify API key is available
    if (!GOOGLE_PLACES_API_KEY) {
      console.error('[image-proxy] Missing API key')
      return NextResponse.json({ error: 'API key not configured' }, { status: 500 })
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
        // Cache for 1 hour (photos can change and names can expire)
        'Cache-Control': 'public, max-age=3600, s-maxage=3600',
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