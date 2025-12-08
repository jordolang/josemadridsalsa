import { NextRequest, NextResponse } from 'next/server'
import { revalidateTag } from 'next/cache'
import { prisma } from '@/lib/prisma'

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

export async function GET() {
  const locations = await prisma.retailLocation.findMany({
    orderBy: [
      { state: 'asc' },
      { city: 'asc' },
      { sortOrder: 'asc' },
      { businessName: 'asc' },
    ],
  })
  return NextResponse.json({ locations })
}

export async function POST(req: NextRequest) {
  const body = await req.json()
  const created = await prisma.retailLocation.create({
    data: {
      businessName: body.businessName,
      address: body.address,
      city: body.city,
      state: body.state,
      zipCode: body.zipCode || null,
      phone: body.phone || null,
      website: body.website || null,
      photoUrl: body.photoUrl || null,
      county: body.county || null,
      isActive: typeof body.isActive === 'boolean' ? body.isActive : true,
      sortOrder: parseSortOrder(body.sortOrder),
    },
  })
  revalidateTag('locations', '/')
  return NextResponse.json(created)
}
