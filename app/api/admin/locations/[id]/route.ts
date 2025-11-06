import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'

export async function GET(_req: NextRequest, { params }: { params: { id: string } }) {
  const location = await prisma.retailLocation.findUnique({ where: { id: params.id } })
  if (!location) return NextResponse.json({ error: 'Not found' }, { status: 404 })
  return NextResponse.json(location)
}

export async function PUT(req: NextRequest, { params }: { params: { id: string } }) {
  const body = await req.json()
  const updated = await prisma.retailLocation.update({
    where: { id: params.id },
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
      isActive: body.isActive ?? true,
      sortOrder: body.sortOrder ?? 0,
    },
  })
  return NextResponse.json(updated)
}

export async function DELETE(_req: NextRequest, { params }: { params: { id: string } }) {
  await prisma.retailLocation.delete({ where: { id: params.id } })
  return NextResponse.json({ ok: true })
}


