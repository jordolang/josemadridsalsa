import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { findPlaceByNameAddress, getBestPhotoUrlForPlace, getCompanyLogoFromWebsite } from '@/lib/google-places'

export const runtime = 'nodejs'

const MAX_PHOTOS_PER_LOCATION = 5

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
    include: {
      photos: true,
    },
    orderBy: [{ state: 'asc' }, { city: 'asc' }, { businessName: 'asc' }],
  })

  let processed = 0
  let updated = 0
  let totalPhotosAdded = 0
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
        // Extract Place ID from the place object
        const googlePlaceId = placeResult.place.id || null

        // Get all photos (up to MAX_PHOTOS_PER_LOCATION)
        const photos = placeResult.photos.slice(0, MAX_PHOTOS_PER_LOCATION)

        if (photos.length > 0) {
          // Use transaction to update location and photos atomically
          await prisma.$transaction(async (tx) => {
            // Update location with primary photo and Place ID
            await tx.retailLocation.update({
              where: { id: loc.id },
              data: {
                photoUrl: photos[0], // Use first photo as primary
                googlePlacesId: googlePlaceId,
              },
            })

            // Delete existing photos if force re-fetch
            if (force || loc.photos.length === 0) {
              await tx.locationPhoto.deleteMany({
                where: { locationId: loc.id },
              })

              // Create new photo records
              for (let i = 0; i < photos.length; i++) {
                await tx.locationPhoto.create({
                  data: {
                    url: photos[i],
                    caption: i === 0 ? 'Primary storefront image' : null,
                    sortOrder: i,
                    locationId: loc.id,
                  },
                })
              }
            }
          })

          updated++
          totalPhotosAdded += photos.length
        } else {
          // No photos in Places, try fallback to company logo
          if (loc.website) {
            const logoUrl = await getCompanyLogoFromWebsite(loc.website)
            if (logoUrl) {
              await prisma.$transaction(async (tx) => {
                await tx.retailLocation.update({
                  where: { id: loc.id },
                  data: {
                    photoUrl: logoUrl,
                    googlePlacesId: googlePlaceId,
                  },
                })

                // Create single photo record
                await tx.locationPhoto.deleteMany({
                  where: { locationId: loc.id },
                })
                await tx.locationPhoto.create({
                  data: {
                    url: logoUrl,
                    caption: 'Company logo',
                    sortOrder: 0,
                    locationId: loc.id,
                  },
                })
              })

              updated++
              totalPhotosAdded += 1
            } else {
              missing.push({
                businessName: loc.businessName,
                city: loc.city,
                state: loc.state,
                reason: 'No photos in Google Places and no logo from website'
              })
            }
          } else {
            missing.push({
              businessName: loc.businessName,
              city: loc.city,
              state: loc.state,
              reason: 'No photos in Google Places and no website for logo fallback'
            })
          }
        }
      } else {
        // No Google Places match, try website logo
        if (loc.website) {
          const logoUrl = await getCompanyLogoFromWebsite(loc.website)
          if (logoUrl) {
            await prisma.$transaction(async (tx) => {
              await tx.retailLocation.update({
                where: { id: loc.id },
                data: { photoUrl: logoUrl },
              })

              await tx.locationPhoto.deleteMany({
                where: { locationId: loc.id },
              })
              await tx.locationPhoto.create({
                data: {
                  url: logoUrl,
                  caption: 'Company logo',
                  sortOrder: 0,
                  locationId: loc.id,
                },
              })
            })

            updated++
            totalPhotosAdded += 1
          } else {
            missing.push({
              businessName: loc.businessName,
              city: loc.city,
              state: loc.state,
              reason: 'No Google Places match and no logo from website'
            })
          }
        } else {
          missing.push({
            businessName: loc.businessName,
            city: loc.city,
            state: loc.state,
            reason: 'No Google Places match and no website for logo fallback'
          })
        }
      }
    } catch (e: any) {
      console.error(`Error processing ${loc.businessName}:`, e)
      missing.push({
        businessName: loc.businessName,
        city: loc.city,
        state: loc.state,
        reason: e?.message || 'Error'
      })
    }
  }

  return NextResponse.json({
    processed,
    updated,
    totalPhotosAdded,
    missingCount: missing.length,
    missing,
    maxPhotosPerLocation: MAX_PHOTOS_PER_LOCATION,
  })
}


