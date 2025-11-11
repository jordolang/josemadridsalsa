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
console.log('  - reviewRating:', firstLocation.reviewRating);
console.log('  - reviewCount:', firstLocation.reviewCount);
console.log('  - reviewSummary:', firstLocation.reviewSummary);
console.log('  - googlePlaceId:', firstLocation.googlePlaceId);
console.log('  - website:', firstLocation.website);
console.log('  - hours:', firstLocation.hours);

// Count locations with review data
let withReviewRating = 0;
let withReviewCount = 0;
let withGooglePlaceId = 0;

data.forEach(loc => {
  if (loc.reviewRating) withReviewRating++;
  if (loc.reviewCount) withReviewCount++;
  if (loc.googlePlaceId) withGooglePlaceId++;
});

console.log('\n=== STATISTICS ===');
console.log(`Locations with reviewRating: ${withReviewRating}`);
console.log(`Locations with reviewCount: ${withReviewCount}`);
console.log(`Locations with googlePlaceId: ${withGooglePlaceId}`);
