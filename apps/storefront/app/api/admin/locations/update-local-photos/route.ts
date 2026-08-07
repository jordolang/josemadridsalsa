import { NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { requirePermission } from '@/lib/rbac'
import { logAudit } from '@/lib/audit'

export const runtime = 'nodejs'

// Manual mappings of photo files to location criteria
const photoMappings = [
  {
    file: 'Edinburg-6792.jpg',
    businessName: 'Edinburg Corner Store',
    addressContains: '6792',
  },
  {
    file: 'Farm-Table-3952.png',
    businessName: 'The Farm Table',
    addressContains: '3952',
  },
  {
    file: 'IGA-2736.jpg',
    businessName: 'Rideouts IGA',
    addressContains: '2736',
  },
  {
    file: 'IGA-331.png',
    businessName: 'Oberlin IGA',
    addressContains: '331',
  },
  {
    file: 'Inside-Out-5211.png',
    businessName: 'Oakland Inside & Out Garden and Gifts',
    addressContains: '5211',
  },
  {
    file: 'Kuhn\'s-2284.png',
    businessName: 'Kuhn\'s',
    addressContains: '2284',
  },
  {
    file: 'Kuhns\'s-2412.jpg',
    businessName: 'Kuhn\'s',
    addressContains: '2412',
  },
  {
    file: 'Meijer-247.jpg',
    businessName: 'Meijer',
    city: 'Kent',
    addressContains: '247',
  },
  {
    file: 'Shopwise-704.jpg',
    businessName: 'Shopwise/Warsaw Main Mart',
    addressContains: '704',
  },
  {
    file: 'Stanley\'s-3302.jpg',
    businessName: 'Stanley Market',
    addressContains: '3302',
  },
  {
    file: 'Winding-Road-117.jpg',
    businessName: 'Winding Road Marketplace',
    addressContains: '117',
  },
  {
    file: 'meijer-9200.jpg',
    businessName: 'Meijer',
    city: 'Engelwood',
    addressContains: '9200',
  },
]

export async function POST() {
  // Previously unauthenticated — see the note in ../fetch-photos/route.ts. This one writes
  // photo URLs onto matched locations, so anyone could have rewritten them.
  let actor: Awaited<ReturnType<typeof requirePermission>>
  try {
    actor = await requirePermission('content:write')
  } catch {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  let updated = 0
  let skipped = 0
  const results: string[] = []

  for (const mapping of photoMappings) {
    // Build where clause
    const where: any = {
      isActive: true,
      businessName: mapping.businessName,
    }

    if (mapping.city) {
      where.city = mapping.city
    }

    if (mapping.addressContains) {
      where.address = {
        contains: mapping.addressContains,
      }
    }

    const location = await prisma.retailLocation.findFirst({ where })

    if (location) {
      const newPhotoUrl = `/find-us-locally/${mapping.file}`

      // Check if it's already using this photo
      if (location.photoUrl === newPhotoUrl) {
        results.push(`⊘ ${location.businessName} (${location.city}) - Already has local photo`)
        skipped++
        continue
      }

      await prisma.retailLocation.update({
        where: { id: location.id },
        data: { photoUrl: newPhotoUrl },
      })

      results.push(`✓ ${location.businessName} (${location.city}) - Updated to ${mapping.file}`)
      updated++
    } else {
      results.push(`✗ NOT FOUND: ${mapping.businessName}`)
    }
  }

  await logAudit({
    userId: actor.id,
    action: 'update',
    entityType: 'retail_location',
    changes: { updated, skipped, total: photoMappings.length },
  })

  return NextResponse.json({
    success: true,
    updated,
    skipped,
    total: photoMappings.length,
    results,
  })
}
