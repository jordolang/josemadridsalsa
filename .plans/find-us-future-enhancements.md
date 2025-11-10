# Plan: Enhance Find Us Discovery Experience

- **Source TODO**: `app/find-us/page.tsx:273`
- **Goal**: Implement search/filter controls, distance-based sorting, a map/list toggle, and caching for the location catalog rendered on `/find-us`.

## Context & Assumptions
- `/api/locations` already returns the canonical list; today the page fetches all entries at build time and renders a pure list grouped by state/city.
- Location records contain coordinates (`lat`/`lng` or can be inferred from address) plus metadata (businessName, address, etc.). If coordinates are missing, we will geocode once and persist via Prisma.
- Map provider: prefer Mapbox GL JS with a token stored in `NEXT_PUBLIC_MAPBOX_TOKEN`; fall back to Leaflet + OpenStreetMap if licensing is a concern.

## Implementation Steps
1. **Normalize the data API**
   - Extend `/api/locations` to accept query params (`q`, `state`, `city`, `hasClasses`, etc.) and to optionally return pre-sorted distances when `lat`/`lng` is provided.
   - Add server-side caching (`revalidateTag('locations')` or `unstable_cache`) with a 1h TTL so the Find Us page can request fresh data using `next: { revalidate: 3600, tags: ['locations'] }`.
   - Ensure Prisma query selects only needed fields and indexes support state/city lookups.
2. **Build the filter/search UI**
   - Create a `FindLocationsFilters` client component with controlled inputs (text search, state dropdown, optional city multi-select, toggles for services).
   - Store filter state in URL search params via `useRouter().replace` so the view is shareable; debounce text input before firing fetches.
   - Reuse the API hook below to refetch when filters change; show skeleton/loading states.
3. **Introduce a data hook with SWR/React Query**
   - Add `hooks/useLocations.ts` wrapping `useSWR` (keyed by serialized filters) to call `/api/locations` and expose `data`, `isLoading`, `error`, `refetch`.
   - Memoize derived structures (grouped by state/city) so both list and map views reuse them.
4. **Implement geolocation-based sorting**
   - Add a “Use my location” button that requests `navigator.geolocation`; on success, send coordinates to the API and update filter state with `sort=distance`.
   - On the server, compute great-circle distance (`haversine-distance`) and sort, returning the computed value alongside each location.
   - Handle permission denied/unavailable cases with inline messaging and gracefully fall back to alphabetic ordering.
5. **Add map/list toggle**
   - Create a client-side toggle (segmented control) stored in component state.
   - For the map view, render clustered markers with popovers that show the same `LocationCard` data; keep list view as-is but collapse sections when filtered.
   - Sync selected marker/list card to highlight both representations via shared `selectedLocationId` state.
6. **Improve caching & revalidation**
   - Have the API route set `Cache-Control: s-maxage=3600, stale-while-revalidate=300` for Vercel edge caching.
   - Provide an admin mutation or background job to call `revalidateTag('locations')` whenever inventory changes.

## Risks & Dependencies
- Map provider licensing + tokens must be in place before launch.
- Geolocation requires HTTPS and user consent; need UX copy for denial cases.
- API must expose coordinates; otherwise we need a migration + backfill to store them.

## Validation
- Unit test filter utility functions (search match, state/city grouping, distance sorting) with Vitest under `tests/find-us`.
- Add Playwright smoke test (or React Testing Library) to verify the toggle and filter interactions.
- Manual QA checklist: search for a city, enable geolocation, switch map/list, and confirm cached responses revalidate after admin updates.
