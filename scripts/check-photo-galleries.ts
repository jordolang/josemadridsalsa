import { PrismaClient } from '@prisma/client'

const prisma = new PrismaClient()

async function checkPhotoGalleries() {
  const locations = await prisma.retailLocation.findMany({
    where: { isActive: true },
    select: {
      id: true,
      businessName: true,
      photoUrl: true,
      photos: {
        select: {
          url: true,
          sortOrder: true,
        },
        orderBy: {
          sortOrder: 'asc',
        },
      },
    },
    take: 5,
  })

  console.log('Photo galleries:')
  locations.forEach(loc => {
    console.log(`- ${loc.businessName}:`)
    console.log(`  photoUrl: ${loc.photoUrl}`)
    console.log(`  photos: ${loc.photos.length} items`)
    loc.photos.forEach((photo, i) => {
      console.log(`    ${i}: ${photo.url.substring(0, 80)}...`)
    })
    console.log()
  })

  await prisma.$disconnect()
}

checkPhotoGalleries().catch(console.error)