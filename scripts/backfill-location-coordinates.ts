import 'dotenv/config';
import { PrismaClient } from '@prisma/client'

const prisma = new PrismaClient()

const delay = (ms: number) => new Promise((resolve) => setTimeout(resolve, ms))

const getApiKey = () =>
  process.env.GOOGLE_GEOCODING_API_KEY ||
  process.env.GOOGLE_PLACES_API_KEY ||
  process.env.NEXT_PUBLIC_GOOGLE_MAPS_API_KEY

async function geocodeLocation(address: string, apiKey: string) {
  const response = await fetch(
    `https://maps.googleapis.com/maps/api/geocode/json?address=${encodeURIComponent(address)}&key=${apiKey}`,
  )
  if (!response.ok) {
    throw new Error(`Geocoding failed with status ${response.status}`)
  }
  const data = await response.json()
  if (!Array.isArray(data.results) || data.results.length === 0) {
    throw new Error('No geocoding results found')
  }
  const { lat, lng } = data.results[0].geometry.location
  return { lat, lng }
}

async function main() {
  const apiKey = getApiKey()
  if (!apiKey) {
    throw new Error('Set GOOGLE_GEOCODING_API_KEY, GOOGLE_PLACES_API_KEY, or NEXT_PUBLIC_GOOGLE_MAPS_API_KEY before running.')
  }

  const pendingLocations = await prisma.retailLocation.findMany({
    where: { latitude: null, longitude: null, isActive: true },
    orderBy: [{ state: 'asc' }, { city: 'asc' }],
  })

  console.log(`Found ${pendingLocations.length} locations requiring coordinates.`)

  for (const location of pendingLocations) {
    const address = `${location.address}, ${location.city}, ${location.state} ${location.zipCode ?? ''}`.trim()
    try {
      const coords = await geocodeLocation(address, apiKey)
      await prisma.retailLocation.update({
        where: { id: location.id },
        data: { latitude: coords.lat, longitude: coords.lng },
      })
      console.log(`Updated ${location.businessName} (${location.city}, ${location.state}) → ${coords.lat}, ${coords.lng}`)
    } catch (error) {
      console.warn(`Failed to geocode ${location.businessName} (${address}):`, error instanceof Error ? error.message : error)
    }

    await delay(200)
  }

  console.log('Coordinate backfill complete.')
}

main()
  .catch((error) => {
    console.error(error)
    process.exit(1)
  })
  .finally(async () => {
    await prisma.$disconnect()
  })
