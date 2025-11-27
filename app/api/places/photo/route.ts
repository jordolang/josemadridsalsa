import { NextRequest, NextResponse } from 'next/server'

export async function GET(request: NextRequest) {
  const searchParams = request.nextUrl.searchParams
  const placeId = searchParams.get('placeId')

  if (!placeId) {
    return NextResponse.json({ error: 'Place ID is required' }, { status: 400 })
  }

  const apiKey = process.env.NEXT_PUBLIC_GOOGLE_MAPS_API_KEY
  if (!apiKey) {
    return NextResponse.json({ error: 'API key not configured' }, { status: 500 })
  }

  try {
    // Fetch place details to get photo reference
    const detailsUrl = `https://maps.googleapis.com/maps/api/place/details/json?place_id=${placeId}&fields=photos&key=${apiKey}`
    const detailsRes = await fetch(detailsUrl)
    
    if (!detailsRes.ok) {
      return NextResponse.json({ error: 'Failed to fetch place details' }, { status: detailsRes.status })
    }

    const detailsData = await detailsRes.json()
    
    if (detailsData.status !== 'OK') {
      return NextResponse.json({ error: detailsData.status }, { status: 400 })
    }

    // Use the last photo (index 9) which is the building image
    const photos = detailsData.result?.photos
    if (!photos || photos.length === 0) {
      return NextResponse.json({ error: 'No photos available' }, { status: 404 })
    }
    
    const photoRef = photos[photos.length - 1]?.photo_reference
    if (!photoRef) {
      return NextResponse.json({ error: 'No photos available' }, { status: 404 })
    }

    // Construct photo URL
    const photoUrl = `https://maps.googleapis.com/maps/api/place/photo?maxwidth=800&photo_reference=${photoRef}&key=${apiKey}`

    return NextResponse.json({ photoUrl })
  } catch (error) {
    console.error('Error fetching place photo:', error)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}
