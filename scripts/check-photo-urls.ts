import { PrismaClient } from '@prisma/client'

const prisma = new PrismaClient()

async function checkPhotoUrls() {
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
    take: 10,
  })

  console.log('Sample photo URLs:')
  locations.forEach(loc => {
    console.log(`- ${loc.businessName}: ${loc.photoUrl?.substring(0, 80)}...`)
    console.log(`  Google Places URL? ${loc.photoUrl?.includes('places.googleapis.com')}`)
    console.log(`  Legacy API? ${loc.photoUrl?.includes('maps.googleapis.com')}`)
    console.log(`  New API? ${loc.photoUrl?.includes('places.googleapis.com/v1/')}`)
  })

  await prisma.$disconnect()
}

checkPhotoUrls().catch(console.error)