/**
 * Geocoding utility using Google Maps Geocoding API
 * Converts addresses to latitude/longitude coordinates
 */

export interface GeocodeResult {
  latitude: number
  longitude: number
  formattedAddress?: string
}

export interface GeocodeError {
  error: string
  message: string
}

/**
 * Geocode an address using Google Maps Geocoding API
 */
export async function geocodeAddress(
  address: string,
  city?: string,
  state?: string,
  zipCode?: string
): Promise<GeocodeResult> {
  const apiKey = process.env.GOOGLE_MAPS_API_KEY

  if (!apiKey) {
    throw new Error('GOOGLE_MAPS_API_KEY environment variable is not set')
  }

  // Build full address string
  const parts = [address, city, state, zipCode].filter(Boolean)
  const fullAddress = parts.join(', ')

  if (!fullAddress) {
    throw new Error('Address is required for geocoding')
  }

  // Call Google Maps Geocoding API
  const url = new URL('https://maps.googleapis.com/maps/api/geocode/json')
  url.searchParams.append('address', fullAddress)
  url.searchParams.append('key', apiKey)

  try {
    const response = await fetch(url.toString())

    if (!response.ok) {
      throw new Error(`Geocoding API returned ${response.status}: ${response.statusText}`)
    }

    const data = await response.json()

    // Check for API errors
    if (data.status !== 'OK') {
      if (data.status === 'ZERO_RESULTS') {
        throw new Error('No results found for this address')
      }
      if (data.status === 'OVER_QUERY_LIMIT') {
        throw new Error('Geocoding API rate limit exceeded')
      }
      if (data.status === 'REQUEST_DENIED') {
        throw new Error('Geocoding API request denied - check API key')
      }
      if (data.status === 'INVALID_REQUEST') {
        throw new Error('Invalid geocoding request')
      }
      throw new Error(`Geocoding failed: ${data.status}`)
    }

    // Get first result
    const result = data.results[0]
    if (!result || !result.geometry || !result.geometry.location) {
      throw new Error('Invalid response from geocoding API')
    }

    const { lat, lng } = result.geometry.location

    return {
      latitude: lat,
      longitude: lng,
      formattedAddress: result.formatted_address,
    }
  } catch (error: any) {
    // Re-throw with more context
    if (error instanceof Error) {
      throw error
    }
    throw new Error(`Geocoding failed: ${String(error)}`)
  }
}

/**
 * Format coordinates to 7 decimal places (Google Maps standard)
 */
export function formatCoordinate(value: number): string {
  return value.toFixed(7)
}
