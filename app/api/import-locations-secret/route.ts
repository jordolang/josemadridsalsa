import fs from 'fs'
import path from 'path'
import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { parseFindUsMarkdown } from '@/lib/find-us-parser'

export const runtime = 'nodejs'
export const maxDuration = 300

const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms))

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

async function geocodeNominatim(loc: RawLocation): Promise<{lat:number,lng:number}|null> {
  const q = encodeURIComponent(`${loc.address}, ${loc.city}, ${loc.state}`)
  try {
    const res = await fetch(`https://nominatim.openstreetmap.org/search?q=${q}&format=json&limit=1`, {
      headers: { 'User-Agent': 'josemadridsalsa-import/1.0' },
      signal: AbortSignal.timeout(8000),
    })
    if (!res.ok) return null
    const data = await res.json()
    if (!data[0]) return null
    return { lat: parseFloat(data[0].lat), lng: parseFloat(data[0].lon) }
  } catch { return null }
}

async function getPhotoUrl(loc: RawLocation): Promise<string|null> {
  if (!loc.website) return null
  try {
    const domain = new URL(loc.website.startsWith('http') ? loc.website : `https://${loc.website}`).hostname.replace('www.','')
    // Try Clearbit logo
    const clearbit = `https://logo.clearbit.com/${domain}`
    const r = await fetch(clearbit, { method:'HEAD', signal: AbortSignal.timeout(5000) })
    if (r.ok) return clearbit
  } catch {}
  return null
}

export async function POST(req: NextRequest) {
  const secret = req.nextUrl.searchParams.get('secret')
  if (!process.env.IMPORT_SECRET || secret !== process.env.IMPORT_SECRET) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  const body = await req.json().catch(() => ({}))
  const skipGeo = body.skipGeo === true
  const force = body.force === true
  const batchStart = typeof body.start === 'number' ? body.start : 0
  const batchSize = typeof body.size === 'number' ? body.size : 30

  let allLocations: RawLocation[]
  try { allLocations = await loadLocations() } catch (e: any) {
    return NextResponse.json({ error: e.message }, { status: 500 })
  }

  const batch = allLocations.slice(batchStart, batchStart + batchSize)
  let geocoded = 0, photosFound = 0, imported = 0, failed = 0

  for (const loc of batch) {
    let lat: number|null = null, lng: number|null = null, photoUrl: string|null = null

    if (!skipGeo) {
      const geo = await geocodeNominatim(loc)
      if (geo) { lat = geo.lat; lng = geo.lng; geocoded++ }
      await sleep(1100) // Nominatim rate limit: 1 req/sec

      const photo = await getPhotoUrl(loc)
      if (photo) { photoUrl = photo; photosFound++ }
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
          zipCode: loc.zipCode ?? null, phone: loc.phone ?? null, website: loc.website ?? null,
          isActive: true,
          ...((!existing?.photoUrl || force) && photoUrl ? { photoUrl } : {}),
          ...((!existing?.latitude || force) && lat != null ? { latitude: lat, longitude: lng } : {}),
        },
        create: {
          businessName: loc.businessName, address: loc.address,
          city: loc.city, state: loc.state,
          zipCode: loc.zipCode ?? null, phone: loc.phone ?? null,
          website: loc.website ?? null, photoUrl: photoUrl ?? null,
          latitude: lat ?? null, longitude: lng ?? null,
          isActive: true, sortOrder: 0,
        },
      })

      if (photoUrl && (!existing?.photoUrl || force)) {
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
