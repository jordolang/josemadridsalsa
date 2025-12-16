#!/usr/bin/env node

const fs = require('fs');
const path = require('path');

// Read the locations data
const dataPath = path.join(__dirname, '../lib/locations/locations-data.json');
const data = JSON.parse(fs.readFileSync(dataPath, 'utf8'));

let cleanedCount = 0;

const cleanedData = data.map((location) => {
  let { address, website } = location;
  let needsCleaning = false;

  // Clean address artifacts
  const originalAddress = address;
  
  // Remove markdown artifacts
  address = address.replace(/\[([^\]]+)?\]\([^)]*\)/g, '').trim();
  address = address.replace(/\[\]/g, '').trim();
  address = address.replace(/\[/g, '').trim();
  address = address.replace(/\]/g, '').trim();
  address = address.replace(/\(\)/g, '').trim();
  address = address.replace(/\(/g, '').trim();
  address = address.replace(/\)/g, '').trim();
  
  // Remove extra commas and whitespace
  address = address.replace(/,\s*,/g, ',').replace(/,\s*$/g, '').replace(/^,\s*/g, '').trim();
  
  if (address !== originalAddress) {
    needsCleaning = true;
  }

  // Clean website duplicates
  if (website) {
    const originalWebsite = website;
    
    // Find first http/https URL
    const urlMatch = website.match(/https?:\/\/[^\s]+/g);
    if (urlMatch && urlMatch.length > 0) {
      // Take the first URL that's not a Google search or find-us-locally
      const validUrl = urlMatch.find(u => 
        !u.includes('google.com/search') && 
        !u.includes('josemadridsalsa.com/find-us-locally')
      );
      website = validUrl || urlMatch[0];
    }
    
    // Clean up trailing slashes and encoded spaces
    website = website.replace(/%20%20%20$/, '').replace(/\/$/, '');
    
    if (website !== originalWebsite) {
      needsCleaning = true;
    }
  }

  if (needsCleaning) {
    cleanedCount++;
    console.log(`\nCleaning: ${location.businessName}`);
    console.log(`  Old address: ${originalAddress}`);
    console.log(`  New address: ${address}`);
    if (location.website !== website) {
      console.log(`  Old website: ${location.website}`);
      console.log(`  New website: ${website}`);
    }
  }

  return {
    ...location,
    address,
    website,
  };
});

// Write the cleaned data back
fs.writeFileSync(dataPath, JSON.stringify(cleanedData, null, 2), 'utf8');

console.log(`\n✅ Cleaned ${cleanedCount} locations out of ${data.length} total`);
console.log(`📝 Updated ${dataPath}`);
