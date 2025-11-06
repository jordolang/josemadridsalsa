import fs from 'fs/promises';
import path from 'path';

export interface ParsedLocation {
  id: string;
  businessName: string;
  address: string;
  city: string;
  state: string;
  zipCode: string | null;
  phone: string | null;
  website: string | null;
}

const STATE_CODE_RE = /\b(AL|AK|AZ|AR|CA|CO|CT|DE|FL|GA|HI|ID|IL|IN|IA|KS|KY|LA|ME|MD|MA|MI|MN|MS|MO|MT|NE|NV|NH|NJ|NM|NY|NC|ND|OH|OK|OR|PA|RI|SC|SD|TN|TX|UT|VT|VA|WA|WV|WI|WY)\b/;

function cleanMarkdownLine(line: string): string {
  // Remove bold markers and stray asterisks/extra whitespace
  const withoutBold = line.replace(/\*\*/g, '').replace(/\u00A0/g, ' ');
  return withoutBold.trim();
}

function extractUrl(markdown: string): string | null {
  const linkMatch = markdown.match(/\((https?:[^)]+)\)/i);
  if (linkMatch) return linkMatch[1];
  const rawMatch = markdown.match(/https?:\/\/\S+/i);
  return rawMatch ? rawMatch[0] : null;
}

function extractPhone(fragment: string): string | null {
  // Accept formats like (330) 867-3563, 330-867-3563, 330 867 3563
  const phoneMatch = fragment.match(/(\+?1[ \-\.]*)?\(?\d{3}\)?[ \-\.]?\d{3}[ \-\.]?\d{4}/);
  return phoneMatch ? phoneMatch[0] : null;
}

function isCityHeader(line: string): boolean {
  // Looks like "City, ST"
  const cleaned = cleanMarkdownLine(line);
  const cityState = cleaned.match(/^(.+?),\s*([A-Z]{2})$/);
  return Boolean(cityState);
}

export async function parseFindUsMarkdown(mdAbsolutePath: string): Promise<ParsedLocation[]> {
  const content = await fs.readFile(mdAbsolutePath, 'utf-8');
  const lines = content.split(/\r?\n/);

  let currentCity: string | null = null;
  let currentState: string | null = null;
  const locations: ParsedLocation[] = [];

  for (const rawLine of lines) {
    const line = rawLine.trim();
    if (!line || line === '**' || line === '****') continue;

    // Skip front-matter and obvious headings
    if (line.startsWith('---') || line.toLowerCase().includes('stores')) continue;

    // Track city/state headers
    if (isCityHeader(line)) {
      const cleaned = cleanMarkdownLine(line);
      const cityState = cleaned.match(/^(.+?),\s*([A-Z]{2})$/);
      if (cityState) {
        currentCity = cityState[1].trim();
        currentState = cityState[2].trim();
      }
      continue;
    }

    // Business lines are typically bold, but we parse any non-header content when we have a city/state context
    if (currentCity && currentState) {
      const cleaned = cleanMarkdownLine(line);

      // Extract website if present
      const website = extractUrl(cleaned);
      const withoutLinks = cleaned.replace(/\[[^\]]*\]\([^)]*\)/g, '').replace(/https?:\/\/\S+/g, '').trim();

      // Split on commas to separate name, address bits, phone
      const parts = withoutLinks.split(',').map(p => p.trim()).filter(Boolean);
      if (parts.length === 0) continue;

      const businessName = parts[0];

      // Try to find a phone anywhere in the full cleaned line
      const phone = extractPhone(cleaned);

      // Build address from the middle parts; stop before a part that looks like a phone
      const middleParts = parts.slice(1).filter(p => {
        if (!phone) return true;
        const digits = phone.replace(/[^0-9]/g, '');
        return !p.replace(/[^0-9]/g, '').includes(digits.slice(-4));
      });

      // If the city/state are not in the address, assume the address part is just street and maybe city text
      let streetAddress = middleParts.join(', ');
      streetAddress = streetAddress.replace(/\s{2,}/g, ' ').trim();

      // Fallback: try to derive street by removing business name, links, and phone from the cleaned line
      if (!streetAddress) {
        let fallback = cleaned;
        fallback = fallback.replace(businessName, '').trim();
        if (phone) fallback = fallback.replace(phone, '').trim();
        fallback = fallback.replace(/\[[^\]]*\]\([^)]*\)/g, '').replace(/https?:\/\/\S+/g, '').trim();
        // Remove trailing city/state tokens if present
        fallback = fallback.replace(new RegExp(`,?\\s*${currentCity}\\s*,?\\s*${currentState}\\b.*$`), '').trim();
        streetAddress = fallback.replace(/^,+|,+$/g, '').trim();
      }

      // Best-effort zip extraction (not always present)
      const zipMatch = cleaned.match(/\b\d{5}(?:-\d{4})?\b/);
      const zipCode = zipMatch ? zipMatch[0] : null;

      // Skip blatantly bad rows (e.g., if first token actually looks like a city header)
      if (STATE_CODE_RE.test(businessName)) continue;

      // Include street address in ID to ensure multiple locations with same business name in a city are unique
      const idSource = `${businessName}-${streetAddress || cleaned}-${currentCity}-${currentState}`;
      const id = idSource.toLowerCase().replace(/[^a-z0-9]+/g, '-');

      locations.push({
        id,
        businessName,
        address: streetAddress,
        city: currentCity,
        state: currentState,
        zipCode,
        phone,
        website,
      });
    }
  }

  // De-duplicate by id (some lines may repeat/corrupt)
  const unique: Record<string, ParsedLocation> = {};
  for (const loc of locations) {
    if (!unique[loc.id]) unique[loc.id] = loc;
  }
  return Object.values(unique);
}

export function buildStreetViewOrMapImageUrl(address: string, city: string, state: string): string {
  const apiKey = process.env.NEXT_PUBLIC_GOOGLE_MAPS_API_KEY;
  const location = encodeURIComponent(`${address}, ${city}, ${state}`);
  if (apiKey) {
    // Prefer Street View
    return `https://maps.googleapis.com/maps/api/streetview?size=640x420&location=${location}&key=${apiKey}`;
  }
  // Fallback: simple svg placeholder (no external fetch/key needed)
  const label = encodeURIComponent(`${city}, ${state}`);
  return `data:image/svg+xml;utf8,${encodeURIComponent(
    `<svg xmlns='http://www.w3.org/2000/svg' width='640' height='420'>\n` +
    `<rect width='100%' height='100%' fill='#f3f4f6'/>\n` +
    `<text x='50%' y='50%' dominant-baseline='middle' text-anchor='middle' font-family='sans-serif' font-size='20' fill='#6b7280'>${label}</text>\n` +
    `</svg>`
  )}`;
}

export async function readFindUsMarkdownAbsolute(): Promise<string> {
  // Prefer the path with spaces/case as seen in repo
  const absolutePath = path.join(process.cwd(), 'public', 'Find Us Locally', 'Find Us Locally.md');
  return absolutePath;
}


