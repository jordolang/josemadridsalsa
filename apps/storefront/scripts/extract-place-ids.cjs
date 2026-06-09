#!/usr/bin/env node

const fs = require('fs');
const path = require('path');

// Read the locations data
const dataPath = path.join(__dirname, '../lib/locations/locations-data.json');
const data = JSON.parse(fs.readFileSync(dataPath, 'utf8'));

let extractedCount = 0;

const cleanedData = data.map((location) => {
  // Skip if already has a googlePlaceId
  if (location.googlePlaceId) {
    return location;
  }

  // Try to extract Place ID from photoUrl
  if (location.photoUrl && location.photoUrl.includes('places.googleapis.com/v1/places/')) {
    const match = location.photoUrl.match(/places\/([^\/]+)\//);
    if (match && match[1]) {
      extractedCount++;
      console.log(`Extracted Place ID for ${location.businessName}: ${match[1]}`);
      return {
        ...location,
        googlePlaceId: match[1],
      };
    }
  }

  return location;
});

// Write the cleaned data back
fs.writeFileSync(dataPath, JSON.stringify(cleanedData, null, 2), 'utf8');

console.log(`\n✅ Extracted ${extractedCount} Place IDs out of ${data.length} total locations`);
console.log(`📝 Updated ${dataPath}`);
