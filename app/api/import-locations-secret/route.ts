import fs from 'fs'
import path from 'path'
import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { parseFindUsMarkdown } from '@/lib/find-us-parser'

export const runtime = 'nodejs'
export const maxDuration = 300

const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms))
const API_KEY = process.env.GOOGLE_PLACES_API_KEY!

interface RawLocation {
  businessName: string; address: string; city: string; state: string
  zipCode?: string | null; phone?: string | null; website?: string | null
}

async function loadLocations(): Promise<RawLocation[]> {
  const mdPath = path.join(process.cwd(), 'public', 'find-us-locally', 'find-us-locally.md')
  if (fs.existsSync(mdPath)) return parseFindUsMarkdown(mdPath)
  const jsonPath = path.join(process.cwd(), 'lib', 'locations', 'locations-data.json')
  if (fs.existsSync(jsonPath)) return JSON.parse(fs.readFileSync(jsonPath, 'utf-8'))
  throw new Error('No location data source found')
}

async function geocodeAndPhoto(loc: RawLocation): Promise<{
  placeId: string|null; lat: number|null; lng: number|null; photoUrl: string|null
}> {
  const query = `${loc.businessName} ${loc.address} ${loc.city} ${loc.state}`
  try {
    const res = await fetch('https://places.googleapis.com/v1/places:searchText', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'X-Goog-Api-Key': API_KEY,
        'X-Goog-FieldMask': 'places.id,places.location,places.photos',
      },
      body: JSON.stringify({ textQuery: query, maxResultCount: 1 }),
      signal: AbortSignal.timeout(10000),
    })
    if (!res.ok) return { placeId: null, lat: null, lng: null, photoUrl: null }
    const data = await res.json()
    const place = data.places?.[0]
    if (!place) return { placeId: null, lat: null, lng: null, photoUrl: null }

    const placeId = place.id ?? null
    const lat = place.location?.latitude ?? null
    const lng = place.location?.longitude ?? null

    // Get photo URL from first photo
    let photoUrl: string | null = null
    if (place.photos?.[0]?.name) {
      photoUrl = `https://places.googleapis.com/v1/${place.photos[0].name}/media?key=${API_KEY}&maxWidthPx=800`
    }

    return { placeId, lat, lng, photoUrl }
  } catch {
    return { placeId: null, lat: null, lng: null, photoUrl: null }
  }
}

export async function POST(req: NextRequest) {
  const secret = req.nextUrl.searchParams.get('secret')
  if (!process.env.IMPORT_SECRET || secret !== process.env.IMPORT_SECRET) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  const body = await req.json().catch(() => ({}))
  const force = body.force === true
  const batchStart = typeof body.start === 'number' ? body.start : 0
  const batchSize = typeof body.size === 'number' ? body.size : 25

  let allLocations: RawLocation[]
  try { allLocations = await loadLocations() }
  catch (e: any) { return NextResponse.json({ error: e.message }, { status: 500 }) }

  const batch = allLocations.slice(batchStart, batchStart + batchSize)
  let geocoded = 0, photosFound = 0, imported = 0, failed = 0

  for (const loc of batch) {
    const existing = await prisma.retailLocation.findUnique({
      where: { businessName_address: { businessName: loc.businessName, address: loc.address } },
      select: { id: true, latitude: true, photoUrl: true },
    })

    const needsGeo = !existing?.latitude || force
    const needsPhoto = !existing?.photoUrl || force

    let placeId: string|null = null, lat: number|null = null
    let lng: number|null = null, photoUrl: string|null = null

    if (needsGeo || needsPhoto) {
      const result = await geocodeAndPhoto(loc)
      placeId = result.placeId
      if (needsGeo && result.lat) { lat = result.lat; lng = result.lng; geocoded++ }
      if (needsPhoto && result.photoUrl) { photoUrl = result.photoUrl; photosFound++ }
      await sleep(200) // Stay under quota
    }

    try {
      const record = await prisma.retailLocation.upsert({
        where: { businessName_address: { businessName: loc.businessName, address: loc.address } },
        update: {
          city: loc.city, state: loc.state,
          zipCode: loc.zipCode ?? null, phone: loc.phone ?? null, website: loc.website ?? null,
          isActive: true,
          ...(placeId ? { googlePlacesId: placeId } : {}),
          ...(lat != null ? { latitude: lat, longitude: lng } : {}),
          ...(photoUrl ? { photoUrl } : {}),
        },
        create: {
          businessName: loc.businessName, address: loc.address,
          city: loc.city, state: loc.state,
          zipCode: loc.zipCode ?? null, phone: loc.phone ?? null,
          website: loc.website ?? null,
          googlePlacesId: placeId ?? null,
          latitude: lat ?? null, longitude: lng ?? null,
          photoUrl: photoUrl ?? null,
          isActive: true, sortOrder: 0,
        },
      })

      if (photoUrl) {
        await prisma.locationPhoto.deleteMany({ where: { locationId: record.id } })
        await prisma.locationPhoto.create({ data: { locationId: record.id, url: photoUrl, sortOrder: 0 } })
      }
      imported++
    } catch (e: any) { failed++ }
  }

  return NextResponse.json({
    total: allLocations.length, batchStart, batchProcessed: batch.length,
    hasMore: batchStart + batch.length < allLocations.length,
    nextStart: batchStart + batch.length,
    geocoded, photosFound, imported, failed,
  })
}
