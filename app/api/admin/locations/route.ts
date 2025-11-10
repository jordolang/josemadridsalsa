import { NextRequest, NextResponse } from 'next/server'
import { revalidateTag } from 'next/cache'
import { prisma } from '@/lib/prisma'

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
      isActive: body.isActive ?? true,
      sortOrder: body.sortOrder ?? 0,
    },
  })
  revalidateTag('locations')
  return NextResponse.json(created)
}

