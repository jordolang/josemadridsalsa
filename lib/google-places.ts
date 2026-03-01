// Google Places API helper functions
// Note: Requires GOOGLE_PLACES_API_KEY or NEXT_PUBLIC_GOOGLE_MAPS_API_KEY environment variable

const API_KEY = process.env.GOOGLE_PLACES_API_KEY || process.env.NEXT_PUBLIC_GOOGLE_MAPS_API_KEY;
const PLACES_API_BASE = 'https://places.googleapis.com/v1';
const LEGACY_PLACES_API_BASE = 'https://maps.googleapis.com/maps/api';

// Delay helper for rate limiting
const delay = (ms: number) => new Promise(resolve => setTimeout(resolve, ms));

// Fetch with retry and exponential backoff
async function fetchWithRetry(url: string, options: RequestInit, retries = 3): Promise<Response> {
  for (let i = 0; i < retries; i++) {
    try {
      const response = await fetch(url, options);
      
      // Success
      if (response.ok) {
        return response;
      }
      
      // Rate limit or server error - retry with exponential backoff
      if (response.status === 429 || response.status >= 500) {
        const backoffMs = Math.pow(2, i) * 1000; // 1s, 2s, 4s
        console.warn(`Request failed with ${response.status}, retrying in ${backoffMs}ms...`);
        await delay(backoffMs);
        continue;
      }
      
      // Other errors - don't retry
      return response;
    } catch (error) {
      if (i === retries - 1) throw error;
      await delay(Math.pow(2, i) * 1000);
    }
  }
  
  throw new Error('Max retries exceeded');
}

// Validate URL returns 200
export async function fetchRemoteHead(url: string): Promise<boolean> {
  try {
    const response = await fetch(url, { method: 'HEAD', signal: AbortSignal.timeout(5000) });
    return response.ok;
  } catch {
    return false;
  }
}

// Extract domain from URL
function extractDomain(url: string): string | null {
  try {
    const urlObj = new URL(url.startsWith('http') ? url : `https://${url}`);
    return urlObj.hostname.replace('www.', '');
  } catch {
    return null;
  }
}

// Get company logo from website
export async function getCompanyLogoFromWebsite(websiteUrl: string): Promise<string | null> {
  if (!websiteUrl) return null;
  
  const domain = extractDomain(websiteUrl);
  if (!domain) return null;
  
  // Try Clearbit first (higher quality)
  const clearbitUrl = `https://logo.clearbit.com/${domain}`;
  if (await fetchRemoteHead(clearbitUrl)) {
    return clearbitUrl;
  }
  
  // Fallback to Google favicon
  const faviconUrl = `https://www.google.com/s2/favicons?sz=256&domain=${domain}`;
  if (await fetchRemoteHead(faviconUrl)) {
    return faviconUrl;
  }
  
  return null;
}

// Build Google Places photo URL (supports both legacy and new API)
export function buildPlacesPhotoUrl(photoReference: string, maxWidth: number = 800): string {
  if (!API_KEY) {
    throw new Error('GOOGLE_PLACES_API_KEY not configured');
  }

  // Check if it's a new API photo name (contains 'places/')
  if (photoReference.includes('places/')) {
    // New API format: places/{place_id}/photos/{photo_id}
    return `${PLACES_API_BASE}/${photoReference}/media?key=${API_KEY}&maxWidthPx=${maxWidth}`;
  } else {
    // Legacy API format: photo_reference
    return `${LEGACY_PLACES_API_BASE}/place/photo?photoreference=${photoReference}&key=${API_KEY}&maxwidth=${maxWidth}`;
  }
}

// Get best photo from place
export function getBestPhotoUrlForPlace(place: any): string | null {
  if (!place?.photos || place.photos.length === 0) {
    return null;
  }
  
  // Prefer photos that aren't just logos
  // Sort by width (prefer larger), but cap at 1200px
  const photos = place.photos
    .filter((photo: any) => photo.widthPx && photo.heightPx)
    .sort((a: any, b: any) => {
      // Prefer horizontal orientation
      const aRatio = a.widthPx / a.heightPx;
      const bRatio = b.widthPx / b.heightPx;
      
      // Prefer wider aspect ratios (more horizontal)
      if (Math.abs(aRatio - bRatio) > 0.3) {
        return bRatio - aRatio;
      }
      
      // Then by size (but prefer under 1200px to avoid huge images)
      const aSize = Math.min(a.widthPx, 1200);
      const bSize = Math.min(b.widthPx, 1200);
      return bSize - aSize;
    });
  
  if (photos.length === 0) return null;
  
  const bestPhoto = photos[0];
  const maxWidth = Math.min(bestPhoto.widthPx, 1200);
  
  try {
    return buildPlacesPhotoUrl(bestPhoto.name, maxWidth);
  } catch {
    return null;
  }
}

// Find place by name and address (tries v1 first, falls back to legacy)
export async function findPlaceByNameAddress(input: {
  businessName: string;
  address: string;
  city: string;
  state: string;
}): Promise<{ place: any; photos: string[] } | null> {
  if (!API_KEY) {
    console.warn('GOOGLE_PLACES_API_KEY not configured');
    return null;
  }

  const query = `${input.businessName} ${input.address} ${input.city} ${input.state}`;

  // Try v1 API first
  try {
    const response = await fetchWithRetry(
      `${PLACES_API_BASE}/places:searchText`,
      {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'X-Goog-Api-Key': API_KEY,
          'X-Goog-FieldMask': 'places.id,places.displayName,places.formattedAddress,places.location,places.photos,places.types',
        },
        body: JSON.stringify({
          textQuery: query,
          locationBias: {
            circle: {
              center: {
                // Rough center of query location (could be improved with geocoding)
                latitude: input.state === 'OH' ? 40.4173 : 40.0,
                longitude: input.state === 'OH' ? -82.9071 : -83.0,
              },
              radius: 50000, // 50km
            },
          },
        }),
      }
    );

    if (response.ok) {
      const data = await response.json();

      if (data.places && data.places.length > 0) {
        // Return the first (best) match
        const place = data.places[0];

        // Extract photo URLs
        const photos: string[] = [];
        if (place.photos) {
          place.photos.forEach((photo: any) => {
            try {
              const url = buildPlacesPhotoUrl(photo.name, 800);
              photos.push(url);
            } catch {
              // Skip if error building URL
            }
          });
        }

        await delay(100);
        return { place, photos };
      }
    }
  } catch (error) {
    console.warn('V1 API failed, trying legacy API:', error);
  }

  // Fallback to legacy API
  console.log('🔄 Falling back to legacy Places API...');
  return await findPlaceByNameAddressLegacy(input);
}

// Legacy Places API implementation (no billing required)
async function findPlaceByNameAddressLegacy(input: {
  businessName: string;
  address: string;
  city: string;
  state: string;
}): Promise<{ place: any; photos: string[] } | null> {
  const query = `${input.businessName} ${input.address} ${input.city} ${input.state}`;

  try {
    const response = await fetchWithRetry(
      `${LEGACY_PLACES_API_BASE}/place/findplacefromtext/json?input=${encodeURIComponent(query)}&inputtype=textquery&fields=place_id,name,formatted_address,photos&key=${API_KEY}`,
      {
        method: 'GET',
      }
    );

    if (!response.ok) {
      console.warn(`Legacy Places API error: ${response.status}`);
      return null;
    }

    const data = await response.json();

    if (data.status !== 'OK' || !data.candidates || data.candidates.length === 0) {
      console.warn('Legacy API: No places found');
      return null;
    }

    // Return the first (best) match
    const place = data.candidates[0];

    // Extract photo URLs (legacy format)
    const photos: string[] = [];
    if (place.photos) {
      place.photos.forEach((photo: any) => {
        if (photo.photo_reference) {
          const url = `${LEGACY_PLACES_API_BASE}/place/photo?photoreference=${photo.photo_reference}&key=${API_KEY}&maxwidth=800`;
          photos.push(url);
        }
      });
    }

    await delay(100);
    return { place, photos };
  } catch (error) {
    console.error('Error fetching from legacy Places API:', error);
    return null;
  }
}
