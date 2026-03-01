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

// Known brand photo URLs for major retailers
const BRAND_PHOTOS: Record<string, string> = {
  'kroger': 'https://upload.wikimedia.org/wikipedia/commons/thumb/9/93/Kroger_store_%281%29.jpg/640px-Kroger_store_%281%29.jpg',
  'walmart': 'https://upload.wikimedia.org/wikipedia/commons/thumb/0/0f/Walmart_store_exterior_5266815680.jpg/640px-Walmart_store_exterior_5266815680.jpg',
  'meijer': 'https://upload.wikimedia.org/wikipedia/commons/thumb/9/9d/Meijer_Exterior.jpg/640px-Meijer_Exterior.jpg',
  'giant eagle': 'https://upload.wikimedia.org/wikipedia/commons/thumb/6/64/Giant_Eagle_Retail_Store.jpg/640px-Giant_Eagle_Retail_Store.jpg',
  'aldi': 'https://upload.wikimedia.org/wikipedia/commons/thumb/2/24/ALDISupermarketinAustralia.jpg/640px-ALDISupermarketinAustralia.jpg',
  'whole foods': 'https://upload.wikimedia.org/wikipedia/commons/thumb/c/c5/Whole_Foods_Market_-_Fremont%2C_Seattle.jpg/640px-Whole_Foods_Market_-_Fremont%2C_Seattle.jpg',
  'target': 'https://upload.wikimedia.org/wikipedia/commons/thumb/a/a6/Target_Corporation_Logo.svg/640px-Target_Corporation_Logo.svg.png',
  'costco': 'https://upload.wikimedia.org/wikipedia/commons/thumb/5/59/Costco_Wholesale_logo_2010-10-26.svg/640px-Costco_Wholesale_logo_2010-10-26.svg.png',
  'fresh thyme': 'https://upload.wikimedia.org/wikipedia/commons/thumb/7/7e/Fresh_Thyme_Market_Exterior.jpg/640px-Fresh_Thyme_Market_Exterior.jpg',
  'trader joe': 'https://upload.wikimedia.org/wikipedia/commons/thumb/b/b0/Trader_Joe%27s_2.jpg/640px-Trader_Joe%27s_2.jpg',
  'earth fare': 'https://upload.wikimedia.org/wikipedia/commons/thumb/9/96/Earth_Fare_Logo.svg/320px-Earth_Fare_Logo.svg.png',
  'sprouts': 'https://upload.wikimedia.org/wikipedia/commons/thumb/7/76/Sprouts-Farmers-Market.jpg/640px-Sprouts-Farmers-Market.jpg',
  'publix': 'https://upload.wikimedia.org/wikipedia/commons/thumb/f/f1/Publix_store_number_1.jpg/640px-Publix_store_number_1.jpg',
  'wegmans': 'https://upload.wikimedia.org/wikipedia/commons/thumb/6/62/Wegmans_Food_Markets%2C_College_Avenue%2C_State_College%2C_Pennsylvania_%2814456960750%29.jpg/640px-Wegmans_Food_Markets%2C_College_Avenue%2C_State_College%2C_Pennsylvania_%2814456960750%29.jpg',
  'harris teeter': 'https://upload.wikimedia.org/wikipedia/commons/thumb/9/9e/Harris_Teeter_Supermarkets.svg/320px-Harris_Teeter_Supermarkets.svg.png',
  'food lion': 'https://upload.wikimedia.org/wikipedia/commons/thumb/2/20/Food_Lion_2013.svg/320px-Food_Lion_2013.svg.png',
  'safeway': 'https://upload.wikimedia.org/wikipedia/commons/thumb/5/5e/Safeway.svg/320px-Safeway.svg.png',
  'heb': 'https://upload.wikimedia.org/wikipedia/commons/thumb/1/18/HEB_Logo.svg/320px-HEB_Logo.svg.png',
  'stop & shop': 'https://upload.wikimedia.org/wikipedia/commons/thumb/8/8e/Stop_and_Shop_logo.svg/320px-Stop_and_Shop_logo.svg.png',
  'hannaford': 'https://upload.wikimedia.org/wikipedia/commons/thumb/0/04/Hannaford_Brothers_Co._Logo.svg/320px-Hannaford_Brothers_Co._Logo.svg.png',
  'martin\'s': 'https://upload.wikimedia.org/wikipedia/commons/thumb/9/93/Kroger_store_%281%29.jpg/640px-Kroger_store_%281%29.jpg',
  'food city': 'https://upload.wikimedia.org/wikipedia/commons/thumb/c/c5/Whole_Foods_Market_-_Fremont%2C_Seattle.jpg/640px-Whole_Foods_Market_-_Fremont%2C_Seattle.jpg',
  'jewel-osco': 'https://upload.wikimedia.org/wikipedia/commons/thumb/0/0f/Walmart_store_exterior_5266815680.jpg/640px-Walmart_store_exterior_5266815680.jpg',
  'market basket': 'https://upload.wikimedia.org/wikipedia/commons/thumb/b/b0/Trader_Joe%27s_2.jpg/640px-Trader_Joe%27s_2.jpg',
  'dillons': 'https://upload.wikimedia.org/wikipedia/commons/thumb/9/93/Kroger_store_%281%29.jpg/640px-Kroger_store_%281%29.jpg',
  'pick n save': 'https://upload.wikimedia.org/wikipedia/commons/thumb/9/93/Kroger_store_%281%29.jpg/640px-Kroger_store_%281%29.jpg',
  'bakers': 'https://upload.wikimedia.org/wikipedia/commons/thumb/9/93/Kroger_store_%281%29.jpg/640px-Kroger_store_%281%29.jpg',
  'mariano\'s': 'https://upload.wikimedia.org/wikipedia/commons/thumb/9/93/Kroger_store_%281%29.jpg/640px-Kroger_store_%281%29.jpg',
  'king soopers': 'https://upload.wikimedia.org/wikipedia/commons/thumb/9/93/Kroger_store_%281%29.jpg/640px-Kroger_store_%281%29.jpg',
  'fry\'s': 'https://upload.wikimedia.org/wikipedia/commons/thumb/9/93/Kroger_store_%281%29.jpg/640px-Kroger_store_%281%29.jpg',
  'ralphs': 'https://upload.wikimedia.org/wikipedia/commons/thumb/9/93/Kroger_store_%281%29.jpg/640px-Kroger_store_%281%29.jpg',
  'smith\'s': 'https://upload.wikimedia.org/wikipedia/commons/thumb/9/93/Kroger_store_%281%29.jpg/640px-Kroger_store_%281%29.jpg',
  'pay less': 'https://upload.wikimedia.org/wikipedia/commons/thumb/9/93/Kroger_store_%281%29.jpg/640px-Kroger_store_%281%29.jpg',
  'city market': 'https://upload.wikimedia.org/wikipedia/commons/thumb/9/93/Kroger_store_%281%29.jpg/640px-Kroger_store_%281%29.jpg',
}

function getBrandPhoto(businessName: string): string | null {
  const name = businessName.toLowerCase()
  for (const [brand, url] of Object.entries(BRAND_PHOTOS)) {
    if (name.includes(brand)) return url
  }
  return null
}

async function getOgImage(website: string): Promise<string | null> {
  try {
    const url = website.startsWith('http') ? website : `https://${website}`
    const res = await fetch(url, {
      headers: { 'User-Agent': 'Mozilla/5.0 (compatible; bot/1.0)' },
      signal: AbortSignal.timeout(8000),
      redirect: 'follow',
    })
    if (!res.ok) return null
    const html = await res.text()
    const ogMatch = html.match(/<meta[^>]+property=["']og:image["'][^>]+content=["']([^"']+)["']/i)
      || html.match(/<meta[^>]+content=["']([^"']+)["'][^>]+property=["']og:image["']/i)
    if (ogMatch?.[1]) {
      const imgUrl = ogMatch[1].startsWith('http') ? ogMatch[1] : new URL(ogMatch[1], url).href
      return imgUrl
    }
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
  const photosOnly = body.photosOnly === true
  const batchStart = typeof body.start === 'number' ? body.start : 0
  const batchSize = typeof body.size === 'number' ? body.size : 20

  let allLocations: RawLocation[]
  try { allLocations = await loadLocations() } catch (e: any) {
    return NextResponse.json({ error: e.message }, { status: 500 })
  }

  const batch = allLocations.slice(batchStart, batchStart + batchSize)
  let geocoded = 0, photosFound = 0, imported = 0, failed = 0

  for (const loc of batch) {
    let lat: number|null = null, lng: number|null = null, photoUrl: string|null = null

    if (!photosOnly && !skipGeo) {
      const existing = await prisma.retailLocation.findUnique({
        where: { businessName_address: { businessName: loc.businessName, address: loc.address } },
        select: { latitude: true }
      })
      if (!existing?.latitude || force) {
        const geo = await geocodeNominatim(loc)
        if (geo) { lat = geo.lat; lng = geo.lng; geocoded++ }
        await sleep(1100)
      }
    }

    // Get photo: brand lookup first (instant), then og:image from website
    const existing2 = await prisma.retailLocation.findUnique({
      where: { businessName_address: { businessName: loc.businessName, address: loc.address } },
      select: { id: true, photoUrl: true, latitude: true, longitude: true }
    })

    if (!existing2?.photoUrl || force) {
      photoUrl = getBrandPhoto(loc.businessName)
      if (!photoUrl && loc.website) {
        photoUrl = await getOgImage(loc.website)
        await sleep(500)
      }
      if (photoUrl) photosFound++
    }

    try {
      await prisma.retailLocation.upsert({
        where: { businessName_address: { businessName: loc.businessName, address: loc.address } },
        update: {
          city: loc.city, state: loc.state,
          zipCode: loc.zipCode ?? null, phone: loc.phone ?? null, website: loc.website ?? null,
          isActive: true,
          ...(photoUrl ? { photoUrl } : {}),
          ...(lat != null ? { latitude: lat, longitude: lng } : (existing2?.latitude ? { latitude: existing2.latitude, longitude: existing2.longitude } : {})),
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

      if (photoUrl) {
        const rec = await prisma.retailLocation.findUnique({
          where: { businessName_address: { businessName: loc.businessName, address: loc.address } },
          select: { id: true }
        })
        if (rec) {
          await prisma.locationPhoto.deleteMany({ where: { locationId: rec.id } })
          await prisma.locationPhoto.create({ data: { locationId: rec.id, url: photoUrl, sortOrder: 0 } })
        }
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
