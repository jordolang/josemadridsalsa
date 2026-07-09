/**
 * Bright Data provider.
 *
 * Wraps the three Bright Data products the lead-gen pipeline uses, each behind
 * a capability check so the rest of the code can prefer Bright Data when it's
 * configured and fall back to the existing providers (Browserless / SerpAPI /
 * local Chromium) when it isn't. Nothing here throws on missing credentials —
 * callers gate on the `is*Configured()` helpers.
 *
 *   • Scraping Browser  → CDP endpoint, drop-in for Browserless (browser.ts)
 *   • Web Unlocker      → raw-HTML fetch for the contact-parse stage
 *   • SERP API          → structured Google / Google Maps results for search
 *
 * Env vars (see .env.example):
 *   BRIGHTDATA_BROWSER_URL     full wss CDP endpoint for the Scraping Browser
 *   BRIGHTDATA_API_KEY         Bearer token for the unified /request API
 *   BRIGHTDATA_UNLOCKER_ZONE   Web Unlocker zone name (default "web_unlocker")
 *   BRIGHTDATA_SERP_ZONE       SERP API zone name (default "serp_api")
 */

const REQUEST_ENDPOINT = 'https://api.brightdata.com/request'
const DEFAULT_UNLOCKER_ZONE = 'web_unlocker'
const DEFAULT_SERP_ZONE = 'serp_api'

// SERP shapes shared with the search route so brightData.serpSearch() is a
// drop-in for the SerpAPI call it replaces.
export interface SerpOrganicResult {
  title?: string
  link?: string
  snippet?: string
  displayed_link?: string
}

export interface SerpLocalResult {
  title?: string
  address?: string
  phone?: string
  website?: string
  rating?: number
  reviews?: number
  type?: string
  gps_coordinates?: { latitude: number; longitude: number }
  place_id?: string
  links?: { directions?: string }
  thumbnail?: string
}

export interface SerpResponse {
  organic_results?: SerpOrganicResult[]
  local_results?: { places?: SerpLocalResult[] }
  search_information?: { total_results?: number }
  error?: string
}

export type SerpParams = Record<string, string | number>

function apiKey(): string | undefined {
  return process.env.BRIGHTDATA_API_KEY
}

/** Full wss CDP endpoint for the Scraping Browser, or null if not configured. */
export function brightDataBrowserEndpoint(): string | null {
  return process.env.BRIGHTDATA_BROWSER_URL || null
}

export function isUnlockerConfigured(): boolean {
  return Boolean(apiKey())
}

export function isSerpConfigured(): boolean {
  return Boolean(apiKey())
}

async function brightDataRequest(
  zone: string,
  url: string,
  format: 'raw' | 'json'
): Promise<Response> {
  return fetch(REQUEST_ENDPOINT, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${apiKey()}`,
    },
    body: JSON.stringify({ zone, url, format }),
  })
}

/**
 * Fetch a URL's fully-rendered HTML through the Web Unlocker, bypassing bot
 * detection and CAPTCHAs. Throws on transport / HTTP errors so callers can fall
 * back to the browser path.
 */
export async function fetchViaUnlocker(url: string): Promise<string> {
  const zone = process.env.BRIGHTDATA_UNLOCKER_ZONE || DEFAULT_UNLOCKER_ZONE
  const res = await brightDataRequest(zone, url, 'raw')
  if (!res.ok) {
    throw new Error(`Web Unlocker returned ${res.status} for ${url}`)
  }
  return res.text()
}

/**
 * Structured Google / Google Maps results via the SERP API. Builds the same
 * Google URL the SerpAPI call would target, appends `brd_json=1` so Bright Data
 * returns parsed JSON, and normalizes that into the SerpResponse shape. Field
 * names vary across Bright Data's parsers, so mapping is defensive.
 */
export async function serpSearch(params: SerpParams): Promise<SerpResponse> {
  const zone = process.env.BRIGHTDATA_SERP_ZONE || DEFAULT_SERP_ZONE
  const targetUrl = buildGoogleUrl(params)
  const res = await brightDataRequest(zone, targetUrl, 'json')
  if (!res.ok) {
    throw new Error(`SERP API returned ${res.status}`)
  }

  // With format:'json' the /request body is a JSON envelope whose `body` holds
  // the SERP payload (itself JSON because of brd_json=1). Tolerate both a
  // wrapped envelope and a bare payload.
  const raw = await res.json()
  const payload = typeof raw?.body === 'string' ? safeParse(raw.body) : raw.body ?? raw

  return normalizeSerp(payload)
}

function buildGoogleUrl(params: SerpParams): string {
  const engine = String(params.engine || 'google')
  const q = String(params.q || '')

  if (engine === 'google_maps') {
    const url = new URL(`https://www.google.com/maps/search/${encodeURIComponent(q)}`)
    url.searchParams.set('hl', String(params.hl || 'en'))
    url.searchParams.set('brd_json', '1')
    return url.toString()
  }

  const url = new URL('https://www.google.com/search')
  url.searchParams.set('q', q)
  if (params.location) url.searchParams.set('location', String(params.location))
  url.searchParams.set('hl', String(params.hl || 'en'))
  url.searchParams.set('gl', String(params.gl || 'us'))
  if (params.num) url.searchParams.set('num', String(params.num))
  if (params.start) url.searchParams.set('start', String(params.start))
  url.searchParams.set('brd_json', '1')
  return url.toString()
}

function safeParse(text: string): unknown {
  try {
    return JSON.parse(text)
  } catch {
    return {}
  }
}

function normalizeSerp(payload: unknown): SerpResponse {
  const p = (payload || {}) as Record<string, unknown>

  const organicRaw =
    (p.organic as unknown[]) || (p.organic_results as unknown[]) || []
  const organic_results: SerpOrganicResult[] = organicRaw.map((o) => {
    const r = o as Record<string, unknown>
    return {
      title: str(r.title),
      link: str(r.link) || str(r.url),
      snippet: str(r.description) || str(r.snippet),
      displayed_link: str(r.display_link) || str(r.displayed_link),
    }
  })

  // Bright Data surfaces map/local entries under a few different keys depending
  // on the parser; check the common ones.
  const localRaw =
    (p.local_results as unknown[]) ||
    (p.snack_pack as unknown[]) ||
    (p.places as unknown[]) ||
    (p.maps as unknown[]) ||
    []
  const places: SerpLocalResult[] = localRaw.map((o) => {
    const r = o as Record<string, unknown>
    return {
      title: str(r.title) || str(r.name),
      address: str(r.address),
      phone: str(r.phone),
      website: str(r.website) || str(r.link),
      rating: num(r.rating),
      reviews: num(r.reviews) ?? num(r.reviews_cnt),
      type: str(r.type) || str(r.category),
      place_id: str(r.place_id) || str(r.fid),
      links: { directions: str(r.directions) },
    }
  })

  return { organic_results, local_results: { places } }
}

function str(v: unknown): string | undefined {
  return typeof v === 'string' ? v : undefined
}

function num(v: unknown): number | undefined {
  if (typeof v === 'number') return v
  if (typeof v === 'string') {
    const n = parseFloat(v.replace(/,/g, ''))
    return Number.isNaN(n) ? undefined : n
  }
  return undefined
}
