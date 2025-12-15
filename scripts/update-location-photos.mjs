#!/usr/bin/env node

/**
 * Fetch photos for retail locations using Google Places API
 * and update locations-data.json
 *
 * Usage:
 *   node scripts/update-location-photos.mjs [--force]
 *
 * Requirements:
 *   - GOOGLE_PLACES_API_KEY or NEXT_PUBLIC_GOOGLE_MAPS_API_KEY in environment
 */

import 'dotenv/config';
import { readFile, writeFile } from 'fs/promises';
import { join } from 'path';

const API_KEY = process.env.GOOGLE_PLACES_API_KEY || process.env.NEXT_PUBLIC_GOOGLE_MAPS_API_KEY;
const PLACES_API_BASE = 'https://places.googleapis.com/v1';
const DATA_PATH = join(process.cwd(), 'lib', 'locations', 'locations-data.json');

// Check for --force flag
const forceRefetch = process.argv.includes('--force');

// Utilities
const delay = (ms) => new Promise(resolve => setTimeout(resolve, ms));

async function fetchWithRetry(url, options, retries = 3) {
  for (let i = 0; i < retries; i++) {
    try {
      const response = await fetch(url, options);
      
      if (response.ok) return response;
      
      if (response.status === 429 || response.status >= 500) {
        const backoff = Math.pow(2, i) * 1000;
        console.warn(`  ⚠ Rate limit/server error, retrying in ${backoff}ms...`);
        await delay(backoff);
        continue;
      }
      
      return response;
    } catch (error) {
      if (i === retries - 1) throw error;
      await delay(Math.pow(2, i) * 1000);
    }
  }
  throw new Error('Max retries exceeded');
}

function buildPlacesPhotoUrl(photoName, maxWidth = 1200) {
  return `${PLACES_API_BASE}/${photoName}/media?key=${API_KEY}&maxWidthPx=${maxWidth}`;
}

function getBestPhoto(place) {
  if (!place?.photos || place.photos.length === 0) return null;
  
  // Accept any photo, even if no dimensions specified
  const photos = place.photos
    .sort((a, b) => {
      // Prefer photos with dimensions
      const aHasDims = a.widthPx && a.heightPx;
      const bHasDims = b.widthPx && b.heightPx;
      
      if (aHasDims && !bHasDims) return -1;
      if (!aHasDims && bHasDims) return 1;
      
      if (aHasDims && bHasDims) {
        // Prefer horizontal/landscape orientation
        const aRatio = a.widthPx / a.heightPx;
        const bRatio = b.widthPx / b.heightPx;
        
        if (Math.abs(aRatio - bRatio) > 0.3) {
          return bRatio - aRatio;
        }
        
        // Then prefer larger images (up to 1200px)
        const aSize = Math.min(a.widthPx, 1200);
        const bSize = Math.min(b.widthPx, 1200);
        return bSize - aSize;
      }
      
      return 0;
    });
  
  const bestPhoto = photos[0];
  // Default to 800px if no width specified
  const maxWidth = bestPhoto.widthPx ? Math.min(bestPhoto.widthPx, 1200) : 800;
  
  return buildPlacesPhotoUrl(bestPhoto.name, maxWidth);
}

async function searchPlaceWithQuery(query, location) {
  try {
    const response = await fetchWithRetry(
      `${PLACES_API_BASE}/places:searchText`,
      {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'X-Goog-Api-Key': API_KEY,
          'X-Goog-FieldMask': 'places.id,places.displayName,places.formattedAddress,places.photos,places.types',
          'Referer': 'https://www.josemadrid.net',
          'Origin': 'https://www.josemadrid.net',
        },
        body: JSON.stringify({
          textQuery: query,
          locationBias: {
            circle: {
              center: {
                latitude: location.state === 'OH' ? 40.4173 : 40.0,
                longitude: location.state === 'OH' ? -82.9071 : -83.0,
              },
              radius: 50000, // 50km
            },
          },
        }),
      }
    );
    
    if (!response.ok) {
      return null;
    }
    
    const data = await response.json();
    return data.places && data.places.length > 0 ? data.places : null;
  } catch (error) {
    return null;
  }
}

async function searchPlace(location) {
  // Strategy 1: Full query with address
  let query = `${location.businessName} ${location.address} ${location.city} ${location.state}`.trim();
  let places = await searchPlaceWithQuery(query, location);
  if (places && places[0]?.photos?.length > 0) {
    console.log(`  → Strategy 1: Full match`);
    return places[0];
  }
  
  await delay(100);
  
  // Strategy 2: Business name + city + state (no address)
  query = `${location.businessName} ${location.city} ${location.state}`.trim();
  places = await searchPlaceWithQuery(query, location);
  if (places && places[0]?.photos?.length > 0) {
    console.log(`  → Strategy 2: Without address`);
    return places[0];
  }
  
  await delay(100);
  
  // Strategy 3: Try generic business type + location for chains/franchises
  const businessLower = location.businessName.toLowerCase();
  if (businessLower.includes('meijer') || businessLower.includes('kroger') || 
      businessLower.includes('walmart') || businessLower.includes('acme')) {
    const chain = businessLower.split(/[,\s]/)[0]; // Get first word
    query = `${chain} ${location.city} ${location.state}`.trim();
    places = await searchPlaceWithQuery(query, location);
    if (places && places[0]?.photos?.length > 0) {
      console.log(`  → Strategy 3: Chain/franchise`);
      return places[0];
    }
    await delay(100);
  }
  
  // Strategy 4: Accept first result even without photos (better than nothing)
  query = `${location.businessName} ${location.city} ${location.state}`.trim();
  places = await searchPlaceWithQuery(query, location);
  if (places && places.length > 0) {
    console.log(`  → Strategy 4: Accepting first result`);
    return places[0];
  }
  
  await delay(100);
  
  // Strategy 5: Just the city for generic grocery/market photos
  if (businessLower.includes('market') || businessLower.includes('grocery') || 
      businessLower.includes('food') || businessLower.includes('store')) {
    query = `grocery store ${location.city} ${location.state}`.trim();
    places = await searchPlaceWithQuery(query, location);
    if (places && places[0]?.photos?.length > 0) {
      console.log(`  → Strategy 5: Generic grocery store photo`);
      return places[0];
    }
  }
  
  return null;
}

async function main() {
  console.log('🌶️  Jose Madrid Salsa - Location Photo Fetcher\n');
  
  // Validate API key
  if (!API_KEY) {
    console.error('❌ Error: GOOGLE_PLACES_API_KEY not configured');
    console.error('   Set GOOGLE_PLACES_API_KEY or NEXT_PUBLIC_GOOGLE_MAPS_API_KEY environment variable\n');
    process.exit(1);
  }
  
  console.log('✓ API Key configured');
  
  if (forceRefetch) {
    console.log('⚠  Force mode: Re-fetching all photos\n');
  }
  
  // Load locations data
  console.log(`📖 Loading locations from ${DATA_PATH}...`);
  const locationsData = JSON.parse(await readFile(DATA_PATH, 'utf-8'));
  console.log(`   Found ${locationsData.length} locations\n`);
  
  // Filter locations that need photos
  const needsPhoto = forceRefetch 
    ? locationsData 
    : locationsData.filter(loc => !loc.photoUrl || loc.photoUrl === '/images/store-placeholder.png');
  
  if (needsPhoto.length === 0) {
    console.log('✨ All locations already have photos!\n');
    return;
  }
  
  console.log(`🔍 Fetching photos for ${needsPhoto.length} locations...\n`);
  
  let updated = 0;
  let notFound = 0;
  let errors = 0;
  
  for (let i = 0; i < needsPhoto.length; i++) {
    const location = needsPhoto[i];
    const progress = `[${i + 1}/${needsPhoto.length}]`;
    
    console.log(`${progress} ${location.businessName} - ${location.city}, ${location.state}`);
    
    try {
      const place = await searchPlace(location);
      
      if (place) {
        const photoUrl = getBestPhoto(place);
        
        if (photoUrl) {
          // Update the location in the array
          const idx = locationsData.findIndex(l => l.id === location.id);
          if (idx !== -1) {
            locationsData[idx].photoUrl = photoUrl;
            updated++;
            console.log(`  ✓ Photo found and updated`);
          }
        } else {
          notFound++;
          console.log(`  ⚠ Place found but no photos available`);
        }
      } else {
        notFound++;
        console.log(`  ⚠ No Google Places match found`);
      }
      
      // Rate limiting - be respectful to the API
      await delay(150);
      
    } catch (error) {
      errors++;
      console.error(`  ✗ Error: ${error.message}`);
    }
  }
  
  // Save updated data
  console.log(`\n💾 Saving updated locations...`);
  await writeFile(DATA_PATH, JSON.stringify(locationsData, null, 2), 'utf-8');
  
  // Print summary
  console.log('\n' + '='.repeat(50));
  console.log('📊 Summary');
  console.log('='.repeat(50));
  console.log(`Total locations:    ${locationsData.length}`);
  console.log(`Processed:          ${needsPhoto.length}`);
  console.log(`Photos updated:     ${updated}`);
  console.log(`Not found:          ${notFound}`);
  console.log(`Errors:             ${errors}`);
  console.log(`Success rate:       ${(updated / needsPhoto.length * 100).toFixed(1)}%`);
  console.log('='.repeat(50));
  
  console.log('\n✨ Done!\n');
}

main().catch(error => {
  console.error('\n❌ Fatal error:', error);
  process.exit(1);
});
