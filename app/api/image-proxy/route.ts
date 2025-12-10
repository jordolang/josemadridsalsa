import { NextRequest, NextResponse } from 'next/server'
import { isGooglePlacesUrl } from '@/lib/utils/image'

const GOOGLE_PLACES_API_KEY = process.env.GOOGLE_PLACES_API_KEY || process.env.NEXT_PUBLIC_GOOGLE_MAPS_API_KEY
const GOOGLE_PHOTO_HOST = 'places.googleapis.com'
const FALLBACK_REFERER = 'https://www.josemadrid.net'

/**
 * Rewrites a Google Places photo URL to use the current API key from environment variables.
 * This ensures we always use the latest key and don't rely on stale keys in the database.
 */
const rewriteGooglePhotoUrl = (originalUrl: string): string => {
  if (!originalUrl.startsWith(`https://${GOOGLE_PHOTO_HOST}/`)) {
    return originalUrl
  }

  try {
    const url = new URL(originalUrl)
    // Always prefer the currently configured API key so we don't rely on stale keys baked into JSON.
    if (GOOGLE_PLACES_API_KEY) {
      url.searchParams.delete('key')
      url.searchParams.set('key', GOOGLE_PLACES_API_KEY)
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
  const imageUrl = searchParams.get('url')

  if (!imageUrl) {
    console.warn('[image-proxy] Missing url parameter')
    return NextResponse.json({ error: 'Missing url parameter' }, { status: 400 })
  }

  // Security: Only allow Google Places images to prevent SSRF and unauthorized API usage
  if (!isGooglePlacesUrl(imageUrl)) {
    console.warn('[image-proxy] Rejected non-Google Places URL:', imageUrl.substring(0, 50))
    return NextResponse.json({ error: 'Only Google Places images are allowed' }, { status: 400 })
  }

  // Additional validation: Ensure it's actually an HTTPS URL
  if (!imageUrl.startsWith('https://')) {
    console.warn('[image-proxy] Rejected non-HTTPS URL')
    return NextResponse.json({ error: 'Only HTTPS URLs are allowed' }, { status: 400 })
  }

  try {
    const rewrittenUrl = rewriteGooglePhotoUrl(imageUrl)

    // Fetch the image from Google Places API
    const response = await fetch(rewrittenUrl, {
      headers: {
        Referer: FALLBACK_REFERER,
      },
      // Add timeout to prevent hanging requests
      signal: AbortSignal.timeout(10000), // 10 second timeout
    })

    if (!response.ok) {
      console.error(`[image-proxy] Failed to fetch image: ${response.status} ${response.statusText}`)
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
        // Cache for 1 year since location images rarely change
        'Cache-Control': 'public, max-age=31536000, immutable',
        // Security headers
        'X-Content-Type-Options': 'nosniff',
      },
    })
  } catch (error) {
    if (error instanceof Error && error.name === 'AbortError') {
      console.error('[image-proxy] Request timeout')
      return NextResponse.json({ error: 'Request timeout' }, { status: 504 })
    }
    console.error('[image-proxy] Error proxying image:', error)
    return NextResponse.json({ error: 'Failed to fetch image' }, { status: 500 })
  }
}
