import { NextRequest, NextResponse } from 'next/server'
import { revalidateTag } from 'next/cache'
import { prisma } from '@/lib/prisma'

const CACHE_PROFILE = 'default'

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

export async function GET(_req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const location = await prisma.retailLocation.findUnique({ where: { id } })
  if (!location) return NextResponse.json({ error: 'Not found' }, { status: 404 })
  return NextResponse.json(location)
}

export async function PUT(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const body = await req.json()
  const updated = await prisma.retailLocation.update({
    where: { id },
    data: {
      businessName: body.businessName,
      address: body.address,
      city: body.city,
      state: body.state,
      zipCode: body.zipCode ?? null,
      phone: body.phone ?? null,
      website: body.website ?? null,
      photoUrl: body.photoUrl ?? null,
      county: body.county ?? null,
      isActive: typeof body.isActive === 'boolean' ? body.isActive : true,
      sortOrder: parseSortOrder(body.sortOrder),
    },
  })
<<<<<<< HEAD
  revalidateTag('locations', CACHE_PROFILE)
=======
  revalidateTag('locations', '/')
>>>>>>> a914b70e48c74fb30ffafd6a685d5d84da8bcb1d
  return NextResponse.json(updated)
}

export async function DELETE(_req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  await prisma.retailLocation.delete({ where: { id } })
<<<<<<< HEAD
  revalidateTag('locations', CACHE_PROFILE)
=======
  revalidateTag('locations', '/')
>>>>>>> a914b70e48c74fb30ffafd6a685d5d84da8bcb1d
  return NextResponse.json({ ok: true })
}
