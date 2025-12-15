/**
 * Google Places API Photo URL Utilities
 *
 * Centralizes the logic for building photo URLs from Google Places API photo resources.
 * Photo names from the API are full resource paths like "places/{placeId}/photos/{photoId}".
 */

const PLACES_API_BASE = 'https://places.googleapis.com/v1';

/**
 * Validates that a photo name has the expected format from Google Places API
 * @param photoName - The photo resource name from Google Places API
 * @throws Error if the photo name doesn't match the expected format
 */
function validatePhotoName(photoName: string): void {
  if (!photoName || typeof photoName !== 'string') {
    throw new Error('Photo name must be a non-empty string');
  }

  // Photo names should follow the pattern: places/{placeId}/photos/{photoId}
  if (!photoName.startsWith('places/') || !photoName.includes('/photos/')) {
    throw new Error(
      `Invalid photo name format. Expected "places/{placeId}/photos/{photoId}", got: ${photoName.substring(0, 50)}...`
    );
  }
}

/**
 * Builds a Google Places API photo URL from a photo resource name
 *
 * @param photoName - Full resource path from Google Places API (e.g., "places/{placeId}/photos/{photoId}")
 * @param apiKey - Google Places API key
 * @param maxWidth - Maximum width in pixels for the photo (default: 1200)
 * @returns Complete photo URL ready to use
 *
 * @example
 * ```typescript
 * const photoUrl = buildPlacesPhotoUrl(
 *   'places/ChIJ.../photos/AWn5SU6m...',
 *   'your-api-key',
 *   800
 * );
 * ```
 */
export function buildPlacesPhotoUrl(
  photoName: string,
  apiKey: string,
  maxWidth: number = 1200
): string {
  validatePhotoName(photoName);

  if (!apiKey || typeof apiKey !== 'string') {
    throw new Error('API key must be a non-empty string');
  }

  if (typeof maxWidth !== 'number' || maxWidth <= 0) {
    throw new Error('maxWidth must be a positive number');
  }

  return `${PLACES_API_BASE}/${photoName}/media?key=${apiKey}&maxWidthPx=${maxWidth}`;
}

/**
 * Type-safe wrapper for building photo URLs with environment variable API key
 * Uses GOOGLE_PLACES_API_KEY or NEXT_PUBLIC_GOOGLE_MAPS_API_KEY from environment
 */
export function buildPlacesPhotoUrlFromEnv(
  photoName: string,
  maxWidth: number = 1200
): string {
  const apiKey = process.env.GOOGLE_PLACES_API_KEY || process.env.NEXT_PUBLIC_GOOGLE_MAPS_API_KEY;

  if (!apiKey) {
    throw new Error(
      'Google Places API key not found in environment. ' +
      'Set GOOGLE_PLACES_API_KEY or NEXT_PUBLIC_GOOGLE_MAPS_API_KEY'
    );
  }

  return buildPlacesPhotoUrl(photoName, apiKey, maxWidth);
}
