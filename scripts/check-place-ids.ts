import { PrismaClient } from '@prisma/client'

const prisma = new PrismaClient()

async function checkPlaceIds() {
  const locations = await prisma.retailLocation.findMany({
    where: { isActive: true },
    select: {
      id: true,
      businessName: true,
      city: true,
      state: true,
      googlePlacesId: true,
      photoUrl: true,
    },
  })

  const total = locations.length
  const withPlaceId = locations.filter(l => l.googlePlacesId).length
  const withPhotoUrl = locations.filter(l => l.photoUrl).length

  console.log(`Total locations: ${total}`)
  console.log(`With Google Place ID: ${withPlaceId}`)
  console.log(`With photoUrl: ${withPhotoUrl}`)
  console.log(`Without Place ID or photoUrl: ${locations.filter(l => !l.googlePlacesId && !l.photoUrl).length}`)

  // Show a few examples
  console.log('\nFirst 5 locations:')
  locations.slice(0, 5).forEach(loc => {
    console.log(`- ${loc.businessName} (${loc.city}, ${loc.state}): PlaceID=${!!loc.googlePlacesId}, PhotoURL=${!!loc.photoUrl}`)
  })

  await prisma.$disconnect()
}

checkPlaceIds().catch(console.error)