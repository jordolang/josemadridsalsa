import { Metadata } from 'next'
import { MapPin } from 'lucide-react'
import { createMetadata } from '@/lib/metadata'
import { FindLocationsExperience } from './_components/FindLocationsExperience'
import {
  getAllLocationsFromDB,
  getLocationFacetsFromDB,
  filterLocationsFromDB,
} from '@/lib/locations/db-query'
import { normalizeFilters } from '@/lib/locations/shared'
import type { LocationFilters } from '@/lib/locations/shared'

export const metadata: Metadata = createMetadata({
  title: 'Find Us Locally - Jose Madrid Salsa',
  description:
    'Find Jose Madrid Salsa at retail stores near you. Browse our locations by city and state across Ohio, Pennsylvania, Kentucky, Michigan, Indiana, and Wisconsin.',
  pathname: '/find-us',
})

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'

type FindUsPageProps = {
  searchParams: Promise<Record<string, string | string[] | undefined>>
}

const extractParam = (params: Record<string, string | string[] | undefined> | undefined, key: string) => {
  const value = params?.[key]
  if (Array.isArray(value)) return value[0]
  return value ?? undefined
}

const parseNumberParam = (value?: string) => {
  if (!value) return undefined
  const parsed = Number(value)
  return Number.isFinite(parsed) ? parsed : undefined
}

export default async function FindUsPage({ searchParams }: FindUsPageProps) {
  let allLocations: any[] = [];
  let facets: { states: Array<{ code: string; count: number }>, citiesByState: Record<string, string[]> };
  let initialResult: { locations: any[], total: number, appliedFilters: any };
  let totalLocations: number;
  let ohioLocations: number;
  let uniqueStates: number;
  let initialFilters: LocationFilters;
  let initialView: "map" | "list" = "list";

  try {
    console.log('[FindUsPage] Starting page render...');
    const params = await searchParams;
    const rawFilters: LocationFilters = {
      q: extractParam(params, 'q'),
      state: extractParam(params, 'state'),
      city: extractParam(params, 'city'),
      sort: extractParam(params, 'sort') === 'distance' ? 'distance' : 'alphabetical',
      lat: parseNumberParam(extractParam(params, 'lat')),
      lng: parseNumberParam(extractParam(params, 'lng')),
      hasWebsite: extractParam(params, 'hasWebsite') === 'true' ? true : undefined,
      hasPhone: extractParam(params, 'hasPhone') === 'true' ? true : undefined,
    }

    console.log('[FindUsPage] Normalizing filters...');
    initialFilters = normalizeFilters(rawFilters)

    console.log('[FindUsPage] Calling getAllLocationsFromDB...');
    allLocations = await getAllLocationsFromDB()
    console.log('[FindUsPage] Got', allLocations.length, 'locations from database');

    if (!allLocations || allLocations.length === 0) {
      console.warn('[FindUsPage] No locations returned, using empty array');
      allLocations = [];
    }

    console.log('[FindUsPage] Getting facets from database...');
    const dbFacets = await getLocationFacetsFromDB()

    // Transform facets to match expected format
    facets = {
      states: dbFacets.states,
      citiesByState: dbFacets.cities.reduce((acc, city) => {
        if (!acc[city.state]) {
          acc[city.state] = []
        }
        acc[city.state].push(city.name)
        return acc
      }, {} as Record<string, string[]>),
    }

    console.log('[FindUsPage] Filtering locations from database...');
    initialResult = await filterLocationsFromDB(initialFilters)

    totalLocations = allLocations.length
    ohioLocations = allLocations.filter((location) => location.state === 'OH').length
    uniqueStates = facets.states.length
    initialView = (extractParam(params, 'view') === 'map' ? 'map' : 'list') as "map" | "list"
    
    console.log('[FindUsPage] Page render complete');
  } catch (error) {
    console.error('[FindUsPage] ERROR during page render:', error);
    // Provide fallback values
    allLocations = [];
    facets = { states: [], citiesByState: {} };
    initialFilters = normalizeFilters({});
    initialResult = { locations: [], total: 0, appliedFilters: initialFilters };
    totalLocations = 0;
    ohioLocations = 0;
    uniqueStates = 0;
    initialView = 'list';
  }

  return (
    <div className="min-h-screen bg-background">
      <section className="relative bg-gradient-to-r from-salsa-600 via-salsa-500 to-chile-600 text-white">
        <div className="absolute inset-0 bg-black/10" />
        <div className="relative container mx-auto px-4 py-16 lg:py-24">
          <div className="max-w-4xl mx-auto text-center">
            <MapPin className="w-16 h-16 mx-auto mb-6 text-white/90" />
            <h1 className="text-4xl lg:text-6xl font-serif font-bold mb-6 text-shadow-lg">Find Us Locally</h1>
            <p className="text-xl lg:text-2xl text-salsa-100 max-w-2xl mx-auto leading-relaxed">
              Discover Jose Madrid Salsa at retail stores near you. Available at {totalLocations} locations across {uniqueStates}{' '}
              state{uniqueStates === 1 ? '' : 's'}.
            </p>
            <div className="mt-8 grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
              <article className="rounded-2xl bg-white/10 p-4 text-left">
                <p className="text-xs uppercase tracking-[0.2em] text-white/80">Total locations</p>
                <p className="text-3xl font-semibold">{totalLocations}</p>
              </article>
              <article className="rounded-2xl bg-white/10 p-4 text-left">
                <p className="text-xs uppercase tracking-[0.2em] text-white/80">Ohio locations</p>
                <p className="text-3xl font-semibold">{ohioLocations}</p>
              </article>
              <article className="rounded-2xl bg-white/10 p-4 text-left">
                <p className="text-xs uppercase tracking-[0.2em] text-white/80">States covered</p>
                <p className="text-3xl font-semibold">{uniqueStates}</p>
              </article>
              <article className="rounded-2xl bg-white/10 p-4 text-left">
                <p className="text-xs uppercase tracking-[0.2em] text-white/80">Locations/page refresh</p>
                <p className="text-3xl font-semibold">60 min</p>
              </article>
            </div>
          </div>
        </div>
      </section>

      <section className="py-16">
        <div className="container mx-auto px-4">
          <div className="mx-auto max-w-7xl space-y-16">
            <FindLocationsExperience
              initialFilters={initialResult.appliedFilters}
              initialLocations={initialResult.locations}
              facets={facets}
              initialMeta={{ total: initialResult.total, appliedFilters: initialResult.appliedFilters }}
              initialView={initialView}
            />

            <div className="grid gap-6 rounded-2xl border border-border bg-muted/30 p-6 sm:grid-cols-2 lg:grid-cols-3">
              <div>
                <p className="text-xs uppercase tracking-[0.2em] text-muted-foreground">Shareable filters</p>
                <p className="mt-1 text-base text-foreground">Each search updates the URL so you can send tailored results to retail partners.</p>
              </div>
              <div>
                <p className="text-xs uppercase tracking-[0.2em] text-muted-foreground">Hourly refresh</p>
                <p className="mt-1 text-base text-foreground">Location data is cached for one hour and automatically revalidated after admin updates.</p>
              </div>
              <div>
                <p className="text-xs uppercase tracking-[0.2em] text-muted-foreground">Map + list sync</p>
                <p className="mt-1 text-base text-foreground">Selecting a card or pin keeps both views aligned so shoppers can navigate faster.</p>
              </div>
            </div>
          </div>
        </div>
      </section>
    </div>
  )
}
