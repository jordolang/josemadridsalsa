import { redirect } from 'next/navigation'
import type { Metadata } from 'next'
import { getCurrentUser, hasPermission } from '@/lib/rbac'
import prisma from '@/lib/prisma'
import { Card } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { Input } from '@/components/ui/input'
import { Plus, MapPin, Search } from 'lucide-react'
import Link from 'next/link'
import { LocationActions } from './_components/LocationActions'
import { FetchPhotosButton } from './_components/FetchPhotosButton'
import { createMetadata } from '@/lib/metadata'

export const metadata: Metadata = createMetadata({
  title: 'Locations - Jose Madrid Salsa Admin',
  description: 'Manage retail store locations.',
  pathname: '/admin/locations',
})

type SearchParams = {
  state?: string
  city?: string
  search?: string
  isActive?: string
}

async function getLocations(searchParams: SearchParams) {
  const where: any = {}

  // Filter by state
  if (searchParams.state && searchParams.state !== 'all') {
    where.state = searchParams.state
  }

  // Filter by city
  if (searchParams.city) {
    where.city = {
      contains: searchParams.city,
      mode: 'insensitive',
    }
  }

  // Filter by active status
  if (searchParams.isActive !== undefined && searchParams.isActive !== 'all') {
    where.isActive = searchParams.isActive === 'true'
  }

  // Search across multiple fields
  if (searchParams.search) {
    where.OR = [
      {
        businessName: {
          contains: searchParams.search,
          mode: 'insensitive',
        },
      },
      {
        city: {
          contains: searchParams.search,
          mode: 'insensitive',
        },
      },
      {
        address: {
          contains: searchParams.search,
          mode: 'insensitive',
        },
      },
    ]
  }

  const locations = await prisma.retailLocation.findMany({
    where,
    orderBy: [
      { state: 'asc' },
      { city: 'asc' },
      { sortOrder: 'asc' },
      { businessName: 'asc' },
    ],
    include: {
      _count: {
        select: {
          photos: true,
        },
      },
    },
  })

  // Get unique states for filter
  const states = await prisma.retailLocation.findMany({
    select: { state: true },
    distinct: ['state'],
    orderBy: { state: 'asc' },
  })

  return { locations, states: states.map((s) => s.state) }
}

export default async function AdminLocationsPage({
  searchParams,
}: {
  searchParams: Promise<SearchParams>
}) {
  const params = await searchParams
  const user = await getCurrentUser()

  if (!user || !(await hasPermission(user, 'content:read'))) {
    redirect('/admin')
  }

  const { locations, states } = await getLocations(params)

  const activeCount = locations.filter((l) => l.isActive).length
  const inactiveCount = locations.filter((l) => !l.isActive).length

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold">Retail Locations</h1>
          <p className="text-slate-600">
            Manage where Jose Madrid Salsa products are sold
          </p>
        </div>
        <div className="flex items-center gap-3">
          <FetchPhotosButton />
          <Button asChild>
            <Link href="/admin/locations/new">
              <Plus className="mr-2 h-4 w-4" />
              Add Location
            </Link>
          </Button>
        </div>
      </div>

      {/* Filters */}
      <Card className="p-4">
        <div className="space-y-4">
          <div className="flex flex-wrap gap-3">
            {/* Search */}
            <div className="relative flex-1 min-w-[200px]">
              <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
              <form action="/admin/locations" method="get">
                <Input
                  name="search"
                  placeholder="Search business name, city, or address..."
                  defaultValue={params.search}
                  className="pl-10"
                />
              </form>
            </div>

            {/* State Filter */}
            <div className="flex items-center gap-2">
              <Link href="/admin/locations?isActive=all">
                <Button
                  variant={
                    !params.isActive || params.isActive === 'all'
                      ? 'default'
                      : 'outline'
                  }
                  size="sm"
                >
                  All ({locations.length})
                </Button>
              </Link>
              <Link href="/admin/locations?isActive=true">
                <Button
                  variant={params.isActive === 'true' ? 'default' : 'outline'}
                  size="sm"
                >
                  Active ({activeCount})
                </Button>
              </Link>
              <Link href="/admin/locations?isActive=false">
                <Button
                  variant={params.isActive === 'false' ? 'default' : 'outline'}
                  size="sm"
                >
                  Inactive ({inactiveCount})
                </Button>
              </Link>
            </div>
          </div>

          {/* State Pills */}
          {states.length > 0 && (
            <div className="flex flex-wrap gap-2">
              <span className="text-sm text-slate-500">States:</span>
              <Link href="/admin/locations">
                <Badge
                  variant={!params.state || params.state === 'all' ? 'default' : 'outline'}
                  className="cursor-pointer"
                >
                  All
                </Badge>
              </Link>
              {states.map((state) => {
                const count = locations.filter((l) => l.state === state).length
                return (
                  <Link key={state} href={`/admin/locations?state=${state}`}>
                    <Badge
                      variant={params.state === state ? 'default' : 'outline'}
                      className="cursor-pointer"
                    >
                      {state} ({count})
                    </Badge>
                  </Link>
                )
              })}
            </div>
          )}
        </div>
      </Card>

      {/* Locations Table */}
      {locations.length === 0 ? (
        <Card className="p-12">
          <div className="text-center text-slate-500">
            <MapPin className="mx-auto mb-4 h-12 w-12 text-slate-300" />
            <p className="text-lg font-medium">No locations found</p>
            <p className="mt-1 text-sm">
              {params.search || params.state || params.city
                ? 'Try adjusting your filters or search terms'
                : 'Add your first retail location to get started'}
            </p>
            {!params.search && !params.state && !params.city && (
              <Button className="mt-4" asChild>
                <Link href="/admin/locations/new">
                  <Plus className="mr-2 h-4 w-4" />
                  Add Location
                </Link>
              </Button>
            )}
          </div>
        </Card>
      ) : (
        <Card className="overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full">
              <thead className="border-b bg-slate-50">
                <tr>
                  <th className="px-4 py-3 text-left text-sm font-medium text-slate-600">
                    Business Name
                  </th>
                  <th className="px-4 py-3 text-left text-sm font-medium text-slate-600">
                    Location
                  </th>
                  <th className="px-4 py-3 text-left text-sm font-medium text-slate-600">
                    Contact
                  </th>
                  <th className="px-4 py-3 text-left text-sm font-medium text-slate-600">
                    Photos
                  </th>
                  <th className="px-4 py-3 text-left text-sm font-medium text-slate-600">
                    Status
                  </th>
                  <th className="px-4 py-3 text-right text-sm font-medium text-slate-600">
                    Actions
                  </th>
                </tr>
              </thead>
              <tbody className="divide-y">
                {locations.map((location) => (
                  <tr key={location.id} className="hover:bg-slate-50">
                    <td className="px-4 py-3">
                      <div className="font-medium">{location.businessName}</div>
                      {location.county && (
                        <div className="text-xs text-slate-500">
                          {location.county} County
                        </div>
                      )}
                    </td>
                    <td className="px-4 py-3">
                      <div className="text-sm">{location.address}</div>
                      <div className="text-sm text-slate-500">
                        {location.city}, {location.state}{' '}
                        {location.zipCode && location.zipCode}
                      </div>
                    </td>
                    <td className="px-4 py-3">
                      <div className="space-y-1 text-sm">
                        {location.phone && (
                          <div className="text-slate-700">{location.phone}</div>
                        )}
                        {location.website && (
                          <a
                            href={location.website}
                            target="_blank"
                            rel="noopener noreferrer"
                            className="text-salsa-600 hover:underline"
                          >
                            Website
                          </a>
                        )}
                        {!location.phone && !location.website && (
                          <span className="text-slate-400">-</span>
                        )}
                      </div>
                    </td>
                    <td className="px-4 py-3">
                      <div className="flex items-center gap-1 text-sm">
                        {location._count.photos > 0 ? (
                          <>
                            <MapPin className="h-4 w-4 text-slate-400" />
                            <span>{location._count.photos}</span>
                          </>
                        ) : (
                          <span className="text-slate-400">0</span>
                        )}
                      </div>
                    </td>
                    <td className="px-4 py-3">
                      <Badge
                        variant={location.isActive ? 'default' : 'outline'}
                        className={
                          location.isActive
                            ? 'bg-green-100 text-green-800'
                            : 'bg-slate-100 text-slate-600'
                        }
                      >
                        {location.isActive ? 'Active' : 'Inactive'}
                      </Badge>
                    </td>
                    <td className="px-4 py-3 text-right">
                      <LocationActions location={location} />
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </Card>
      )}
    </div>
  )
}
