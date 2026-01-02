import { NextRequest } from 'next/server'
import { requirePermission } from '@/lib/rbac'
import { ok, fail } from '@/lib/api'
import { geocodeAddress } from '@/lib/geocoding'

/**
 * POST /api/admin/locations/geocode
 * Geocode an address to get latitude/longitude
 */
export async function POST(req: NextRequest) {
  try {
    // Permission check
    await requirePermission('content:write')

    const body = await req.json()
    const { address, city, state, zipCode } = body

    if (!address) {
      return fail('Address is required', 400)
    }

    // Geocode the address
    const result = await geocodeAddress(address, city, state, zipCode)

    return ok({
      latitude: result.latitude,
      longitude: result.longitude,
      formattedAddress: result.formattedAddress,
    })
  } catch (error: any) {
    console.error('[POST /api/admin/locations/geocode] Error:', error)
    return fail(error.message || 'Geocoding failed', 500)
  }
}
