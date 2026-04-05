/**
 * Store finder / retail location endpoints.
 * All location endpoints are public.
 */

import { get, post } from './client';
import type { RetailLocation } from './types';

/**
 * Fetch retail locations with optional city/state filters.
 *
 * @param params - Optional filters by city and/or state
 * @returns Array of retail locations with address, coordinates, and contact info
 */
export async function getLocations(params?: {
  city?: string;
  state?: string;
}): Promise<RetailLocation[]> {
  return get<RetailLocation[]>('/api/locations', params);
}

/**
 * Geocode an address string to latitude/longitude coordinates.
 *
 * @param address - Human-readable address string (e.g., "123 Main St, Columbus, OH")
 * @returns Object with `lat` and `lng` coordinates
 */
export async function geocodeAddress(
  address: string
): Promise<{ lat: number; lng: number }> {
  return post<{ lat: number; lng: number }>('/api/locations/geocode', { address });
}
