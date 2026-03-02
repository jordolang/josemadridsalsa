#!/usr/bin/env node

const fs = require('fs');
const path = require('path');

// Read the locations data
const dataPath = path.join(__dirname, '../lib/locations/locations-data.json');
const data = JSON.parse(fs.readFileSync(dataPath, 'utf8'));

let fixedCount = 0;

const cleanedData = data.map((location) => {
  // Add proper Meijer website
  if (location.businessName === 'Meijer' && !location.website) {
    console.log(`Adding Meijer website for ${location.city}, ${location.state}`);
    fixedCount++;
    return {
      ...location,
      website: 'https://www.meijer.com',
    };
  }

  return location;
});

// Write the cleaned data back
fs.writeFileSync(dataPath, JSON.stringify(cleanedData, null, 2), 'utf8');

console.log(`\n✅ Added Meijer website to ${fixedCount} locations out of ${data.length} total locations`);
console.log(`📝 Updated ${dataPath}`);
