import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { findPlaceByNameAddress, getBestPhotoUrlForPlace, getCompanyLogoFromWebsite } from '@/lib/google-places'

export const runtime = 'nodejs'

export async function POST(req: NextRequest) {
  const apiKey = process.env.GOOGLE_PLACES_API_KEY || process.env.NEXT_PUBLIC_GOOGLE_MAPS_API_KEY
  const { force } = await req.json().catch(() => ({ force: false }))

  if (!apiKey) {
    return NextResponse.json({ error: 'GOOGLE_PLACES_API_KEY or NEXT_PUBLIC_GOOGLE_MAPS_API_KEY not configured' }, { status: 400 })
  }

  const locations = await prisma.retailLocation.findMany({
    where: {
      isActive: true,
      ...(force ? {} : { photoUrl: null }),
    },
    orderBy: [{ state: 'asc' }, { city: 'asc' }, { businessName: 'asc' }],
  })

  let processed = 0
  let updated = 0
  const missing: Array<{ businessName: string; city: string; state: string; reason: string }> = []

  for (const loc of locations) {
    processed++
    try {
      // Try Google Places first
      const placeResult = await findPlaceByNameAddress({
        businessName: loc.businessName,
        address: loc.address,
        city: loc.city,
        state: loc.state,
      })

      let photoUrl: string | null = null
      if (placeResult?.place) {
        photoUrl = getBestPhotoUrlForPlace(placeResult.place)
      }

      // Fallback to company logo
      if (!photoUrl && loc.website) {
        photoUrl = await getCompanyLogoFromWebsite(loc.website)
      }

      if (photoUrl) {
        await prisma.retailLocation.update({ where: { id: loc.id }, data: { photoUrl } })
        updated++
      } else {
        missing.push({ businessName: loc.businessName, city: loc.city, state: loc.state, reason: placeResult ? 'No photos in Google Places' : 'No Google Places match' })
      }
    } catch (e: any) {
      missing.push({ businessName: loc.businessName, city: loc.city, state: loc.state, reason: e?.message || 'Error' })
    }
  }

  return NextResponse.json({ processed, updated, missingCount: missing.length, missing })
}


