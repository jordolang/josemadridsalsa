/**
 * Geocode all locations and import them into the database.
 * Run with: DATABASE_URL=... npx tsx scripts/geocode-and-import-locations.ts
 */
import fs from 'fs/promises'
import path from 'path'
import { PrismaClient } from '@prisma/client'

const API_KEY = process.env.GOOGLE_PLACES_API_KEY
const DATA_PATH = path.join(process.cwd(), 'lib/locations/locations-data.json')
const DELAY_MS = 300

const prisma = new PrismaClient()

interface RawLocation {
  id: string
  businessName: string
  address: string
  city: string
  state: string
  zipCode: string | null
  phone: string | null
  website: string | null
  photoUrl: string | null
}

const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms))

async function geocodeLocation(loc: RawLocation) {
  const q = `${loc.businessName}, ${loc.address}, ${loc.city}, ${loc.state}`
  try {
    const res = await fetch('https://places.googleapis.com/v1/places:searchText', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'X-Goog-Api-Key': API_KEY,
        'X-Goog-FieldMask': 'places.id,places.location,places.photos',
      },
      body: JSON.stringify({ textQuery: q, maxResultCount: 1 }),
    })
    if (!res.ok) return null
    const data = await res.json()
    const place = data.places?.[0]
    if (!place) return null
    const photoName = place.photos?.[0]?.name ?? null
    const photoUrl = photoName
      ? `https://places.googleapis.com/v1/${photoName}/media?key=${API_KEY}&maxWidthPx=1200`
      : null
    return {
      placeId: place.id ?? null,
      lat: place.location?.latitude ?? null,
      lng: place.location?.longitude ?? null,
      photoUrl,
    }
  } catch {
    return null
  }
}

async function main() {
  if (!API_KEY) {
    throw new Error('GOOGLE_PLACES_API_KEY must be set before running this script')
  }

  const raw = JSON.parse(await fs.readFile(DATA_PATH, 'utf-8')) as RawLocation[]
  console.log(`Processing ${raw.length} locations...\n`)
  let ok = 0, geo = 0, fail = 0

  for (let i = 0; i < raw.length; i++) {
    const loc = raw[i]
    process.stdout.write(`[${i + 1}/${raw.length}] ${loc.businessName} (${loc.city}, ${loc.state})... `)

    const result = await geocodeLocation(loc)
    if (result) geo++
    await sleep(DELAY_MS)

    try {
      const record = await prisma.retailLocation.upsert({
        where: { businessName_address: { businessName: loc.businessName, address: loc.address } },
        update: {
          city: loc.city, state: loc.state, zipCode: loc.zipCode,
          phone: loc.phone, website: loc.website,
          photoUrl: result?.photoUrl ?? loc.photoUrl,
          googlePlacesId: result?.placeId ?? null,
          latitude: result?.lat ?? null,
          longitude: result?.lng ?? null,
          isActive: true,
        },
        create: {
          businessName: loc.businessName, address: loc.address,
          city: loc.city, state: loc.state, zipCode: loc.zipCode,
          phone: loc.phone, website: loc.website,
          photoUrl: result?.photoUrl ?? loc.photoUrl,
          googlePlacesId: result?.placeId ?? null,
          latitude: result?.lat ?? null,
          longitude: result?.lng ?? null,
          isActive: true, sortOrder: 0,
        },
      })

      if (result?.photoUrl) {
        await prisma.locationPhoto.deleteMany({ where: { locationId: record.id } })
        await prisma.locationPhoto.create({
          data: { locationId: record.id, url: result.photoUrl, sortOrder: 0 },
        })
      }
      ok++
      console.log(result ? `✓ (geo+photo)` : `✓ (no geo)`)
    } catch (e: any) {
      fail++
      console.log(`✗ ${e.message?.slice(0, 60)}`)
    }
  }

  console.log(`\n=== Complete: ${ok} imported, ${geo} geocoded, ${fail} failed ===`)
  await prisma.$disconnect()
}

main().catch(async (e) => { console.error(e); await prisma.$disconnect(); process.exit(1) })
