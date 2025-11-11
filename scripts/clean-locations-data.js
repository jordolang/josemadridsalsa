#!/usr/bin/env node

const fs = require('fs');
const path = require('path');

// Read the locations data
const dataPath = path.join(__dirname, '../lib/locations/locations-data.json');
const data = JSON.parse(fs.readFileSync(dataPath, 'utf8'));

// Regular expressions for extracting data
const phoneRegex = /(\(?\d{3}\)?[\s.-]?\d{3}[\s.-]?\d{4}|\d{3}-\d{3}-\d{4})/g;
const urlRegex = /(https?:\/\/[^\s,]+)/g;

let cleanedCount = 0;

const cleanedData = data.map((location) => {
  const { address } = location;
  
  // Skip if already clean (no phone or URL in address)
  if (!address.includes('http') && !address.match(phoneRegex)) {
    return location;
  }

  cleanedCount++;

  // Extract phone numbers
  const phoneMatches = address.match(phoneRegex);
  const extractedPhone = phoneMatches ? phoneMatches[0] : null;

  // Extract URLs
  const urlMatches = address.match(urlRegex);
  const extractedWebsite = urlMatches ? urlMatches[0].replace(/[\[\]()]/g, '') : null;

  // Clean the address - remove everything after the first comma that contains a phone or URL
  let cleanAddress = address;
  
  // Remove phone numbers
  cleanAddress = cleanAddress.replace(phoneRegex, '').trim();
  
  // Remove URLs
  cleanAddress = cleanAddress.replace(urlRegex, '').trim();
  
  // Remove markdown link syntax (including empty brackets and parens)
  cleanAddress = cleanAddress.replace(/\[([^\]]+)?\]\([^)]*\)/g, '').trim();
  cleanAddress = cleanAddress.replace(/\[\]/g, '').trim();
  cleanAddress = cleanAddress.replace(/\[/g, '').trim();
  cleanAddress = cleanAddress.replace(/\]/g, '').trim();
  cleanAddress = cleanAddress.replace(/\(\)/g, '').trim();
  
  // Remove extra commas and whitespace
  cleanAddress = cleanAddress.replace(/,\s*,/g, ',').replace(/,\s*$/g, '').replace(/^,\s*/g, '').trim();
  
  // Deduplicate website URLs (remove double URLs)
  let cleanedWebsite = extractedWebsite || location.website;
  if (cleanedWebsite) {
    // Check if URL appears twice
    const parts = cleanedWebsite.split(/(https?:\/\/[^\s]+)/g).filter(Boolean);
    const uniqueUrls = [...new Set(parts)];
    if (uniqueUrls.length === 1) {
      cleanedWebsite = uniqueUrls[0];
    } else {
      // Take the first valid-looking URL
      const validUrl = uniqueUrls.find(u => u.startsWith('http'));
      cleanedWebsite = validUrl || uniqueUrls[0];
    }
    // Clean up trailing slashes and encoded spaces
    cleanedWebsite = cleanedWebsite.replace(/%20%20%20$/, '').replace(/\/$/, '');
  }

  console.log(`\nCleaning: ${location.businessName}`);
  console.log(`  Old address: ${address}`);
  console.log(`  New address: ${cleanAddress}`);
  console.log(`  Phone: ${extractedPhone || location.phone || 'N/A'}`);
  console.log(`  Website: ${cleanedWebsite || 'N/A'}`);

  return {
    ...location,
    address: cleanAddress,
    phone: extractedPhone || location.phone,
    website: cleanedWebsite,
  };
});

// Write the cleaned data back
fs.writeFileSync(dataPath, JSON.stringify(cleanedData, null, 2), 'utf8');

console.log(`\n✅ Cleaned ${cleanedCount} locations out of ${data.length} total`);
console.log(`📝 Updated ${dataPath}`);
