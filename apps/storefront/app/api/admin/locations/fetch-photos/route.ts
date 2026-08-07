import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { requirePermission } from '@/lib/rbac'
import { logAuditWithRequest } from '@/lib/audit'
import { findPlaceByNameAddress, getBestPhotoUrlForPlace, getCompanyLogoFromWebsite } from '@/lib/google-places'

export const runtime = 'nodejs'

export async function POST(req: NextRequest) {
  // This route was previously unauthenticated: an anonymous POST could enumerate every
  // active location, spend billable Google Places quota, and write photo URLs back to the
  // database. It sits under /api/admin but nothing enforced that — the proxy only handles
  // fundraising redirects.
  let actor: Awaited<ReturnType<typeof requirePermission>>
  try {
    actor = await requirePermission('content:write')
  } catch {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

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

      if (placeResult?.place) {
        // Use getBestPhotoUrlForPlace to get the optimal photo
        const photoUrl = getBestPhotoUrlForPlace(placeResult.place)

        if (photoUrl) {
          await prisma.retailLocation.update({
            where: { id: loc.id },
            data: {
              photoUrl,
              googlePlacesId: placeResult.place.id,
            },
          })
          updated++
          continue
        }
      }

      // Step 2: Try company logo from website
      if (loc.website) {
        const logoUrl = await getCompanyLogoFromWebsite(loc.website)

        if (logoUrl) {
          await prisma.retailLocation.update({
            where: { id: loc.id },
            data: { photoUrl: logoUrl },
          })
          updated++
          continue
        }
      }

      // Step 3: Fallback to placeholder
      await prisma.retailLocation.update({
        where: { id: loc.id },
        data: { photoUrl: '/images/store-placeholder.png' },
      })

      missing.push({
        businessName: loc.businessName,
        city: loc.city,
        state: loc.state,
        reason: placeResult ? 'No photos in Google Places' : 'No Google Places match',
      })
    } catch (e: any) {
      console.error(`Error processing ${loc.businessName}:`, e)

      // Set placeholder on error
      await prisma.retailLocation.update({
        where: { id: loc.id },
        data: { photoUrl: '/images/store-placeholder.png' },
      })

      missing.push({
        businessName: loc.businessName,
        city: loc.city,
        state: loc.state,
        reason: e?.message || 'Error',
      })
    }
  }

  await logAuditWithRequest(
    {
      userId: actor.id,
      action: 'update',
      entityType: 'retail_location',
      changes: { processed, updated, missing: missing.length, force: !!force },
    },
    req
  )

  return NextResponse.json({
    processed,
    updated,
    missingCount: missing.length,
    missing,
  })
}


