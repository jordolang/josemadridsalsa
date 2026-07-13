import { redirect } from 'next/navigation'
import type { Metadata } from 'next'
import Link from 'next/link'
import { MapPin, Plus, Search } from 'lucide-react'

import { getCurrentUser, hasPermission } from '@/lib/rbac'
import prisma from '@/lib/prisma'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Card, CardContent } from '@/components/ui/card'
import { Input } from '@/components/ui/input'
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table'
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
          <h1 className="text-2xl font-bold tracking-tight">
            Retail Locations
          </h1>
          <p className="text-sm text-muted-foreground">
            Manage where Jose Madrid Salsa products are sold
          </p>
        </div>
        <div className="flex items-center gap-3">
          <FetchPhotosButton />
          <Button asChild>
            <Link href="/admin/locations/new">
              <Plus className="mr-2 size-4" />
              Add Location
            </Link>
          </Button>
        </div>
      </div>

      {/* Filters */}
      <Card>
        <CardContent className="space-y-4 pt-6">
          <div className="flex flex-wrap gap-3">
            {/* Search */}
            <div className="relative min-w-[200px] flex-1">
              <Search className="absolute left-3 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" />
              <form action="/admin/locations" method="get">
                <Input
                  name="search"
                  placeholder="Search business name, city, or address..."
                  defaultValue={params.search}
                  className="pl-9"
                />
              </form>
            </div>

            {/* Active Filter */}
            <div className="flex items-center gap-2">
              <Button
                asChild
                variant={
                  !params.isActive || params.isActive === 'all'
                    ? 'default'
                    : 'outline'
                }
                size="sm"
              >
                <Link href="/admin/locations?isActive=all">
                  All ({locations.length})
                </Link>
              </Button>
              <Button
                asChild
                variant={params.isActive === 'true' ? 'default' : 'outline'}
                size="sm"
              >
                <Link href="/admin/locations?isActive=true">
                  Active ({activeCount})
                </Link>
              </Button>
              <Button
                asChild
                variant={params.isActive === 'false' ? 'default' : 'outline'}
                size="sm"
              >
                <Link href="/admin/locations?isActive=false">
                  Inactive ({inactiveCount})
                </Link>
              </Button>
            </div>
          </div>

          {/* State Pills */}
          {states.length > 0 && (
            <div className="flex flex-wrap items-center gap-2">
              <span className="text-sm text-muted-foreground">States:</span>
              <Link href="/admin/locations">
                <Badge
                  variant={
                    !params.state || params.state === 'all'
                      ? 'default'
                      : 'outline'
                  }
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
                      variant={
                        params.state === state ? 'default' : 'outline'
                      }
                      className="cursor-pointer"
                    >
                      {state} ({count})
                    </Badge>
                  </Link>
                )
              })}
            </div>
          )}
        </CardContent>
      </Card>

      {/* Locations Table */}
      {locations.length === 0 ? (
        <Card>
          <CardContent className="py-12">
            <div className="text-center text-muted-foreground">
              <MapPin className="mx-auto mb-4 size-12 opacity-40" />
              <p className="text-lg font-medium text-foreground">
                No locations found
              </p>
              <p className="mt-1 text-sm">
                {params.search || params.state || params.city
                  ? 'Try adjusting your filters or search terms'
                  : 'Add your first retail location to get started'}
              </p>
              {!params.search && !params.state && !params.city && (
                <Button className="mt-4" asChild>
                  <Link href="/admin/locations/new">
                    <Plus className="mr-2 size-4" />
                    Add Location
                  </Link>
                </Button>
              )}
            </div>
          </CardContent>
        </Card>
      ) : (
        <div className="rounded-lg border">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Business Name</TableHead>
                <TableHead>Location</TableHead>
                <TableHead>Contact</TableHead>
                <TableHead className="text-right">Photos</TableHead>
                <TableHead>Status</TableHead>
                <TableHead className="text-right">Actions</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {locations.map((location) => (
                <TableRow key={location.id}>
                  <TableCell>
                    <div className="font-medium">{location.businessName}</div>
                    {location.county && (
                      <div className="text-xs text-muted-foreground">
                        {location.county} County
                      </div>
                    )}
                  </TableCell>
                  <TableCell>
                    <div className="text-sm">{location.address}</div>
                    <div className="text-sm text-muted-foreground">
                      {location.city}, {location.state}{' '}
                      {location.zipCode && location.zipCode}
                    </div>
                  </TableCell>
                  <TableCell>
                    <div className="space-y-1 text-sm">
                      {location.phone && <div>{location.phone}</div>}
                      {location.website && (
                        <a
                          href={location.website}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="text-primary hover:underline"
                        >
                          Website
                        </a>
                      )}
                      {!location.phone && !location.website && (
                        <span className="text-muted-foreground">-</span>
                      )}
                    </div>
                  </TableCell>
                  <TableCell className="text-right tabular-nums">
                    {location._count.photos > 0 ? (
                      location._count.photos
                    ) : (
                      <span className="text-muted-foreground">0</span>
                    )}
                  </TableCell>
                  <TableCell>
                    <Badge variant={location.isActive ? 'default' : 'outline'}>
                      {location.isActive ? 'Active' : 'Inactive'}
                    </Badge>
                  </TableCell>
                  <TableCell className="text-right">
                    <LocationActions location={location} />
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </div>
      )}
    </div>
  )
}
