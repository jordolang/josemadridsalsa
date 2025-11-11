import { NextResponse, type NextRequest } from 'next/server'
import { getLocationById } from '@/lib/locations/query'
import { getLocationDetails } from '@/lib/locations/details'

export const revalidate = 3600

export async function GET(_request: NextRequest, { params }: { params: Promise<{ locationId: string }> }) {
  const { locationId } = await params
  const location = await getLocationById(locationId)

  if (!location) {
    return NextResponse.json({ error: 'Location not found' }, { status: 404 })
  }

  if (!location.googlePlaceId) {
    return NextResponse.json({
      data: {
        placeId: null,
        rating: location.reviewRating ?? null,
        reviewCount: location.reviewCount ?? null,
        hours: location.hours ?? [],
        phone: location.phone,
        website: location.website,
        photos: location.photoGallery ?? (location.photoUrl ? [location.photoUrl] : []),
      },
    })
  }

  const details = await getLocationDetails(location.googlePlaceId)

  return NextResponse.json({
    data: {
      placeId: location.googlePlaceId,
      rating: details?.rating ?? location.reviewRating ?? null,
      reviewCount: details?.reviewCount ?? location.reviewCount ?? null,
      hours: details?.hours?.length ? details.hours : location.hours ?? [],
      phone: details?.phone ?? location.phone,
      website: details?.website ?? location.website,
      photos:
        details?.photos?.length
          ? details.photos
          : location.photoGallery ?? (location.photoUrl ? [location.photoUrl] : []),
    },
  })
}
