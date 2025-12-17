'use client'

import { useEffect, useMemo, useState } from 'react'
import { useRouter, useSearchParams } from 'next/navigation'
import { Map, ListChecks, LocateFixed, Loader2 } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { Switch } from '@/components/ui/switch'
import { Badge } from '@/components/ui/badge'
import { cn } from '@/lib/utils'
import type { LocationFilters, NormalizedLocationFilters, RetailLocationRecord } from '@/lib/locations/shared'
import { normalizeFilters } from '@/lib/locations/shared'
import { useLocations, type LocationsMeta } from '@/hooks/useLocations'
import { LocationCard } from './LocationCard'
import { LocationsMap } from './LocationsMap'

const regionFormatter =
  typeof Intl !== 'undefined' && typeof (Intl as any).DisplayNames === 'function'
    ? new Intl.DisplayNames(['en'], { type: 'region' })
    : null

const formatStateLabel = (code: string) => {
  if (!regionFormatter || !code) return code
  try {
    // Try with US- prefix first (ISO 3166-2 format)
    return regionFormatter.of(`US-${code}`) || code
  } catch {
    // If that fails, just return the code as-is
    return code
  }
}

type LocationFacets = {
  states: Array<{ code: string; count: number }>
  citiesByState: Record<string, string[]>
}

type FindLocationsExperienceProps = {
  initialFilters: NormalizedLocationFilters
  initialLocations: RetailLocationRecord[]
  facets: LocationFacets
  initialMeta: LocationsMeta
  initialView: 'list' | 'map'
}

const serializeFilterState = (filters: NormalizedLocationFilters) => JSON.stringify(filters)

export function FindLocationsExperience({
  initialFilters,
  initialLocations,
  facets,
  initialMeta,
  initialView,
}: FindLocationsExperienceProps) {
  const router = useRouter()
  const searchParams = useSearchParams()
  const [filters, setFilters] = useState<NormalizedLocationFilters>(initialFilters)
  const [searchValue, setSearchValue] = useState(initialFilters.q ?? '')
  const [view, setView] = useState<'list' | 'map'>(initialView)
  const [selectedLocationId, setSelectedLocationId] = useState<string | null>(null)
  const [geoStatus, setGeoStatus] = useState<'idle' | 'pending' | 'error'>('idle')
  const [geoError, setGeoError] = useState<string | null>(null)

  const { locations, isLoading, isRefetching, error, meta } = useLocations(filters, {
    initialData: initialLocations,
    initialMeta,
  })

  const appliedFilters = meta?.appliedFilters ?? filters

  const currentCities = useMemo(() => {
    if (!appliedFilters.state) return []
    return facets.citiesByState[appliedFilters.state] ?? []
  }, [appliedFilters.state, facets.citiesByState])

  useEffect(() => {
    const params = searchParams
    const rawFilters: LocationFilters = {
      q: params.get('q') ?? undefined,
      state: params.get('state') ?? undefined,
      city: params.get('city') ?? undefined,
      sort: params.get('sort') === 'distance' ? 'distance' : 'alphabetical',
      lat: params.get('lat') ? Number(params.get('lat')) : undefined,
      lng: params.get('lng') ? Number(params.get('lng')) : undefined,
      hasWebsite: params.get('hasWebsite') === 'true' ? true : undefined,
      hasPhone: params.get('hasPhone') === 'true' ? true : undefined,
    }
    const nextFilters = normalizeFilters(rawFilters)
    const currentFingerprint = serializeFilterState(filters)
    const nextFingerprint = serializeFilterState(nextFilters)
    if (currentFingerprint !== nextFingerprint) {
      setFilters(nextFilters)
      setSearchValue(nextFilters.q ?? '')
    }
    const nextView = params.get('view') === 'map' ? 'map' : 'list'
    setView(nextView)
  }, [searchParams, filters])

  useEffect(() => {
    const handler = window.setTimeout(() => {
      setFilters((prev) => {
        const trimmed = searchValue.trim()
        const normalized = trimmed.length > 0 ? trimmed : undefined
        if (prev.q === normalized) {
          return prev
        }
        return { ...prev, q: normalized }
      })
    }, 350)

    return () => window.clearTimeout(handler)
  }, [searchValue])

  useEffect(() => {
    const params = new URLSearchParams()
    if (filters.q) params.set('q', filters.q)
    if (filters.state) params.set('state', filters.state)
    if (filters.city) params.set('city', filters.city)
    if (filters.sort === 'distance') params.set('sort', 'distance')
    if (typeof filters.lat === 'number') params.set('lat', filters.lat.toString())
    if (typeof filters.lng === 'number') params.set('lng', filters.lng.toString())
    if (filters.hasWebsite) params.set('hasWebsite', 'true')
    if (filters.hasPhone) params.set('hasPhone', 'true')
    if (view === 'map') params.set('view', 'map')

    const next = params.toString()
    if (next === searchParams.toString()) {
      return
    }
    router.replace(next ? `/find-us?${next}` : '/find-us', { scroll: false })
  }, [filters, view, router, searchParams])

  useEffect(() => {
    if (selectedLocationId && !locations.some((location) => location.id === selectedLocationId)) {
      setSelectedLocationId(null)
    }
  }, [locations, selectedLocationId])

  const handleFiltersChange = (patch: Partial<NormalizedLocationFilters>) => {
    setFilters((prev) => ({
      ...prev,
      ...patch,
      city: Object.prototype.hasOwnProperty.call(patch, 'state')
        ? undefined
        : Object.prototype.hasOwnProperty.call(patch, 'city')
          ? patch.city
          : prev.city,
    }))
  }

  const handleUseMyLocation = () => {
    if (!navigator.geolocation) {
      setGeoStatus('error')
      setGeoError('Geolocation is not supported in this browser.')
      return
    }

    setGeoStatus('pending')
    setGeoError(null)

    navigator.geolocation.getCurrentPosition(
      (position) => {
        setGeoStatus('idle')
        const nextLat = Number(position.coords.latitude.toFixed(5))
        const nextLng = Number(position.coords.longitude.toFixed(5))
        handleFiltersChange({
          lat: nextLat,
          lng: nextLng,
          sort: 'distance',
        })
      },
      (geoErr) => {
        setGeoStatus('error')
        setGeoError(geoErr.message || 'Unable to determine your location.')
      },
      { timeout: 10000, maximumAge: 60000 },
    )
  }

  const resetFilters = () => {
    setFilters({ sort: 'alphabetical' })
    setSearchValue('')
    setSelectedLocationId(null)
    setGeoError(null)
  }

  const activeCount = locations.length
  const totalCount = meta?.total ?? initialMeta.total

  return (
    <section className="space-y-6 sm:space-y-8">
      <div className="card surface-shadow p-4 sm:p-6">
        <div className="flex flex-col gap-4 sm:gap-6 lg:flex-row lg:items-end">
          <div className="flex-1 space-y-4">
            <label className="space-y-2">
              <span className="text-xs font-semibold uppercase tracking-[0.2em] text-muted-foreground">Search</span>
              <Input
                value={searchValue}
                onChange={(event) => setSearchValue(event.target.value)}
                placeholder="Search by store, city, or address"
              />
            </label>

            <div className="grid gap-4 sm:grid-cols-2">
              <label className="space-y-2">
                <span className="text-xs font-semibold uppercase tracking-[0.2em] text-muted-foreground">State</span>
                <Select value={appliedFilters.state ?? 'all'} onValueChange={(value) => handleFiltersChange({ state: value === 'all' ? undefined : value })}>
                  <SelectTrigger>
                    <SelectValue placeholder="All states" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all">All states</SelectItem>
                    {facets.states.map((state) => (
                      <SelectItem key={state.code} value={state.code}>
                        {formatStateLabel(state.code)} ({state.count})
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </label>

              <label className="space-y-2">
                <span className="text-xs font-semibold uppercase tracking-[0.2em] text-muted-foreground">City</span>
                <Select
                  value={appliedFilters.city ?? 'all'}
                  onValueChange={(value) => handleFiltersChange({ city: value === 'all' ? undefined : value })}
                  disabled={!appliedFilters.state}
                >
                  <SelectTrigger>
                    <SelectValue placeholder={appliedFilters.state ? 'All cities' : 'Select a state first'} />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all">All cities</SelectItem>
                    {currentCities.map((city) => (
                      <SelectItem key={city} value={city}>
                        {city}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </label>
            </div>

            <div className="grid gap-4 sm:grid-cols-2">
              <label className="flex items-center justify-between rounded-2xl border border-border bg-muted/30 px-4 py-3">
                <div>
                  <p className="text-sm font-semibold text-foreground">Has website</p>
                  <p className="text-xs text-muted-foreground">Show stores with a published site</p>
                </div>
                <Switch checked={Boolean(appliedFilters.hasWebsite)} onCheckedChange={(checked) => handleFiltersChange({ hasWebsite: checked ? true : undefined })} />
              </label>

              <label className="flex items-center justify-between rounded-2xl border border-border bg-muted/30 px-4 py-3">
                <div>
                  <p className="text-sm font-semibold text-foreground">Has phone</p>
                  <p className="text-xs text-muted-foreground">Show stores with a phone number</p>
                </div>
                <Switch checked={Boolean(appliedFilters.hasPhone)} onCheckedChange={(checked) => handleFiltersChange({ hasPhone: checked ? true : undefined })} />
              </label>
            </div>
          </div>

          <div className="flex flex-col gap-3">
            <Button onClick={handleUseMyLocation} variant="outline" disabled={geoStatus === 'pending'}>
              {geoStatus === 'pending' ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <LocateFixed className="mr-2 h-4 w-4" />}
              Use my location
            </Button>
            <Button variant="ghost" onClick={resetFilters} className="text-sm text-muted-foreground">
              Reset filters
            </Button>
            {geoError ? <p className="text-xs text-red-600">{geoError}</p> : null}
          </div>
        </div>
      </div>

      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="space-y-1">
          <p className="text-sm text-muted-foreground">
            {error ? 'Unable to load locations right now.' : `Showing ${activeCount} of ${totalCount} locations`}
          </p>
          {appliedFilters.sort === 'distance' && typeof appliedFilters.lat === 'number' && typeof appliedFilters.lng === 'number' ? (
            <Badge variant="secondary" className="bg-verde-50 text-verde-700">
              Sorted by distance from you
            </Badge>
          ) : null}
        </div>

        <div className="flex items-center gap-2 rounded-full border border-border bg-white p-1 shadow-sm">
          <button
            type="button"
            className={cn(
              'flex items-center gap-2 rounded-full px-4 py-2 text-sm font-medium transition',
              view === 'list' ? 'bg-salsa-600 text-white shadow' : 'text-muted-foreground',
            )}
            onClick={() => setView('list')}
          >
            <ListChecks className="h-4 w-4" /> List view
          </button>
          <button
            type="button"
            className={cn(
              'flex items-center gap-2 rounded-full px-4 py-2 text-sm font-medium transition',
              view === 'map' ? 'bg-salsa-600 text-white shadow' : 'text-muted-foreground',
            )}
            onClick={() => setView('map')}
          >
            <Map className="h-4 w-4" /> Map view
          </button>
        </div>
      </div>

      {error ? (
        <div className="rounded-2xl border border-red-200 bg-red-50 p-6 text-red-700">{error.message}</div>
      ) : view === 'map' ? (
        <LocationsMap locations={locations} selectedLocationId={selectedLocationId} onSelect={setSelectedLocationId} />
      ) : (
        <div>
          {isLoading ? (
            <div className="grid gap-3 sm:gap-4 sm:grid-cols-2 lg:grid-cols-3">
              {Array.from({ length: 6 }).map((_, index) => (
                <div key={index} className="h-64 animate-pulse rounded-2xl bg-muted" />
              ))}
            </div>
          ) : (
            <div className="grid gap-3 sm:gap-4 sm:grid-cols-2 lg:grid-cols-3">
              {locations.map((location) => (
                <LocationCard
                  key={location.id}
                  location={location}
                  onSelect={() => setSelectedLocationId(location.id)}
                  isSelected={selectedLocationId === location.id}
                />
              ))}
            </div>
          )}

          {locations.length === 0 && !isLoading ? (
            <div className="mt-6 rounded-2xl border border-dashed border-muted-foreground/40 p-8 text-center">
              <p className="text-sm text-muted-foreground">No locations match those filters. Try adjusting the search.</p>
            </div>
          ) : null}
        </div>
      )}

      {isRefetching ? (
        <div className="flex items-center gap-2 text-xs text-muted-foreground">
          <Loader2 className="h-3 w-3 animate-spin" /> Refreshing results…
        </div>
      ) : null}
    </section>
  )
}
