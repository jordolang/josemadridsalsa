import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'

export const runtime = 'nodejs'

// Cache geocoded coordinates in database
export async function POST(req: NextRequest) {
  const apiKey = process.env.NEXT_PUBLIC_GOOGLE_MAPS_API_KEY || process.env.GOOGLE_PLACES_API_KEY
  
  if (!apiKey) {
    return NextResponse.json({ error: 'Google Maps API key not configured' }, { status: 500 })
  }

  try {
    const { locations } = await req.json()
    
    if (!Array.isArray(locations)) {
      return NextResponse.json({ error: 'Locations array required' }, { status: 400 })
    }

    const geocoded = await Promise.all(
      locations.map(async (loc: any) => {
        // Check if we already have coordinates in database
        const dbLoc = await prisma.retailLocation.findFirst({
          where: {
            businessName: loc.businessName,
            address: loc.address,
            city: loc.city,
            state: loc.state,
          },
          select: { id: true },
        })

        // For now, just return the location - we'll geocode client-side
        // to avoid rate limits on server
        return {
          ...loc,
          // Position will be set client-side via geocoding
        }
      })
    )

    return NextResponse.json({ locations: geocoded })
  } catch (error) {
    console.error('Error processing locations:', error)
    return NextResponse.json({ error: 'Failed to process locations' }, { status: 500 })
  }
}

