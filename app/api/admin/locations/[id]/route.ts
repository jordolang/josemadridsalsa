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
 * GET /api/admin/locations/[id]
 * Get a single location with photos
 */
export async function GET(
  _req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    // Permission check
    const user = await requirePermission('content:read')

    const { id } = await params
    const location = await prisma.retailLocation.findUnique({
      where: { id },
      include: {
        photos: {
          orderBy: {
            sortOrder: 'asc',
          },
        },
      },
    })

    if (!location) {
      return fail('Location not found', 404)
    }

    return ok({ location })
  } catch (error: any) {
    console.error('[GET /api/admin/locations/[id]] Error:', error)
    return fail(error.message || 'Failed to fetch location', 500)
  }
}

/**
 * PATCH /api/admin/locations/[id]
 * Update a location
 */
export async function PATCH(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    // Permission check
    const user = await requirePermission('content:write')

    const { id } = await params
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

    // Check if location exists
    const existing = await prisma.retailLocation.findUnique({
      where: { id },
    })

    if (!existing) {
      return fail('Location not found', 404)
    }

    // Convert lat/lng to Decimal if provided
    const lat =
      latitude !== undefined && latitude !== null && latitude !== ''
        ? new Decimal(latitude.toString())
        : null
    const lng =
      longitude !== undefined && longitude !== null && longitude !== ''
        ? new Decimal(longitude.toString())
        : null

    // Update location with photos in a transaction
    const location = await prisma.$transaction(async (tx) => {
      // Update location
      const loc = await tx.retailLocation.update({
        where: { id },
        data: {
          businessName: businessName ?? existing.businessName,
          address: address ?? existing.address,
          city: city ?? existing.city,
          state: state ?? existing.state,
          zipCode: zipCode !== undefined ? zipCode || null : existing.zipCode,
          phone: phone !== undefined ? phone || null : existing.phone,
          website: website !== undefined ? website || null : existing.website,
          photoUrl:
            photoUrl !== undefined ? photoUrl || null : existing.photoUrl,
          googlePlacesId:
            googlePlacesId !== undefined
              ? googlePlacesId || null
              : existing.googlePlacesId,
          latitude: lat !== undefined ? lat : existing.latitude,
          longitude: lng !== undefined ? lng : existing.longitude,
          county: county !== undefined ? county || null : existing.county,
          isActive: isActive !== undefined ? isActive : existing.isActive,
          sortOrder:
            sortOrder !== undefined
              ? parseSortOrder(sortOrder)
              : existing.sortOrder,
        },
      })

      // Update photos if provided
      if (photoGallery !== undefined && Array.isArray(photoGallery)) {
        // Delete existing photos
        await tx.locationPhoto.deleteMany({
          where: { locationId: id },
        })

        // Create new photos
        if (photoGallery.length > 0) {
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
      }

      return loc
    })

    // Audit log
    await logAudit({
      userId: user.id,
      action: 'locations.update',
      entityType: 'retailLocation',
      entityId: location.id,
      changes: {
        businessName,
        city,
        state,
      },
    })

    return ok({ location })
  } catch (error: any) {
    console.error('[PATCH /api/admin/locations/[id]] Error:', error)
    return fail(error.message || 'Failed to update location', 500)
  }
}

/**
 * DELETE /api/admin/locations/[id]
 * Delete a location (cascade deletes photos)
 */
export async function DELETE(
  _req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    // Permission check
    const user = await requirePermission('content:write')

    const { id } = await params

    // Check if location exists
    const location = await prisma.retailLocation.findUnique({
      where: { id },
    })

    if (!location) {
      return fail('Location not found', 404)
    }

    // Delete location (cascade deletes photos automatically)
    await prisma.retailLocation.delete({
      where: { id },
    })

    // Audit log
    await logAudit({
      userId: user.id,
      action: 'locations.delete',
      entityType: 'retailLocation',
      entityId: id,
      changes: {
        businessName: location.businessName,
        city: location.city,
        state: location.state,
      },
    })

    return ok({ message: 'Location deleted successfully' })
  } catch (error: any) {
    console.error('[DELETE /api/admin/locations/[id]] Error:', error)
    return fail(error.message || 'Failed to delete location', 500)
  }
}
