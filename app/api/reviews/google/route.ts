import { NextResponse } from 'next/server'

const API_KEY = process.env.GOOGLE_PLACES_API_KEY || process.env.NEXT_PUBLIC_GOOGLE_MAPS_API_KEY
const PLACES_API_BASE = 'https://places.googleapis.com/v1'

// Google Place ID for Jose Madrid Salsa
// This can be found from your Google My Business profile URL
// You can also use the place name/address to search if Place ID is not available
// Accept both the server-only and public variants of the place ID env var
const PLACE_ID = process.env.GOOGLE_PLACE_ID || process.env.NEXT_PUBLIC_GOOGLE_PLACE_ID || ''
const PLACE_NAME = process.env.GOOGLE_PLACE_NAME || 'Jose Madrid Salsa'

// Cache reviews for 2 hours (reviews don't change frequently)
export const revalidate = 7200 // 2 hours in seconds

export const runtime = 'nodejs' // Required for environment variable access

export async function GET() {
  if (!API_KEY) {
    return NextResponse.json(
      { error: 'Google Places API key not configured. Please set GOOGLE_PLACES_API_KEY or NEXT_PUBLIC_GOOGLE_MAPS_API_KEY.' },
      { status: 500 }
    )
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
    return NextResponse.json(
      { 
        error: 'Google Place ID not found. Please set GOOGLE_PLACE_ID environment variable or ensure GOOGLE_PLACE_NAME matches your business name.',
        reviews: [],
        totalRating: 0,
        totalReviews: 0
      },
      { status: 200 } // Return 200 with empty data instead of error
    )
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
      }
    )

    if (!apiResponse.ok) {
      const errorText = await apiResponse.text()
      console.error('Google Places API error:', apiResponse.status, errorText)
      // Return empty data instead of error to prevent UI breakage
      return NextResponse.json({
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
    return NextResponse.json({
      reviews: [],
      totalRating: 0,
      totalReviews: 0,
      error: 'Failed to fetch reviews',
    })
  }
}

