import { PrismaClient } from '@prisma/client'
import * as fs from 'fs'
import * as path from 'path'

const prisma = new PrismaClient()

// Map of photo files to their patterns
const photoMappings = [
  { file: 'Edinburg-6792.jpg', pattern: /edinburg.*6792/i },
  { file: 'Farm-Table-3952.png', pattern: /farm table.*3952/i },
  { file: 'IGA-2736.jpg', pattern: /iga.*2736/i },
  { file: 'IGA-331.png', pattern: /iga.*331/i },
  { file: 'Inside-Out-5211.png', pattern: /(inside|out|oakland).*5211/i },
  { file: 'Kuhn\'s-2284.png', pattern: /kuhn.*2284/i },
  { file: 'Kuhns\'s-2412.jpg', pattern: /kuhn.*2412/i },
  { file: 'Meijer-247.jpg', pattern: /meijer.*247/i },
  { file: 'Shopwise-704.jpg', pattern: /(shopwise|warsaw).*704/i },
  { file: 'Stanley\'s-3302.jpg', pattern: /stanley.*3302/i },
  { file: 'Winding-Road-117.jpg', pattern: /winding.*117/i },
  { file: 'meijer-9200.jpg', pattern: /meijer.*9200/i },
]

async function main() {
  console.log('🖼️  Updating locations with local photos...\n')

  // Get all locations with placeholder photos
  const locations = await prisma.retailLocation.findMany({
    where: {
      isActive: true,
      photoUrl: '/images/store-placeholder.png',
    },
    orderBy: [{ state: 'asc' }, { city: 'asc' }, { businessName: 'asc' }],
  })

  console.log(`Found ${locations.length} locations with placeholder photos\n`)

  let updated = 0

  for (const loc of locations) {
    const searchString = `${loc.businessName} ${loc.address}`.toLowerCase()

    // Find matching photo
    const match = photoMappings.find(mapping => {
      const pattern = mapping.pattern
      return pattern.test(searchString)
    })

    if (match) {
      const photoPath = `/find-us-locally/${match.file}`

      console.log(`✓ ${loc.businessName} (${loc.city}, ${loc.state})`)
      console.log(`  Address: ${loc.address}`)
      console.log(`  Photo: ${match.file}\n`)

      await prisma.retailLocation.update({
        where: { id: loc.id },
        data: { photoUrl: photoPath },
      })

      updated++
    }
  }

  console.log(`\n✨ Updated ${updated} locations with local photos!`)
}

main()
  .catch((e) => {
    console.error('❌ Error:', e)
    process.exit(1)
  })
  .finally(async () => {
    await prisma.$disconnect()
  })
