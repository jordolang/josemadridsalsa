import { PrismaClient, Prisma } from '@prisma/client'

const prisma = new PrismaClient()

// Manual mappings of photo files to location criteria
const photoMappings = [
  {
    file: 'Edinburg-6792.jpg',
    businessName: 'Edinburg Corner Store',
    addressContains: '6792',
  },
  {
    file: 'Farm-Table-3952.png',
    businessName: 'The Farm Table',
    addressContains: '3952',
  },
  {
    file: 'IGA-2736.jpg',
    businessName: 'Rideouts IGA',
    addressContains: '2736',
  },
  {
    file: 'IGA-331.png',
    businessName: 'Oberlin IGA',
    addressContains: '331',
  },
  {
    file: 'Inside-Out-5211.png',
    businessName: 'Oakland Inside & Out',
    addressContains: '5211',
  },
  {
    file: 'Kuhn\'s-2284.png',
    businessName: 'Kuhn\'s',
    addressContains: '2284',
  },
  {
    file: 'Kuhns\'s-2412.jpg',
    businessName: 'Kuhn\'s',
    addressContains: '2412',
  },
  {
    file: 'Meijer-247.jpg',
    businessName: 'Meijer',
    city: 'Kent',
    addressContains: '247',
  },
  {
    file: 'Shopwise-704.jpg',
    businessName: 'Shopwise/Warsaw Main Mart',
    addressContains: '704',
  },
  {
    file: 'Stanley\'s-3302.jpg',
    businessName: 'Stanley Market',
    addressContains: '3302',
  },
  {
    file: 'Winding-Road-117.jpg',
    businessName: 'Winding Road Marketplace',
    addressContains: '117',
  },
  {
    file: 'meijer-9200.jpg',
    businessName: 'Meijer',
    city: 'Engelwood',
    addressContains: '9200',
  },
]

async function main() {
  console.log('🖼️  Updating all locations with local photos...\n')

  let updated = 0
  let skipped = 0

  for (const mapping of photoMappings) {
    // Build where clause
    const where: Prisma.RetailLocationWhereInput = {
      isActive: true,
      businessName: mapping.businessName,
      ...(mapping.city && { city: mapping.city }),
      ...(mapping.addressContains && {
        address: {
          contains: mapping.addressContains,
        },
      }),
    }

    const location = await prisma.retailLocation.findFirst({ where })

    if (location) {
      const newPhotoUrl = `/find-us-locally/${mapping.file}`

      // Check if it's already using this photo
      if (location.photoUrl === newPhotoUrl) {
        console.log(`⊘ ${location.businessName} (${location.city})`)
        console.log(`  Already has: ${mapping.file}\n`)
        skipped++
        continue
      }

      console.log(`✓ ${location.businessName} (${location.city}, ${location.state})`)
      console.log(`  Old: ${location.photoUrl}`)
      console.log(`  New: /find-us-locally/${mapping.file}\n`)

      await prisma.retailLocation.update({
        where: { id: location.id },
        data: { photoUrl: newPhotoUrl },
      })

      updated++
    } else {
      console.log(`✗ NOT FOUND: ${mapping.businessName}`)
      console.log(`  Photo: ${mapping.file}\n`)
    }
  }

  console.log(`\n✨ Updated: ${updated} locations`)
  console.log(`⊘  Skipped: ${skipped} (already had local photo)`)
}

main()
  .catch((e: unknown) => {
    console.error('❌ Error:', e)
    process.exit(1)
  })
  .finally(async () => {
    await prisma.$disconnect()
  })
