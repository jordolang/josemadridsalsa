import { PrismaClient } from '@prisma/client'

const prisma = new PrismaClient()

async function main() {
  const locations = await prisma.retailLocation.findMany({
    where: {
      isActive: true,
      photoUrl: '/images/store-placeholder.png',
    },
    orderBy: [{ businessName: 'asc' }],
  })

  console.log('Locations with placeholder photos:\n')
  locations.forEach(loc => {
    console.log(`${loc.businessName}`)
    console.log(`  Address: ${loc.address}`)
    console.log(`  City: ${loc.city}, ${loc.state}`)
    console.log('')
  })
}

main()
  .catch((e) => {
    console.error('Error:', e)
    process.exit(1)
  })
  .finally(async () => {
    await prisma.$disconnect()
  })
