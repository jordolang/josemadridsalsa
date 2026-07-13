import { PrismaClient } from '@prisma/client'
import { Decimal } from '@prisma/client/runtime/library'
import {
  retailLocationsData,
  type RetailLocationSeedData,
} from '../../lib/data/retail-locations'

const prisma = new PrismaClient()

async function main() {
  console.log('🌶️  Seeding retail locations...\n')

  console.log(`📊 Processing ${retailLocationsData.length} locations`)

  // Count by state
  const stateCounts: Record<string, number> = {}
  retailLocationsData.forEach((loc) => {
    stateCounts[loc.state] = (stateCounts[loc.state] || 0) + 1
  })

  console.log('\n📍 Locations by state:')
  Object.entries(stateCounts)
    .sort((a, b) => b[1] - a[1])
    .forEach(([state, count]) => {
      console.log(`   ${state}: ${count}`)
    })

  console.log('\n💾 Upserting locations to database...')
  let created = 0
  let updated = 0
  let totalPhotos = 0

  for (const location of retailLocationsData) {
    // Convert latitude and longitude strings to Decimal
    const latitude = location.latitude ? new Decimal(location.latitude) : null
    const longitude = location.longitude
      ? new Decimal(location.longitude)
      : null

    // Upsert the location
    const result = await prisma.retailLocation.upsert({
      where: {
        businessName_address: {
          businessName: location.businessName,
          address: location.address,
        },
      },
      update: {
        city: location.city,
        state: location.state,
        zipCode: location.zipCode,
        phone: location.phone,
        website: location.website,
        photoUrl: location.photoUrl,
        googlePlacesId: location.googlePlacesId,
        latitude,
        longitude,
        county: location.county,
        isActive: location.isActive,
        updatedAt: new Date(),
      },
      create: {
        businessName: location.businessName,
        address: location.address,
        city: location.city,
        state: location.state,
        zipCode: location.zipCode,
        phone: location.phone,
        website: location.website,
        photoUrl: location.photoUrl,
        googlePlacesId: location.googlePlacesId,
        latitude,
        longitude,
        county: location.county,
        isActive: location.isActive,
        sortOrder: location.sortOrder,
      },
    })

    // Determine if created or updated (check if createdAt equals updatedAt)
    const justCreated =
      result.createdAt.getTime() === result.updatedAt.getTime()
    if (justCreated) {
      created++
    } else {
      updated++
    }

    // Handle photo gallery
    if (location.photoGallery && location.photoGallery.length > 0) {
      // Delete existing photos for this location (for re-seeding)
      await prisma.locationPhoto.deleteMany({
        where: { locationId: result.id },
      })

      // Create new photos
      for (let i = 0; i < location.photoGallery.length; i++) {
        await prisma.locationPhoto.create({
          data: {
            url: location.photoGallery[i],
            locationId: result.id,
            sortOrder: i,
            caption: null, // Can be added later
          },
        })
        totalPhotos++
      }
    }
  }

  console.log(`\n✨ Seeding complete!`)
  console.log(`   📍 Created: ${created} new locations`)
  console.log(`   🔄 Updated: ${updated} existing locations`)
  console.log(`   🖼️  Photos: ${totalPhotos} gallery photos`)
  console.log(`   📊 Total: ${retailLocationsData.length} locations in database\n`)
}

main()
  .catch((e) => {
    console.error('❌ Error seeding database:', e)
    process.exit(1)
  })
  .finally(async () => {
    await prisma.$disconnect()
  })
