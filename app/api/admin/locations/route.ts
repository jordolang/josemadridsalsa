import { NextRequest } from 'next/server'
import { Decimal } from '@prisma/client/runtime/library'
import { prisma } from '@/lib/prisma'
import { requirePermission } from '@/lib/rbac'
import { ok, fail } from '@/lib/api'
import { logAudit } from '@/lib/audit'

function parseSortOrder(value: unknown): number {
  if (typeof value === 'number' && Number.isFinite(value)) {
    return value
  }

  if (typeof value === 'string') {
    const parsed = Number(value)
    if (Number.isFinite(parsed)) {
      return parsed
    }
  }

  return 0
}

/**
 * GET /api/admin/locations
 * List all locations with admin filters
 */
export async function GET(req: NextRequest) {
  try {
    // Permission check
    const user = await requirePermission('content:read')

    const searchParams = req.nextUrl.searchParams
    const state = searchParams.get('state')
    const city = searchParams.get('city')
    const isActive = searchParams.get('isActive')

    const where: any = {}

    if (state) {
      where.state = state
    }

    if (city) {
      where.city = city
    }

    if (isActive !== null && isActive !== undefined) {
      where.isActive = isActive === 'true'
    }

    const locations = await prisma.retailLocation.findMany({
      where,
      include: {
        _count: {
          select: {
            photos: true,
          },
        },
      },
      orderBy: [{ state: 'asc' }, { city: 'asc' }, { businessName: 'asc' }],
    })

    return ok({ locations })
  } catch (error: any) {
    console.error('[GET /api/admin/locations] Error:', error)
    return fail(error.message || 'Failed to fetch locations', 500)
  }
}

/**
 * POST /api/admin/locations
 * Create a new location
 */
export async function POST(req: NextRequest) {
  try {
    // Permission check
    const user = await requirePermission('content:write')

    const body = await req.json()
    const {
      businessName,
      address,
      city,
      state,
      zipCode,
      phone,
      website,
      photoUrl,
      googlePlacesId,
      latitude,
      longitude,
      county,
      isActive,
      sortOrder,
      photoGallery, // Array of {url: string, caption?: string}
    } = body

    // Validation
    if (!businessName || !address || !city || !state) {
      return fail('Missing required fields: businessName, address, city, state')
    }

    // Check for duplicates
    const existing = await prisma.retailLocation.findUnique({
      where: {
        businessName_address: {
          businessName,
          address,
        },
      },
    })

    if (existing) {
      return fail(
        'A location with this business name and address already exists',
        409
      )
    }

    // Convert lat/lng to Decimal if provided
    const lat =
      latitude && latitude !== '' ? new Decimal(latitude.toString()) : null
    const lng =
      longitude && longitude !== '' ? new Decimal(longitude.toString()) : null

    // Create location with photos in a transaction
    const location = await prisma.$transaction(async (tx) => {
      // Create location
      const loc = await tx.retailLocation.create({
        data: {
          businessName,
          address,
          city,
          state,
          zipCode: zipCode || null,
          phone: phone || null,
          website: website || null,
          photoUrl: photoUrl || null,
          googlePlacesId: googlePlacesId || null,
          latitude: lat,
          longitude: lng,
          county: county || null,
          isActive: isActive ?? true,
          sortOrder: parseSortOrder(sortOrder),
        },
      })

      // Create photos if provided
      if (photoGallery && Array.isArray(photoGallery) && photoGallery.length > 0) {
        for (let i = 0; i < photoGallery.length; i++) {
          await tx.locationPhoto.create({
            data: {
              url: photoGallery[i].url,
              caption: photoGallery[i].caption || null,
              sortOrder: i,
              locationId: loc.id,
            },
          })
        }
      }

      return loc
    })

    // Audit log
    await logAudit({
      userId: user.id,
      action: 'locations.create',
      entityType: 'retailLocation',
      entityId: location.id,
      changes: {
        businessName,
        city,
        state,
      },
    })

    return ok({ location }, 201)
  } catch (error: any) {
    console.error('[POST /api/admin/locations] Error:', error)
    return fail(error.message || 'Failed to create location', 500)
  }
}
