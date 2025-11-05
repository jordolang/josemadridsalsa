import { NextResponse } from 'next/server'

const API_KEY = process.env.GOOGLE_PLACES_API_KEY
const PLACES_API_BASE = 'https://places.googleapis.com/v1'

// Google Place ID for Jose Madrid Salsa
// This can be found from your Google My Business profile URL
const PLACE_ID = process.env.GOOGLE_PLACE_ID || ''

// Cache reviews for 2 hours (reviews don't change frequently)
export const revalidate = 7200 // 2 hours in seconds

export async function GET() {
  if (!API_KEY) {
    return NextResponse.json(
      { error: 'Google Places API key not configured' },
      { status: 500 }
    )
  }

  if (!PLACE_ID) {
    return NextResponse.json(
      { error: 'Google Place ID not configured. Please set GOOGLE_PLACE_ID environment variable.' },
      { status: 500 }
    )
  }

  try {
    const apiResponse = await fetch(
      `${PLACES_API_BASE}/places/${PLACE_ID}`,
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
      return NextResponse.json(
        { error: 'Failed to fetch reviews from Google' },
        { status: apiResponse.status }
      )
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
    return NextResponse.json(
      { error: 'Failed to fetch reviews' },
      { status: 500 }
    )
  }
}

