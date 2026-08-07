import { NextResponse } from 'next/server'
import { ok, serverError } from '@/lib/api'

const PLACES_API_BASE = 'https://places.googleapis.com/v1'

/** How long Google's response is reused. Reviews change rarely and the call is billable. */
const REVIEWS_TTL_SECONDS = 7200

// Google Place ID for Jose Madrid Salsa
// This can be found from your Google My Business profile URL
// You can also use the place name/address to search if Place ID is not available
// Accept both the server-only and public variants of the place ID env var
export const runtime = 'nodejs' // Required for environment variable access

/**
 * Rendered per request rather than prerendered.
 *
 * This route previously declared `revalidate = 7200`, which made Next execute it during
 * `next build` and bake the result into the static output. The build environment has no
 * Google Places credentials, so what got baked was a 500 — and production then served that
 * 500 for up to two hours after every deploy, even though the key is present in the runtime
 * environment. Caching now lives on the upstream fetch instead, which keeps the billable
 * call down to one per TTL without pinning a build-time failure into the output.
 */
export const dynamic = 'force-dynamic'

export async function GET() {
  // Read at request time, not module scope, so the values come from the runtime
  // environment rather than whatever existed when the bundle was built.
  const API_KEY =
    process.env.GOOGLE_PLACES_API_KEY || process.env.NEXT_PUBLIC_GOOGLE_MAPS_API_KEY
  const PLACE_ID =
    process.env.GOOGLE_PLACE_ID || process.env.NEXT_PUBLIC_GOOGLE_PLACE_ID || ''
  const PLACE_NAME = process.env.GOOGLE_PLACE_NAME || 'Jose Madrid Salsa'

  if (!API_KEY) {
    return serverError('Google Places API key not configured. Please set GOOGLE_PLACES_API_KEY or NEXT_PUBLIC_GOOGLE_MAPS_API_KEY.')
  }

  // If no Place ID, try to find it by name
  let placeId = PLACE_ID
  if (!placeId) {
    try {
      // Search for the place by name
      const searchResponse = await fetch(
        `${PLACES_API_BASE}/places:searchText`,
        {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'X-Goog-Api-Key': API_KEY,
            'X-Goog-FieldMask': 'places.id',
          },
          body: JSON.stringify({
            textQuery: PLACE_NAME,
          }),
          next: { revalidate: REVIEWS_TTL_SECONDS },
        }
      )

      if (searchResponse.ok) {
        const searchData = await searchResponse.json()
        if (searchData.places && searchData.places.length > 0) {
          placeId = searchData.places[0].id
        }
      }
    } catch (searchError) {
      console.error('Error searching for place:', searchError)
    }
  }

  if (!placeId) {
    return ok({
      error: 'Google Place ID not found. Please set GOOGLE_PLACE_ID environment variable or ensure GOOGLE_PLACE_NAME matches your business name.',
      reviews: [],
      totalRating: 0,
      totalReviews: 0
    })
  }

  try {
    const apiResponse = await fetch(
      `${PLACES_API_BASE}/places/${placeId}`,
      {
        method: 'GET',
        headers: {
          'Content-Type': 'application/json',
          'X-Goog-Api-Key': API_KEY,
          'X-Goog-FieldMask': 'reviews,rating,userRatingCount',
        },
        next: { revalidate: REVIEWS_TTL_SECONDS },
      }
    )

    if (!apiResponse.ok) {
      const errorText = await apiResponse.text()
      console.error('Google Places API error:', apiResponse.status, errorText)
      // Return empty data instead of error to prevent UI breakage
      return ok({
        reviews: [],
        totalRating: 0,
        totalReviews: 0,
        error: 'Failed to fetch reviews from Google',
      })
    }

    const data = await apiResponse.json()

    // Extract reviews
    const reviews = data.reviews || []

    // Return all reviews (client will randomize)
    const allReviews = reviews.map((review: any) => ({
      authorName: review.authorAttribution?.displayName || 'Anonymous',
      rating: review.rating || 5,
      text: review.text?.text || '',
      relativePublishTime: review.publishTime
        ? new Date(review.publishTime).toLocaleDateString('en-US', {
            year: 'numeric',
            month: 'long',
            day: 'numeric',
          })
        : null,
      publishTime: review.publishTime || null,
    }))

    const nextResponse = NextResponse.json({
      reviews: allReviews,
      totalRating: data.rating || 0,
      totalReviews: data.userRatingCount || 0,
    })

    // Cache for 2 hours
    nextResponse.headers.set(
      'Cache-Control',
      'public, s-maxage=7200, stale-while-revalidate=86400'
    )

    return nextResponse
  } catch (error) {
    console.error('Error fetching Google reviews:', error)
    // Return empty data instead of error to prevent UI breakage
    return ok({
      reviews: [],
      totalRating: 0,
      totalReviews: 0,
      error: 'Failed to fetch reviews',
    })
  }
}

