#!/usr/bin/env node

const fs = require('fs');
const path = require('path');

// Read the locations data
const dataPath = path.join(__dirname, '../lib/locations/locations-data.json');
const data = JSON.parse(fs.readFileSync(dataPath, 'utf8'));

let cleanedCount = 0;

const cleanedData = data.map((location) => {
  let { website } = location;
  
  if (!website) {
    return location;
  }

  const originalWebsite = website;
  
  // Split on http or https to separate concatenated URLs
  const urlParts = website.split(/(https?:\/\/)/i);
  let extractedUrl = '';
  
  // Reconstruct the first complete URL
  for (let i = 0; i < urlParts.length; i++) {
    if (urlParts[i].toLowerCase().match(/^https?:\/\/$/)) {
      // Found a protocol, combine with next part
      if (i + 1 < urlParts.length) {
        extractedUrl = urlParts[i] + urlParts[i + 1];
        break;
      }
    }
  }
  
  if (extractedUrl) {
    // If it's not a Google search or our own find-us page, use it
    if (!extractedUrl.includes('google.com/search') && 
        !extractedUrl.includes('josemadridsalsa.com/find-us-locally')) {
      website = extractedUrl;
    } else if (urlParts.length > 3) {
      // Try the next URL in the concatenated string
      for (let i = 2; i < urlParts.length; i++) {
        if (urlParts[i].toLowerCase().match(/^https?:\/\/$/)) {
          if (i + 1 < urlParts.length) {
            const nextUrl = urlParts[i] + urlParts[i + 1];
            if (!nextUrl.includes('google.com/search') && 
                !nextUrl.includes('josemadridsalsa.com/find-us-locally')) {
              website = nextUrl;
              break;
            }
          }
        }
      }
    }
    
    // Clean up trailing slashes and encoded spaces
    website = website.replace(/%20%20%20$/, '').replace(/\/$/, '');
  }
  
  if (website !== originalWebsite) {
    cleanedCount++;
    console.log(`\nCleaning: ${location.businessName}`);
    console.log(`  Old website: ${originalWebsite}`);
    console.log(`  New website: ${website}`);
  }

  return {
    ...location,
    website,
  };
});

// Write the cleaned data back
fs.writeFileSync(dataPath, JSON.stringify(cleanedData, null, 2), 'utf8');

console.log(`\n✅ Cleaned ${cleanedCount} locations out of ${data.length} total`);
console.log(`📝 Updated ${dataPath}`);
