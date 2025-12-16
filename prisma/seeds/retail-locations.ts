import { PrismaClient } from '@prisma/client';
import * as cheerio from 'cheerio';
import * as fs from 'fs';
import * as https from 'https';

const prisma = new PrismaClient();

interface LocationData {
  businessName: string;
  address: string;
  city: string;
  state: string;
  zipCode: string | null;
  phone: string | null;
  website: string | null;
}

// Fetch HTML from URL
function fetchHtml(url: string): Promise<string> {
  return new Promise((resolve, reject) => {
    https.get(url, (res) => {
      let data = '';
      res.on('data', (chunk) => data += chunk);
      res.on('end', () => resolve(data));
    }).on('error', reject);
  });
}

// Normalize phone numbers
function normalizePhone(phone: string): string {
  // Remove common formatting and keep digits and basic separators
  return phone.replace(/\s+/g, ' ').trim();
}

// Normalize website URLs
function normalizeWebsite(url: string): string {
  url = url.trim();
  if (!url) return '';
  // Remove trailing # or fragments
  url = url.replace(/#.*$/, '');
  // Ensure https
  if (url.startsWith('http://')) {
    url = url.replace('http://', 'https://');
  } else if (!url.startsWith('https://')) {
    url = 'https://' + url;
  }
  return url;
}

// Extract zip code from address
function extractZipAndAddress(address: string): { address: string, zipCode: string | null } {
  const zipMatch = address.match(/\b(\d{5}(?:-\d{4})?)\b/);
  if (zipMatch) {
    return {
      address: address.replace(zipMatch[0], '').trim().replace(/,\s*$/, ''),
      zipCode: zipMatch[1]
    };
  }
  return { address: address.trim(), zipCode: null };
}

// Parse locations from HTML
function parseLocations(html: string): LocationData[] {
  const $ = cheerio.load(html);
  const locations: LocationData[] = [];
  let currentCity = '';
  let currentState = '';

  // Find all paragraphs
  $('p').each((_, elem) => {
    const text = $(elem).text().trim();
    const strongText = $(elem).find('strong').text().trim();
    
    // Skip empty paragraphs
    if (!text || text === '&nbsp;' || !strongText) return;
    
    // Check if this is a city/state header (e.g., "Zanesville, OH")
    const cityStateMatch = strongText.match(/^([^,]+),\s*([A-Z]{2})$/);
    if (cityStateMatch && !strongText.includes('Street') && !strongText.includes('Road') && !strongText.includes('Ave')) {
      currentCity = cityStateMatch[1].trim();
      currentState = cityStateMatch[2].trim();
      return;
    }
    
    // Check if this is a business entry
    if (currentCity && currentState && strongText.includes(',')) {
      // Parse business data
      const parts = strongText.split(',').map(p => p.trim());
      
      if (parts.length < 2) return; // Need at least name and address
      
      const businessName = parts[0];
      let address = parts[1];
      let phone: string | null = null;
      let website: string | null = null;
      
      // Extract phone from remaining parts
      for (let i = 2; i < parts.length; i++) {
        const part = parts[i];
        // Check if it looks like a phone number
        if (/[\d\(\)-]/.test(part) && part.length >= 7) {
          phone = normalizePhone(part);
          break;
        }
      }
      
      // Extract website from href
      const link = $(elem).find('a[href]').last();
      if (link.length) {
        const href = link.attr('href');
        if (href && !href.includes('google.com/search') && !href.startsWith('tel:')) {
          website = normalizeWebsite(href);
        }
      }
      
      // Extract zip from address
      const { address: cleanAddress, zipCode } = extractZipAndAddress(address);
      
      locations.push({
        businessName,
        address: cleanAddress,
        city: currentCity,
        state: currentState,
        zipCode,
        phone,
        website
      });
    }
  });
  
  return locations;
}

async function main() {
  console.log('🌶️  Seeding retail locations...\n');
  
  // Try to read from local file first
  let html: string;
  const localFile = '/tmp/store_locations.html';
  
  if (fs.existsSync(localFile)) {
    console.log('📄 Reading from local file:', localFile);
    html = fs.readFileSync(localFile, 'utf-8');
  } else {
    console.log('🌐 Fetching from website...');
    html = await fetchHtml('https://www.josemadridsalsa.com/find-us-locally/');
  }
  
  // Parse locations
  const locations = parseLocations(html);
  console.log(`\n✅ Parsed ${locations.length} locations\n`);
  
  // Count by state
  const stateCounts: Record<string, number> = {};
  locations.forEach(loc => {
    stateCounts[loc.state] = (stateCounts[loc.state] || 0) + 1;
  });
  
  console.log('📊 Locations by state:');
  Object.entries(stateCounts)
    .sort((a, b) => b[1] - a[1])
    .forEach(([state, count]) => {
      console.log(`   ${state}: ${count}`);
    });
  
  // Upsert locations
  console.log('\n💾 Upserting locations to database...');
  let created = 0;
  let updated = 0;
  
  for (const location of locations) {
    const result = await prisma.retailLocation.upsert({
      where: {
        businessName_address: {
          businessName: location.businessName,
          address: location.address
        }
      },
      update: {
        city: location.city,
        state: location.state,
        zipCode: location.zipCode,
        phone: location.phone,
        website: location.website,
        isActive: true,
        updatedAt: new Date()
      },
      create: {
        businessName: location.businessName,
        address: location.address,
        city: location.city,
        state: location.state,
        zipCode: location.zipCode,
        phone: location.phone,
        website: location.website,
        isActive: true,
        sortOrder: 0
      }
    });
    
    // Check if it was created or updated (rough heuristic based on updatedAt vs createdAt)
    const existing = await prisma.retailLocation.findUnique({
      where: {
        businessName_address: {
          businessName: location.businessName,
          address: location.address
        }
      }
    });
    
    if (existing && existing.createdAt.getTime() === existing.updatedAt.getTime()) {
      created++;
    } else {
      updated++;
    }
  }
  
  console.log(`\n✨ Seeding complete!`);
  console.log(`   Created: ${created} new locations`);
  console.log(`   Updated: ${updated} existing locations`);
  console.log(`   Total: ${locations.length} locations in database\n`);
}

main()
  .catch((e) => {
    console.error('❌ Error seeding database:', e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
