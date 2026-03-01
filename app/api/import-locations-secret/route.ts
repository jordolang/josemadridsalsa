import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { parseFindUsMarkdown } from '@/lib/find-us-parser'
import { findPlaceByNameAddress, getBestPhotoUrlForPlace } from '@/lib/google-places'
import path from 'path'

export const runtime = 'nodejs'
export const maxDuration = 300

const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms))

export async function POST(req: NextRequest) {
  const secret = req.nextUrl.searchParams.get('secret')
  if (!process.env.IMPORT_SECRET || secret !== process.env.IMPORT_SECRET) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  const body = await req.json().catch(() => ({}))
  const skipGeo = body.skipGeo === true
  const force = body.force === true
  const batchStart = typeof body.start === 'number' ? body.start : 0
  const batchSize = typeof body.size === 'number' ? body.size : 50

  const mdPath = path.join(process.cwd(), 'public', 'find-us-locally', 'find-us-locally.md')
  if (!fs.existsSync(mdPath)) {
    return NextResponse.json({ error: 'Markdown not found: ' + mdPath }, { status: 500 })
  }

  const allLocations = await parseFindUsMarkdown(mdPath)
  const batch = allLocations.slice(batchStart, batchStart + batchSize)

  const results: Array<{ name: string; status: string; geo: boolean; photo: boolean }> = []
  let geocoded = 0, photosFound = 0, imported = 0, failed = 0

  for (const loc of batch) {
    let placeId: string | null = null
    let lat: number | null = null
    let lng: number | null = null
    let photoUrl: string | null = null
    let hasGeo = false
    let hasPhoto = false

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
          const best = getBestPhotoUrlForPlace(result.place)
          if (best) { photoUrl = best; hasPhoto = true; photosFound++ }
          if (lat && lng) { hasGeo = true; geocoded++ }
        }
      } catch {}
      await sleep(300)
    }

    try {
      const existing = await prisma.retailLocation.findUnique({
        where: { businessName_address: { businessName: loc.businessName, address: loc.address } },
        select: { id: true, photoUrl: true, latitude: true },
      })

      const record = await prisma.retailLocation.upsert({
        where: { businessName_address: { businessName: loc.businessName, address: loc.address } },
        update: {
          city: loc.city, state: loc.state,
          zipCode: loc.zipCode ?? null,
          phone: loc.phone ?? null,
          website: loc.website ?? null,
          isActive: true,
          ...((!existing?.photoUrl || force) && photoUrl ? { photoUrl } : {}),
          ...((!existing?.latitude || force) && placeId ? { googlePlacesId: placeId } : {}),
          ...((!existing?.latitude || force) && lat != null ? { latitude: lat, longitude: lng } : {}),
        },
        create: {
          businessName: loc.businessName, address: loc.address,
          city: loc.city, state: loc.state,
          zipCode: loc.zipCode ?? null,
          phone: loc.phone ?? null,
          website: loc.website ?? null,
          photoUrl: photoUrl ?? null,
          googlePlacesId: placeId ?? null,
          latitude: lat ?? null,
          longitude: lng ?? null,
          isActive: true, sortOrder: 0,
        },
      })

      if (photoUrl && (!existing?.photoUrl || force)) {
        await prisma.locationPhoto.deleteMany({ where: { locationId: record.id } })
        await prisma.locationPhoto.create({
          data: { locationId: record.id, url: photoUrl, sortOrder: 0 },
        })
      }

      imported++
      results.push({ name: loc.businessName, status: 'ok', geo: hasGeo, photo: hasPhoto })
    } catch (e: any) {
      failed++
      results.push({ name: loc.businessName, status: 'error: ' + (e.message?.slice(0, 80) ?? ''), geo: false, photo: false })
    }
  }

  return NextResponse.json({
    total: allLocations.length,
    batchStart,
    batchProcessed: batch.length,
    hasMore: batchStart + batch.length < allLocations.length,
    nextStart: batchStart + batch.length,
    geocoded, photosFound, imported, failed,
    results,
  })
}
