import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';

export async function GET(request: NextRequest) {
  try {
    const searchParams = request.nextUrl.searchParams;
    const state = searchParams.get('state');
    const city = searchParams.get('city');
    const search = searchParams.get('search');

    // Build where clause
    const where: any = {
      isActive: true,
    };

    if (state) {
      where.state = {
        equals: state,
        mode: 'insensitive',
      };
    }

    if (city) {
      where.city = {
        equals: city,
        mode: 'insensitive',
      };
    }

    if (search) {
      where.businessName = {
        contains: search,
        mode: 'insensitive',
      };
    }

    // Query locations
    const locations = await prisma.retailLocation.findMany({
      where,
      orderBy: [
        { state: 'asc' },
        { city: 'asc' },
        { sortOrder: 'asc' },
        { businessName: 'asc' },
      ],
      take: 1000, // Cap at 1000 results
    });

    return NextResponse.json(locations);
  } catch (error) {
    console.error('Error fetching locations:', error);
    return NextResponse.json(
      { error: 'Failed to fetch locations' },
      { status: 500 }
    );
  }
}
