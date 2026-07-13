import { PrismaClient } from '@prisma/client'

const prisma = new PrismaClient()

async function main() {
  const locations = await prisma.retailLocation.findMany({
    where: { isActive: true },
    select: {
      businessName: true,
      photoUrl: true,
      googlePlacesId: true,
      _count: {
        select: {
          photos: true,
        },
      },
    },
    take: 10,
  })

  console.log('\n📸 First 10 locations photo status:\n')
  locations.forEach((loc, i) => {
    console.log(`${i + 1}. ${loc.businessName}`)
    console.log(`   photoUrl: ${loc.photoUrl ? 'YES ✓' : 'NO ✗'}`)
    console.log(`   googlePlacesId: ${loc.googlePlacesId ? 'YES ✓' : 'NO ✗'}`)
    console.log(`   photo count: ${loc._count.photos}`)
    console.log('')
  })

  const stats = await prisma.retailLocation.aggregate({
    where: { isActive: true },
    _count: {
      photoUrl: true,
      googlePlacesId: true,
    },
  })

  const total = await prisma.retailLocation.count({
    where: { isActive: true },
  })

  console.log('📊 Overall stats:')
  console.log(`   Total active locations: ${total}`)
  console.log(`   With photoUrl: ${stats._count.photoUrl}`)
  console.log(`   With googlePlacesId: ${stats._count.googlePlacesId}`)
}

main()
  .catch(console.error)
  .finally(() => prisma.$disconnect())
