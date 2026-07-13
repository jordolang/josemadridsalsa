import { PrismaClient, RetailLocation } from '@prisma/client';
import pLimit from 'p-limit';
import * as fs from 'fs';
import {
  findPlaceByNameAddress,
  getBestPhotoUrlForPlace,
  getCompanyLogoFromWebsite,
} from '../lib/google-places';
import { getErrorMessage } from '@/lib/errors';

const prisma = new PrismaClient();

interface MissingPhoto {
  businessName: string;
  city: string;
  state: string;
  reason: string;
}

const missingPhotos: MissingPhoto[] = [];

// Parse command line flags
const args = process.argv.slice(2);
const forceRefetch = args.includes('--force');

async function fetchPhotoForLocation(location: RetailLocation) {
  const { id, businessName, address, city, state, website, photoUrl } = location;
  
  // Skip if already has photo and not forcing
  if (photoUrl && !forceRefetch) {
    console.log(`✓ ${businessName} - Already has photo`);
    return;
  }
  
  console.log(`\n🔍 Fetching photo for: ${businessName}, ${city}, ${state}`);
  
  try {
    // Step 1: Try Google Places API
    console.log('   Trying Google Places API...');
    const placeResult = await findPlaceByNameAddress({
      businessName,
      address,
      city,
      state,
    });
    
    if (placeResult && placeResult.place) {
      const photoUrl = getBestPhotoUrlForPlace(placeResult.place);
      
      if (photoUrl) {
        console.log('   ✓ Found Google Places photo!');
        await prisma.retailLocation.update({
          where: { id },
          data: {
            photoUrl,
            googlePlacesId: placeResult.place.id,
          },
        });
        return;
      } else {
        console.log('   ⚠ Place found but no photos available');
      }
    } else {
      console.log('   ⚠ No Google Places match found');
    }
    
    // Step 2: Try company logo from website
    if (website) {
      console.log('   Trying company logo...');
      const logoUrl = await getCompanyLogoFromWebsite(website);
      
      if (logoUrl) {
        console.log('   ✓ Found company logo!');
        await prisma.retailLocation.update({
          where: { id },
          data: { photoUrl: logoUrl },
        });
        return;
      } else {
        console.log('   ⚠ No logo found');
      }
    }
    
    // Step 3: Fallback to placeholder
    console.log('   → Using placeholder image');
    await prisma.retailLocation.update({
      where: { id },
      data: { photoUrl: '/images/store-placeholder.png' },
    });
    
    missingPhotos.push({
      businessName,
      city,
      state,
      reason: placeResult ? 'No photos in Google Places' : 'No Google Places match',
    });
    
  } catch (error: unknown) {
    console.error(`   ✗ Error processing ${businessName}:`, error);

    // Set placeholder on error
    await prisma.retailLocation.update({
      where: { id },
      data: { photoUrl: '/images/store-placeholder.png' },
    });

    missingPhotos.push({
      businessName,
      city,
      state,
      reason: `Error: ${getErrorMessage(error)}`,
    });
  }
}

async function main() {
  console.log('🌶️  Fetching photos for retail locations...\n');
  
  if (forceRefetch) {
    console.log('⚠️  Force mode: Re-fetching all photos\n');
  }
  
  // Fetch locations
  const locations = await prisma.retailLocation.findMany({
    where: {
      isActive: true,
      ...(forceRefetch ? {} : { photoUrl: null }),
    },
    orderBy: [
      { state: 'asc' },
      { city: 'asc' },
      { businessName: 'asc' },
    ],
  });
  
  console.log(`Found ${locations.length} locations to process\n`);
  
  if (locations.length === 0) {
    console.log('✨ All locations already have photos!');
    return;
  }
  
  // Process with concurrency limit
  const limit = pLimit(5); // 5 concurrent requests
  const tasks = locations.map(location =>
    limit(() => fetchPhotoForLocation(location))
  );
  
  await Promise.all(tasks);
  
  // Write report
  console.log('\n\n📝 Writing report...');
  
  if (missingPhotos.length > 0) {
    const reportPath = '/Users/jordanlang/Repos/josemadridsalsa/locations-missing-photos.txt';
    const reportContent = [
      'RETAIL LOCATIONS MISSING PHOTOS',
      '================================',
      `Generated: ${new Date().toISOString()}`,
      `Total missing: ${missingPhotos.length}`,
      '',
      ...missingPhotos.map(
        ({ businessName, city, state, reason }) =>
          `${businessName} — ${city}, ${state} — ${reason}`
      ),
    ].join('\n');
    
    fs.writeFileSync(reportPath, reportContent, 'utf-8');
    console.log(`   Report saved to: ${reportPath}`);
  }
  
  console.log('\n\n✨ Photo fetching complete!');
  console.log(`   Processed: ${locations.length} locations`);
  console.log(`   Missing photos: ${missingPhotos.length}`);
  console.log(`   Success rate: ${((locations.length - missingPhotos.length) / locations.length * 100).toFixed(1)}%`);
  
  if (missingPhotos.length > 0) {
    console.log('\n⚠️  Some locations are missing photos. See locations-missing-photos.txt for details.');
  }
}

main()
  .catch((e: unknown) => {
    console.error('❌ Error:', e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
