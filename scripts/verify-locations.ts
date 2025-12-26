import { prisma } from '../lib/prisma'

async function verifyLocations() {
  console.log('Verifying retail locations...\n')

  try {
    const totalLocations = await prisma.retailLocation.count()
    const activeLocations = await prisma.retailLocation.count({
      where: { isActive: true },
    })

    console.log(`Total locations in database: ${totalLocations}`)
    console.log(`Active locations: ${activeLocations}`)
    console.log(`Inactive locations: ${totalLocations - activeLocations}\n`)

    const expectedCount = 149
    
    if (totalLocations === expectedCount) {
      console.log(`✅ SUCCESS: Database has exactly ${expectedCount} locations as expected!`)
    } else if (totalLocations < expectedCount) {
      console.log(`⚠️  WARNING: Expected ${expectedCount} locations but found only ${totalLocations}`)
      console.log(`Missing ${expectedCount - totalLocations} locations`)
      console.log('\nTo import locations, run: npm run locations:import')
    } else {
      console.log(`ℹ️  INFO: Database has ${totalLocations} locations (${totalLocations - expectedCount} more than expected)`)
    }

    await prisma.$disconnect()
    process.exit(totalLocations === expectedCount ? 0 : 1)
  } catch (error) {
    console.error('Error verifying locations:', error)
    await prisma.$disconnect()
    process.exit(1)
  }
}

verifyLocations()
