import { PrismaClient } from '@prisma/client'

const prisma = new PrismaClient()

// All available photo files
const photoFiles = [
  'Edinburg-6792.jpg',
  'Farm-Table-3952.png',
  'IGA-2736.jpg',
  'IGA-331.png',
  'Inside-Out-5211.png',
  'Kuhn\'s-2284.png',
  'Kuhns\'s-2412.jpg',
  'Meijer-247.jpg',
  'Shopwise-704.jpg',
  'Stanley\'s-3302.jpg',
  'Winding-Road-117.jpg',
  'meijer-9200.jpg',
]

async function main() {
  console.log('🔍 Finding locations for all local photos...\n')

  const allLocations = await prisma.retailLocation.findMany({
    where: { isActive: true },
    orderBy: [{ businessName: 'asc' }],
  })

  for (const photoFile of photoFiles) {
    // Extract search terms from filename
    const namePart = photoFile.split('-')[0].toLowerCase().replace(/['s]/g, '')
    const numberPart = photoFile.split('-')[1]?.replace(/\.(jpg|png)$/i, '') || ''

    console.log(`\n📷 ${photoFile}`)
    console.log(`   Looking for: "${namePart}" with "${numberPart}" in address`)

    // Find matching location
    const match = allLocations.find(loc => {
      const businessMatch = loc.businessName.toLowerCase().includes(namePart)
      const addressMatch = numberPart ? loc.address.includes(numberPart) : false
      return businessMatch && (addressMatch || !numberPart)
    })

    if (match) {
      console.log(`   ✓ FOUND: ${match.businessName}`)
      console.log(`     Address: ${match.address}, ${match.city}, ${match.state}`)
      console.log(`     Current photo: ${match.photoUrl}`)
    } else {
      console.log(`   ✗ NO MATCH FOUND`)
    }
  }
}

main()
  .catch((e) => {
    console.error('Error:', e)
    process.exit(1)
  })
  .finally(async () => {
    await prisma.$disconnect()
  })
