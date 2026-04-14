/*
  Generate a photo URL cache for Find Us locations using Google Places API.

  Requirements:
  - Set GOOGLE_PLACES_API_KEY in your environment (same key used by lib/google-places.ts)

  Usage:
    node scripts/generate-location-photos.cjs
*/

require('dotenv/config');
const fs = require('fs');
const fsp = require('fs/promises');
const path = require('path');

const API_KEY = process.env.GOOGLE_PLACES_API_KEY || process.env.NEXT_PUBLIC_GOOGLE_MAPS_API_KEY;

function delay(ms) { return new Promise(r => setTimeout(r, ms)); }

async function fetchWithRetry(url, options, retries = 3) {
  for (let i = 0; i < retries; i++) {
    try {
      const res = await fetch(url, options);
      if (res.ok) return res;
      if (res.status === 429 || res.status >= 500) {
        const backoff = Math.pow(2, i) * 1000;
        await delay(backoff);
        continue;
      }
      return res;
    } catch (e) {
      if (i === retries - 1) throw e;
      await delay(Math.pow(2, i) * 1000);
    }
  }
  throw new Error('Max retries exceeded');
}

function cleanMarkdownLine(line) {
  const withoutBold = line.replace(/\*\*/g, '').replace(/\u00A0/g, ' ');
  return withoutBold.trim();
}

function extractUrl(markdown) {
  const linkMatch = markdown.match(/\((https?:[^)]+)\)/i);
  if (linkMatch) return linkMatch[1];
  const rawMatch = markdown.match(/https?:\/\/\S+/i);
  return rawMatch ? rawMatch[0] : null;
}

function extractPhone(fragment) {
  const phoneMatch = fragment.match(/(\+?1[ \-\.]*)?\(?\d{3}\)?[ \-\.]?\d{3}[ \-\.]?\d{4}/);
  return phoneMatch ? phoneMatch[0] : null;
}

function isCityHeader(line) {
  const cleaned = cleanMarkdownLine(line);
  const cityState = cleaned.match(/^(.+?),\s*([A-Z]{2})$/);
  return Boolean(cityState);
}

async function parseFindUsMarkdown(mdAbsolutePath) {
  const content = await fsp.readFile(mdAbsolutePath, 'utf-8');
  const lines = content.split(/\r?\n/);
  const STATE_CODE_RE = /\b(AL|AK|AZ|AR|CA|CO|CT|DE|FL|GA|HI|ID|IL|IN|IA|KS|KY|LA|ME|MD|MA|MI|MN|MS|MO|MT|NE|NV|NH|NJ|NM|NY|NC|ND|OH|OK|OR|PA|RI|SC|SD|TN|TX|UT|VT|VA|WA|WV|WI|WY)\b/;

  let currentCity = null;
  let currentState = null;
  const locations = [];

  for (const rawLine of lines) {
    const line = rawLine.trim();
    if (!line || line === '**' || line === '****') continue;
    if (line.startsWith('---') || line.toLowerCase().includes('stores')) continue;

    if (isCityHeader(line)) {
      const cleaned = cleanMarkdownLine(line);
      const cityState = cleaned.match(/^(.+?),\s*([A-Z]{2})$/);
      if (cityState) {
        currentCity = cityState[1].trim();
        currentState = cityState[2].trim();
      }
      continue;
    }

    if (currentCity && currentState) {
      const cleaned = cleanMarkdownLine(line);
      const website = extractUrl(cleaned);
      const withoutLinks = cleaned.replace(/\[[^\]]*\]\([^)]*\)/g, '').replace(/https?:\/\/\S+/g, '').trim();
      const parts = withoutLinks.split(',').map(p => p.trim()).filter(Boolean);
      if (parts.length === 0) continue;

      const businessName = parts[0];
      const phone = extractPhone(cleaned);

      const middleParts = parts.slice(1).filter(p => {
        if (!phone) return true;
        const digits = phone.replace(/[^0-9]/g, '');
        return !p.replace(/[^0-9]/g, '').includes(digits.slice(-4));
      });

      let streetAddress = middleParts.join(', ');
      streetAddress = streetAddress.replace(/\s{2,}/g, ' ').trim();
      if (!streetAddress) {
        let fallback = cleaned;
        fallback = fallback.replace(businessName, '').trim();
        if (phone) fallback = fallback.replace(phone, '').trim();
        fallback = fallback.replace(/\[[^\]]*\]\([^)]*\)/g, '').replace(/https?:\/\/\S+/g, '').trim();
        fallback = fallback.replace(new RegExp(`,?\\s*${currentCity}\\s*,?\\s*${currentState}\\b.*$`), '').trim();
        streetAddress = fallback.replace(/^,+|,+$/g, '').trim();
      }

      const zipMatch = cleaned.match(/\b\d{5}(?:-\d{4})?\b/);
      const zipCode = zipMatch ? zipMatch[0] : null;
      if (STATE_CODE_RE.test(businessName)) continue;

      const idSource = `${businessName}-${streetAddress || cleaned}-${currentCity}-${currentState}`;
      const id = idSource.toLowerCase().replace(/[^a-z0-9]+/g, '-');

      locations.push({ id, businessName, address: streetAddress, city: currentCity, state: currentState, zipCode, phone, website });
    }
  }

  const unique = {};
  for (const loc of locations) {
    if (!unique[loc.id]) unique[loc.id] = loc;
  }
  return Object.values(unique);
}

function buildPlacesPhotoUrl(photoName, maxWidth = 800) {
  return `https://places.googleapis.com/v1/${photoName}/media?key=${API_KEY}&maxWidthPx=${maxWidth}`;
}

function pickBestPhoto(place) {
  if (!place || !place.photos || place.photos.length === 0) return null;
  const photos = place.photos
    .filter(p => p.widthPx && p.heightPx)
    .sort((a, b) => {
      const aRatio = a.widthPx / a.heightPx;
      const bRatio = b.widthPx / b.heightPx;
      if (Math.abs(aRatio - bRatio) > 0.3) return bRatio - aRatio;
      const aSize = Math.min(a.widthPx, 1200);
      const bSize = Math.min(b.widthPx, 1200);
      return bSize - aSize;
    });
  if (photos.length === 0) return null;
  const best = photos[0];
  const maxW = Math.min(best.widthPx, 1200);
  return buildPlacesPhotoUrl(best.name, maxW);
}

async function searchPlace({ businessName, address, city, state }) {
  const textQuery = `${businessName} ${address} ${city} ${state}`.trim();
  const url = 'https://places.googleapis.com/v1/places:searchText';
  try {
    const res = await fetchWithRetry(url, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'X-Goog-Api-Key': API_KEY,
        'X-Goog-FieldMask': 'places.id,places.displayName,places.formattedAddress,places.photos,places.types',
      },
      body: JSON.stringify({ textQuery }),
    });
    
    if (!res.ok) {
      const errorText = await res.text();
      console.error(`\nAPI error (${res.status}) for ${businessName}: ${errorText.substring(0, 200)}`);
      return null;
    }
    
    const data = await res.json();
    if (!data.places || data.places.length === 0) {
      return null;
    }
    return data.places[0];
  } catch (error) {
    console.error(`\nNetwork error for ${businessName}: ${error.message}`);
    return null;
  }
}

async function main() {
  if (!API_KEY) {
    console.error('GOOGLE_PLACES_API_KEY or NEXT_PUBLIC_GOOGLE_MAPS_API_KEY is not set. Please set it in your environment and rerun.');
    process.exit(1);
  }

  // Resolve paths relative to the repo root, not the current working directory.
  // This allows running the script from anywhere (e.g. from `scripts/`).
  const repoRoot = path.resolve(__dirname, '..');

  // Try kebab-case path first, then fallback to spaced path
  const kebabPath = path.join(repoRoot, 'public', 'find-us-locally', 'find-us-locally.md');
  const spacedPath = path.join(repoRoot, 'public', 'Find Us Locally', 'Find Us Locally.md');

  let mdPath;
  try {
    await fsp.access(kebabPath);
    mdPath = kebabPath;
    console.log('Using kebab-case markdown file:', mdPath);
  } catch {
    try {
      await fsp.access(spacedPath);
      mdPath = spacedPath;
      console.log('Using spaced markdown file:', mdPath);
    } catch {
      console.error(`Neither markdown file found at:\n  ${kebabPath}\n  ${spacedPath}`);
      process.exit(1);
    }
  }

  const outPath = path.join(repoRoot, 'public', 'location-photos.json');

  console.log('Parsing markdown for locations...');
  const locations = await parseFindUsMarkdown(mdPath);
  console.log(`Found ${locations.length} locations.`);

  const results = {};
  let processed = 0;
  for (const loc of locations) {
    processed++;
    process.stdout.write(`\r[${processed}/${locations.length}] ${loc.businessName}, ${loc.city}, ${loc.state}        `);
    try {
      const place = await searchPlace(loc);
      let photoUrl = null;
      if (place) {
        photoUrl = pickBestPhoto(place);
      }
      if (photoUrl) {
        results[loc.id] = photoUrl;
      }
      await delay(120); // basic pacing
    } catch (e) {
      console.error(`\nError processing ${loc.businessName}: ${e.message}`);
      // continue to next location
    }
  }

  console.log(`\nWriting ${Object.keys(results).length} photo URLs to ${outPath}`);
  await fsp.writeFile(outPath, JSON.stringify(results, null, 2), 'utf-8');
  console.log('Done.');
}

main().catch(err => {
  console.error(err);
  process.exit(1);
});


