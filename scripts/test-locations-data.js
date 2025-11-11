#!/usr/bin/env node

const fs = require('fs');
const path = require('path');

// Read the locations data
const dataPath = path.join(__dirname, '../lib/locations/locations-data.json');
const data = JSON.parse(fs.readFileSync(dataPath, 'utf8'));

console.log('=== TESTING LOCATIONS DATA ===\n');
console.log(`Total locations: ${data.length}`);

// Check first location
const firstLocation = data[0];
console.log('\nFirst location:', firstLocation.businessName);
console.log('  - googlePlaceId:', firstLocation.googlePlaceId);
console.log('  - website:', firstLocation.website);
console.log('  - hours:', firstLocation.hours);

// Count locations with review data
let withGooglePlaceId = 0;

data.forEach(loc => {
  if (loc.googlePlaceId) withGooglePlaceId++;
});

console.log('\n=== STATISTICS ===');
console.log(`Locations with googlePlaceId: ${withGooglePlaceId}`);
