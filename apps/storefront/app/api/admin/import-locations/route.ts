/**
 * POST /api/admin/import-locations
 * 
 * Full pipeline: markdown → geocode → photos → DB upsert
 * Requires content:write permission.
 * 
 * Body: { force?: boolean, skipGeo?: boolean, dryRun?: boolean, limit?: number }
 */
import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { logAuditWithRequest } from '@/lib/audit'
import { requirePermission } from '@/lib/rbac'
import { parseFindUsMarkdown, readFindUsMarkdownAbsolute } from '@/lib/find-us-parser'
import { findPlaceByNameAddress, getBestPhotoUrlForPlace } from '@/lib/google-places'

export const runtime = 'nodejs'
export const maxDuration = 300

const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms))

export async function POST(req: NextRequest) {
  let actor: Awaited<ReturnType<typeof requirePermission>>
  try {
    actor = await requirePermission('content:write')
  } catch {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  const body = await req.json().catch(() => ({}))
  const dryRun = body.dryRun === true
  const skipGeo = body.skipGeo === true
  const forcePhoto = body.force === true
  const limit = typeof body.limit === 'number' ? body.limit : undefined

  // Parse locations from markdown
  let parsed: Awaited<ReturnType<typeof parseFindUsMarkdown>>
  try {
    const mdPath = await readFindUsMarkdownAbsolute()
    parsed = await parseFindUsMarkdown(mdPath)
  } catch (e: any) {
    return NextResponse.json({ error: `Could not parse markdown: ${e.message}` }, { status: 500 })
  }

  const locations = limit ? parsed.slice(0, limit) : parsed
  const results: Array<{ name: string; city: string; state: string; status: string; geo: boolean; photo: boolean }> = []
  let geocoded = 0, photos = 0, imported = 0, failed = 0

  for (const loc of locations) {
    let placeId: string | null = null
    let lat: number | null = null
    let lng: number | null = null
    let photoUrl: string | null = null
    let hasGeo = false
    let hasPhoto = false

    // Step 1: Geocode + get Place ID + photo
    if (!skipGeo) {
      try {
        const result = await findPlaceByNameAddress({
          businessName: loc.businessName,
          address: loc.address,
          city: loc.city,
          state: loc.state,
        })

        if (result?.place) {
          placeId = result.place.id ?? null
          lat = result.place.location?.latitude ?? null
          lng = result.place.location?.longitude ?? null
          const bestPhoto = getBestPhotoUrlForPlace(result.place)
          if (bestPhoto) {
            photoUrl = bestPhoto
            hasPhoto = true
            photos++
          }
          if (lat && lng) {
            hasGeo = true
            geocoded++
          }
        }
      } catch (e) {
        // non-fatal, continue with null geo
      }
      await sleep(250)
    }

    if (dryRun) {
      results.push({ name: loc.businessName, city: loc.city, state: loc.state, status: 'dry-run', geo: hasGeo, photo: hasPhoto })
      continue
    }

    // Step 2: Upsert into DB
    try {
      // Check if exists (to decide whether to overwrite photo)
      const existing = await prisma.retailLocation.findUnique({
        where: { businessName_address: { businessName: loc.businessName, address: loc.address } },
        select: { id: true, photoUrl: true, googlePlacesId: true, latitude: true },
      })

      const shouldUpdatePhoto = forcePhoto || !existing?.photoUrl
      const shouldUpdateGeo = !existing?.latitude || forcePhoto

      const upsertData = {
        city: loc.city,
        state: loc.state,
        zipCode: loc.zipCode ?? null,
        phone: loc.phone ?? null,
        website: loc.website ?? null,
        isActive: true,
        ...(shouldUpdatePhoto && photoUrl ? { photoUrl } : {}),
        ...(shouldUpdateGeo && placeId ? { googlePlacesId: placeId } : {}),
        ...(shouldUpdateGeo && lat != null ? { latitude: lat, longitude: lng } : {}),
      }

      const record = await prisma.retailLocation.upsert({
        where: { businessName_address: { businessName: loc.businessName, address: loc.address } },
        update: upsertData,
        create: {
          businessName: loc.businessName,
          address: loc.address,
          sortOrder: 0,
          ...upsertData,
        },
      })

      // Upsert photo into LocationPhoto table
      if (shouldUpdatePhoto && photoUrl) {
        const existingPhotos = await prisma.locationPhoto.count({ where: { locationId: record.id } })
        if (existingPhotos === 0 || forcePhoto) {
          await prisma.locationPhoto.deleteMany({ where: { locationId: record.id } })
          await prisma.locationPhoto.create({
            data: { locationId: record.id, url: photoUrl, sortOrder: 0 },
          })
        }
      }

      imported++
      results.push({ name: loc.businessName, city: loc.city, state: loc.state, status: 'ok', geo: hasGeo, photo: hasPhoto })
    } catch (e: any) {
      failed++
      results.push({ name: loc.businessName, city: loc.city, state: loc.state, status: `error: ${e.message?.slice(0, 80)}`, geo: false, photo: false })
    }
  }

  await logAuditWithRequest(
    {
      userId: actor.id,
      action: 'import',
      entityType: 'retail_location',
      changes: { total: locations.length, imported, geocoded, photosFound: photos, failed, dryRun },
    },
    req
  )

  return NextResponse.json({
    total: locations.length,
    geocoded,
    photosFound: photos,
    imported,
    failed,
    dryRun,
    results,
  })
}
