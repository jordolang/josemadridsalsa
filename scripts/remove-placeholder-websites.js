#!/usr/bin/env node

const fs = require('fs');
const path = require('path');

// Read the locations data
const dataPath = path.join(__dirname, '../lib/locations/locations-data.json');
const data = JSON.parse(fs.readFileSync(dataPath, 'utf8'));

let removedCount = 0;

const cleanedData = data.map((location) => {
  // Remove placeholder websites
  if (location.website && location.website.includes('josemadridsalsa.com/find-us-locally')) {
    console.log(`Removing placeholder website from ${location.businessName}`);
    removedCount++;
    return {
      ...location,
      website: null,
    };
  }

  return location;
});

// Write the cleaned data back
fs.writeFileSync(dataPath, JSON.stringify(cleanedData, null, 2), 'utf8');

console.log(`\n✅ Removed ${removedCount} placeholder websites out of ${data.length} total locations`);
console.log(`📝 Updated ${dataPath}`);
