/**
 * Download one storefront photo per retail location, store it in Vercel Blob and save the
 * Blob URL on the location, so the Find Us pages show a real photo without calling Google.
 *
 *   npm run locations:cache-photos                    # dry run: fetch and save locally only
 *   npm run locations:cache-photos -- --apply         # upload to Blob and update the database
 *   npm run locations:cache-photos -- --force --apply # redo locations that already have one
 *   npm run locations:cache-photos -- --only <id,id>  # limit to some locations
 *   npm run locations:cache-photos -- --from-site https://www.josemadridsalsa.com --apply
 *       # read locations from the public API and leave the database alone; report.json then
 *       # holds each blobUrl and placeId for someone with database access to save
 *
 * This is a one-off backfill, not a runtime path: each location costs about three Google
 * requests (place details, photo, or the Street View fallback), once. Photos are written to
 * `--out` (default ./.location-photos) with a report.json so every one can be checked by eye
 * against the store's name and address before or after applying.
 *
 * Needs GOOGLE_PLACES_API_KEY, DATABASE_URL (not with --from-site) and, with --apply,
 * BLOB_READ_WRITE_TOKEN.
 */

import { mkdir, writeFile } from 'node:fs/promises'
import path from 'node:path'
import { put } from '@vercel/blob'
import { PrismaClient, type RetailLocation } from '@prisma/client'
import { isGooglePlacesUrl } from '../lib/utils/image'
import {
  addressesMatch,
  isBlobPhotoUrl,
  locationPhotoPathname,
  pickBestPlacePhoto,
  type PlacePhoto,
} from '../lib/locations/photo-cache'

const PLACES_API = 'https://places.googleapis.com/v1'
const STREET_VIEW_API = 'https://maps.googleapis.com/maps/api/streetview'
const PHOTO_WIDTH = 1200
const WEBP_QUALITY = 80

type Place = {
  id: string
  displayName?: { text?: string }
  formattedAddress?: string
  photos?: PlacePhoto[]
}

type LocationInput = Pick<
  RetailLocation,
  'id' | 'businessName' | 'address' | 'city' | 'state' | 'zipCode' | 'googlePlacesId' | 'photoUrl'
>

type ReportEntry = {
  id: string
  businessName: string
  address: string
  source: 'places' | 'street-view' | 'none'
  googleName?: string
  googleAddress?: string
  addressMatches?: boolean
  file?: string
  blobUrl?: string
  placeId?: string
  reason?: string
}

const args = process.argv.slice(2)
const apply = args.includes('--apply')
const force = args.includes('--force')
const argValue = (flag: string) => {
  const index = args.indexOf(flag)
  return index >= 0 ? args[index + 1] : undefined
}
const only = argValue('--only')?.split(',').map((id) => id.trim()).filter(Boolean)
const outDir = path.resolve(argValue('--out') ?? '.location-photos')
const fromSite = argValue('--from-site')

const apiKey = process.env.GOOGLE_PLACES_API_KEY || process.env.NEXT_PUBLIC_GOOGLE_MAPS_API_KEY
const prisma = fromSite ? null : new PrismaClient()

const fullAddress = (loc: LocationInput) =>
  `${loc.address}, ${loc.city}, ${loc.state}${loc.zipCode ? ` ${loc.zipCode}` : ''}`

async function getPlace(loc: LocationInput): Promise<Place | null> {
  const fieldMask = 'id,displayName,formattedAddress,photos'
  if (loc.googlePlacesId) {
    const res = await fetch(`${PLACES_API}/places/${loc.googlePlacesId}`, {
      headers: { 'X-Goog-Api-Key': apiKey!, 'X-Goog-FieldMask': fieldMask },
    })
    if (res.ok) return (await res.json()) as Place
  }

  // No stored Place ID, or it no longer resolves: search by name and address.
  const res = await fetch(`${PLACES_API}/places:searchText`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'X-Goog-Api-Key': apiKey!,
      'X-Goog-FieldMask': fieldMask.split(',').map((field) => `places.${field}`).join(','),
    },
    body: JSON.stringify({ textQuery: `${loc.businessName}, ${fullAddress(loc)}`, maxResultCount: 1 }),
  })
  if (!res.ok) throw new Error(`Places search failed: ${res.status} ${await res.text()}`)
  const data = (await res.json()) as { places?: Place[] }
  return data.places?.[0] ?? null
}

async function downloadPlacePhoto(photo: PlacePhoto): Promise<Buffer> {
  const res = await fetch(
    `${PLACES_API}/${photo.name}/media?maxWidthPx=${PHOTO_WIDTH}&skipHttpRedirect=true`,
    { headers: { 'X-Goog-Api-Key': apiKey! } },
  )
  if (!res.ok) throw new Error(`Photo lookup failed: ${res.status}`)
  const { photoUri } = (await res.json()) as { photoUri?: string }
  if (!photoUri) throw new Error('Photo lookup returned no URL')
  const image = await fetch(photoUri)
  if (!image.ok) throw new Error(`Photo download failed: ${image.status}`)
  return Buffer.from(await image.arrayBuffer())
}

async function downloadStreetView(loc: LocationInput): Promise<Buffer | null> {
  const location = encodeURIComponent(fullAddress(loc))
  // The metadata call is free and says whether there is imagery at the address.
  const meta = await fetch(`${STREET_VIEW_API}/metadata?location=${location}&source=outdoor&key=${apiKey}`)
  const metaData = (await meta.json()) as { status?: string }
  if (metaData.status !== 'OK') return null
  const res = await fetch(`${STREET_VIEW_API}?size=640x480&scale=2&location=${location}&source=outdoor&fov=80&key=${apiKey}`)
  if (!res.ok) return null
  return Buffer.from(await res.arrayBuffer())
}

async function toWebp(original: Buffer): Promise<Buffer> {
  const sharp = (await import('sharp')).default
  return sharp(original).rotate().resize({ width: PHOTO_WIDTH, withoutEnlargement: true }).webp({ quality: WEBP_QUALITY }).toBuffer()
}

async function saveToLocation(db: PrismaClient, loc: LocationInput, blobUrl: string, placeId: string | null) {
  await db.$transaction(async (tx) => {
    await tx.retailLocation.update({
      where: { id: loc.id },
      data: { photoUrl: blobUrl, ...(placeId ? { googlePlacesId: placeId } : {}) },
    })
    // The gallery still holds the old Places URLs, which the site hides; point them at the new photo.
    const gallery = await tx.locationPhoto.findMany({ where: { locationId: loc.id } })
    const stale = gallery.filter((photo) => isGooglePlacesUrl(photo.url))
    if (stale.length > 0) {
      await tx.locationPhoto.update({ where: { id: stale[0].id }, data: { url: blobUrl } })
    } else if (!gallery.some((photo) => photo.url === blobUrl)) {
      await tx.locationPhoto.create({ data: { locationId: loc.id, url: blobUrl, sortOrder: 0 } })
    }
  })
}

async function processLocation(loc: LocationInput): Promise<ReportEntry> {
  const entry: ReportEntry = { id: loc.id, businessName: loc.businessName, address: fullAddress(loc), source: 'none' }
  let image: Buffer | null = null
  let placeId: string | null = null

  const place = await getPlace(loc)
  if (place) {
    entry.googleName = place.displayName?.text
    entry.googleAddress = place.formattedAddress
    entry.addressMatches = addressesMatch(loc.address, place.formattedAddress)
    // Only trust the place, its ID and its photo, when it is the store we asked about.
    if (entry.addressMatches) {
      placeId = place.id
      const photo = pickBestPlacePhoto(place.photos)
      if (photo) {
        image = await downloadPlacePhoto(photo)
        entry.source = 'places'
      }
    }
  }

  if (!image) {
    image = await downloadStreetView(loc)
    if (image) entry.source = 'street-view'
  }

  if (!image) {
    entry.reason = place ? 'No matching Google photo and no Street View imagery' : 'No Google match and no Street View imagery'
    return entry
  }

  const webp = await toWebp(image)
  entry.file = path.join(outDir, `${loc.id}.webp`)
  await writeFile(entry.file, webp)

  if (apply) {
    const blob = await put(locationPhotoPathname(loc.id), webp, {
      access: 'public',
      contentType: 'image/webp',
      addRandomSuffix: false,
      allowOverwrite: true,
    })
    entry.blobUrl = blob.url
    entry.placeId = placeId ?? undefined
    if (prisma) await saveToLocation(prisma, loc, blob.url, placeId)
  }
  return entry
}

async function main() {
  if (!apiKey) throw new Error('GOOGLE_PLACES_API_KEY is not set')
  if (apply && !process.env.BLOB_READ_WRITE_TOKEN) throw new Error('BLOB_READ_WRITE_TOKEN is not set')
  await mkdir(outDir, { recursive: true })

  const locations = (await loadLocations()).filter((loc) => !only || only.includes(loc.id))
  const todo = locations.filter((loc) => force || !isBlobPhotoUrl(loc.photoUrl))
  console.log(`${todo.length} of ${locations.length} locations to process${apply ? '' : ' (dry run)'}`)

  const report: ReportEntry[] = []
  for (const [index, loc] of todo.entries()) {
    try {
      const entry = await processLocation(loc)
      report.push(entry)
      console.log(`[${index + 1}/${todo.length}] ${entry.source.padEnd(11)} ${loc.businessName}, ${loc.city} ${loc.state}${entry.reason ? ` — ${entry.reason}` : ''}`)
    } catch (error) {
      const reason = error instanceof Error ? error.message : String(error)
      report.push({ id: loc.id, businessName: loc.businessName, address: fullAddress(loc), source: 'none', reason })
      console.error(`[${index + 1}/${todo.length}] error       ${loc.businessName}, ${loc.city} ${loc.state} — ${reason}`)
    }
  }

  await writeFile(path.join(outDir, 'report.json'), JSON.stringify(report, null, 2))
  const count = (source: ReportEntry['source']) => report.filter((entry) => entry.source === source).length
  console.log(`\nPlaces: ${count('places')}  Street View: ${count('street-view')}  None: ${count('none')}`)
  console.log(`Photos and report.json are in ${outDir}`)
}

async function loadLocations(): Promise<LocationInput[]> {
  if (prisma) {
    return prisma.retailLocation.findMany({
      where: { isActive: true },
      orderBy: [{ state: 'asc' }, { city: 'asc' }, { businessName: 'asc' }],
    })
  }
  // The public locations API lists every active location; it exposes the Place ID as googlePlaceId.
  const res = await fetch(new URL('/api/locations', fromSite))
  if (!res.ok) throw new Error(`Locations API failed: ${res.status}`)
  const { data } = (await res.json()) as { data: Array<Omit<LocationInput, 'googlePlacesId'> & { googlePlaceId: string | null }> }
  return data.map(({ googlePlaceId, ...loc }) => ({ ...loc, googlePlacesId: googlePlaceId }))
}

main()
  .catch((error) => {
    console.error(error)
    process.exitCode = 1
  })
  .finally(() => prisma?.$disconnect())
