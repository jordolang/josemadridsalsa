import { NextResponse } from 'next/server'
import type { NextRequest } from 'next/server'
import { getFundraisingSiteUrl } from '@/lib/fundraising-site/host'

/**
 * Pages that moved to the fundraising app (apps/fundraising), which has its own
 * domain. Old links to them on this site redirect there, path and query intact.
 */
const FUNDRAISING_ROUTE_PREFIXES = [
  '/arena',
  '/auth/fundraiser-signup',
  '/f',
  '/fundraise',
  '/fundraiser-portal',
  '/fundraisers',
  '/fundraising',
  '/fundraising-site',
  '/game-icons',
  '/s',
]

/**
 * Where an old fundraiser path lives on the fundraising site. Its home page is
 * the old /fundraising landing page, so that one goes to the root.
 */
function fundraisingSitePath(pathname: string): string {
  if (pathname === '/fundraising' || pathname === '/fundraising/') return '/'
  if (pathname.startsWith('/fundraising-site')) return pathname.slice('/fundraising-site'.length) || '/'
  return pathname
}

/**
 * CMS-managed redirects.
 *
 * Editors add these in /admin/content/redirects and expect them live without a
 * deploy, which the build-time `redirects()` in next.config.mjs cannot do.
 *
 * This runs on every request, so it must never open a database connection: the
 * table is fetched from an internal route and held in module scope for 60
 * seconds. Next's fetch Data Cache is unavailable here, hence the explicit
 * cache. Any failure falls through to the normal response — a redirect table
 * that cannot be loaded must not take the site down.
 */
interface CmsRedirect {
  source: string
  destination: string
  permanent: boolean
}

const CACHE_TTL_MS = 60_000
/**
 * This fetch sits in front of every page render, so it is capped hard: a slow
 * or unreachable database must cost one page a couple of seconds at most, not
 * stall the site. On timeout the previous table keeps being served.
 */
const FETCH_TIMEOUT_MS = 2_000

let cachedRedirects: CmsRedirect[] = []
let cachedAt = 0
let inFlight: Promise<CmsRedirect[]> | null = null

async function loadRedirects(request: NextRequest): Promise<CmsRedirect[]> {
  if (cachedAt !== 0 && Date.now() - cachedAt < CACHE_TTL_MS) return cachedRedirects
  // Collapse concurrent refreshes so a burst of traffic triggers one fetch.
  if (inFlight) return inFlight

  inFlight = (async () => {
    try {
      const response = await fetch(new URL('/api/cms/redirects', request.url), {
        signal: AbortSignal.timeout(FETCH_TIMEOUT_MS),
      })
      if (response.ok) {
        const data = (await response.json()) as { redirects?: CmsRedirect[] }
        cachedRedirects = data.redirects ?? []
      }
    } catch {
      // Timed out or unreachable. Keep serving whatever is cached and retry
      // after the TTL rather than hammering a database that is struggling.
    } finally {
      cachedAt = Date.now()
      inFlight = null
    }
    return cachedRedirects
  })()

  return inFlight
}

/** Strip a trailing slash so `/old` and `/old/` match the same rule. */
function normalise(path: string): string {
  return path.length > 1 ? path.replace(/\/$/, '') : path
}

export default async function proxy(request: NextRequest) {
  const { pathname, search } = request.nextUrl
  const host = request.headers.get('x-forwarded-host') ?? request.headers.get('host') ?? request.nextUrl.host
  const isApiPath = pathname.startsWith('/api') || pathname.startsWith('/trpc')

  const isFundraisingRoute = FUNDRAISING_ROUTE_PREFIXES.some(
    (prefix) => pathname === prefix || pathname.startsWith(`${prefix}/`),
  )
  if (isFundraisingRoute) {
    const rest = fundraisingSitePath(pathname)
    const target = new URL(rest + search, getFundraisingSiteUrl())
    // Never redirect a host to itself: until its DNS moves, the fundraising
    // domain may still reach this app.
    if (target.host !== host) {
      return NextResponse.redirect(target, 308)
    }
  }

  // The matcher below also covers /api, which must be left alone — fetching
  // the redirect table from inside a request to it would recurse.
  if (!isApiPath) {
    const redirects = await loadRedirects(request)
    if (redirects.length > 0) {
      const target = normalise(pathname)
      const match = redirects.find((redirect) => normalise(redirect.source) === target)
      if (match) {
        const destination = match.destination.startsWith('/')
          ? new URL(`${match.destination}${search}`, request.url)
          : new URL(match.destination)
        // 308/307 preserve the request method, unlike 301/302.
        return NextResponse.redirect(destination, match.permanent ? 308 : 307)
      }
    }
  }

  // Forward the pathname on the *request* so server components can read it
  // through `headers()` (see lib/admin-auth.ts). Public-storefront components
  // must not: a `headers()` call under app/(public) opts the whole route out of
  // static rendering, which is why the announcement bar targets paths from
  // `usePathname()` on the client instead.
  const requestHeaders = new Headers(request.headers)
  requestHeaders.set('x-pathname', pathname)
  return NextResponse.next({ request: { headers: requestHeaders } })
}

export const config = {
  matcher: [
    // Skip Next.js internals and all static files, unless found in search params
    '/((?!_next|[^?]*\\.(?:html?|css|js(?!on)|jpe?g|webp|png|gif|svg|ttf|woff2?|ico|csv|docx?|xlsx?|zip|pdf|webmanifest)).*)',
    // Always run for API routes
    '/(api|trpc)(.*)',
  ],
}
