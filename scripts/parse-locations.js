const fs = require('fs');
const path = require('path');

const content = fs.readFileSync('/Users/jordanlang/Repos/josemadridsalsa/public/find-us-locally/find-us-locally.md', 'utf8');

const lines = content.split('\n').map(line => line.trim()).filter(line => line);

const locations = [];
let currentState = '';
let currentCity = '';

for (let i = 0; i < lines.length; i++) {
  const line = lines[i];

  // Check if it's a city/state line
  if (line.startsWith('**') && line.endsWith('**') && /^[^*]+, [A-Z]{2}$/.test(line.replace(/\*\*/g, ''))) {
    const cityState = line.replace(/\*\*/g, '');
    const parts = cityState.split(', ');
    if (parts.length === 2) {
      currentCity = parts[0].trim();
      currentState = parts[1].trim();
    }
  } else if (line.startsWith('**') && line.endsWith('**')) {
    // Business line
    let businessLine = line.replace(/\*\*/g, '');
    
    // Extract phone first
    const phoneRegex = /\(\d{3}\)\s*\d{3}[-.\s]\d{4}|\d{3}[-.\s]\d{3}[-.\s]\d{4}/g;
    let phone = null;
    const phoneMatch = businessLine.match(phoneRegex);
    if (phoneMatch) {
      phone = phoneMatch[0];
      businessLine = businessLine.replace(phoneRegex, '').trim();
    }
    
    // Extract website (markdown links)
    const websiteRegex = /\[.*?\]\(([^)]+)\)/g;
    let website = null;
    const websiteMatches = businessLine.match(websiteRegex);
    if (websiteMatches) {
      // Take the last link as website
      const lastLink = websiteMatches[websiteMatches.length - 1];
      website = lastLink.replace(/\[.*?\]\(([^)]+)\)/, '$1');
      businessLine = businessLine.replace(websiteRegex, '').trim();
    }
    
    // Clean up any leftover punctuation
    businessLine = businessLine.replace(/,\s*,/g, ',').replace(/^,|,$/g, '').trim();
    
    const parts = businessLine.split(/, /);
    if (parts.length >= 2) {
      const businessName = parts[0].trim();
      const address = parts.slice(1).join(', ').trim();

      locations.push({
        businessName,
        address,
        city: currentCity,
        state: currentState,
        zipCode: '',
        phone: phone || '',
        website: website || '',
        latitude: null,
        longitude: null,
        isActive: true,
      });
    }
  }
}

console.log(`Parsed ${locations.length} locations`);
console.log(JSON.stringify(locations.slice(0, 5), null, 2)); // Show first 5 for verification

// Export for use
export default locations;