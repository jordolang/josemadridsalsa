import { prisma } from '../lib/prisma'

async function verifyLocations() {
  console.log('🔍 Verifying locations in database...\n')

  const locations = await prisma.retailLocation.findMany({
    orderBy: [{ state: 'asc' }, { city: 'asc' }],
  })

  console.log(`Total locations: ${locations.length}`)

  if (locations.length !== 149) {
    console.warn(`⚠️  Expected 149 locations, found ${locations.length}`)
  }

  const missingPhotos = locations.filter((loc) => !loc.photoUrl)
  const missingCoordinates = locations.filter((loc) => !loc.latitude || !loc.longitude)
  const inactive = locations.filter((loc) => !loc.isActive)

  console.log(`\n📊 Statistics:`)
  console.log(`  - Missing photos: ${missingPhotos.length}`)
  console.log(`  - Missing coordinates: ${missingCoordinates.length}`)
  console.log(`  - Inactive locations: ${inactive.length}`)

  const byState = locations.reduce((acc, loc) => {
    acc[loc.state] = (acc[loc.state] || 0) + 1
    return acc
  }, {} as Record<string, number>)

  console.log(`\n📍 Locations by state:`)
  Object.entries(byState)
    .sort(([, a], [, b]) => b - a)
    .forEach(([state, count]) => {
      console.log(`  ${state}: ${count}`)
    })

  if (missingPhotos.length > 0) {
    console.log(`\n📸 Locations missing photos:`)
    missingPhotos.slice(0, 10).forEach((loc) => {
      console.log(`  - ${loc.businessName}, ${loc.city}, ${loc.state}`)
    })
    if (missingPhotos.length > 10) {
      console.log(`  ... and ${missingPhotos.length - 10} more`)
    }
  }

  console.log('\n✅ Verification complete!')
}

verifyLocations()
  .then(() => process.exit(0))
  .catch((error) => {
    console.error('Error:', error)
    process.exit(1)
  })
