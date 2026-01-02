import { NextRequest, NextResponse } from 'next/server'
import { filterLocationsFromDB } from '@/lib/locations/db-query'

const CACHE_CONTROL_HEADER = 's-maxage=3600, stale-while-revalidate=300'

const parseNumber = (value: string | null) => {
  if (!value) return undefined
  const parsed = Number(value)
  return Number.isFinite(parsed) ? parsed : undefined
}

const parseBoolean = (value: string | null) => {
  if (value === null) return undefined
  if (value === 'true') return true
  if (value === 'false') return false
  return undefined
}

function parseFilters(searchParams: URLSearchParams) {
  const sortParam = searchParams.get('sort')
  const sort: 'alphabetical' | 'distance' = sortParam === 'distance' ? 'distance' : 'alphabetical'

  return {
    q: searchParams.get('q') ?? searchParams.get('search') ?? undefined,
    state: searchParams.get('state') ?? undefined,
    city: searchParams.get('city') ?? undefined,
    sort,
    lat: parseNumber(searchParams.get('lat') ?? searchParams.get('latitude')),
    lng: parseNumber(searchParams.get('lng') ?? searchParams.get('longitude')),
    hasWebsite: parseBoolean(searchParams.get('hasWebsite')),
    hasPhone: parseBoolean(searchParams.get('hasPhone')),
  }
}

export async function GET(request: NextRequest) {
  try {
    const filters = parseFilters(request.nextUrl.searchParams)
    const result = await filterLocationsFromDB(filters)

    const response = NextResponse.json({
      data: result.locations,
      meta: {
        total: result.total,
        appliedFilters: result.appliedFilters,
      },
    })

    response.headers.set('Cache-Control', CACHE_CONTROL_HEADER)
    return response
  } catch (error) {
    console.error('Error fetching locations:', error)
    return NextResponse.json({ error: 'Failed to fetch locations' }, { status: 500 })
  }
}
