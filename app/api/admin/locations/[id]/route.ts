import { NextRequest, NextResponse } from 'next/server'
import { revalidateTag } from 'next/cache'
import { prisma } from '@/lib/prisma'

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
      isActive: body.isActive ?? true,
      sortOrder: body.sortOrder ?? 0,
    },
  })
  revalidateTag('locations')
  return NextResponse.json(updated)
}

export async function DELETE(_req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  await prisma.retailLocation.delete({ where: { id } })
  revalidateTag('locations')
  return NextResponse.json({ ok: true })
}

