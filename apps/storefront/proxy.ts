import { NextResponse } from 'next/server'
import type { NextRequest } from 'next/server'

const FUNDRAISING_ROUTE_PREFIXES = [
  '/arena',
  '/f',
  '/fundraise',
  '/fundraiser-portal',
  '/fundraisers',
  '/fundraising',
]

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

let cachedRedirects: CmsRedirect[] = []
let cachedAt = 0
let inFlight: Promise<CmsRedirect[]> | null = null

async function loadRedirects(request: NextRequest): Promise<CmsRedirect[]> {
  if (cachedAt !== 0 && Date.now() - cachedAt < CACHE_TTL_MS) return cachedRedirects
  // Collapse concurrent refreshes so a burst of traffic triggers one fetch.
  if (inFlight) return inFlight

  inFlight = (async () => {
    try {
      const response = await fetch(new URL('/api/cms/redirects', request.url))
      if (response.ok) {
        const data = (await response.json()) as { redirects?: CmsRedirect[] }
        cachedRedirects = data.redirects ?? []
      }
    } catch {
      // Keep serving whatever is cached; retry after the TTL.
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

  const fundraisingOrigin = process.env.FUNDRAISING_APP_ORIGIN
  const isFundraisingRoute = FUNDRAISING_ROUTE_PREFIXES.some(
    (prefix) => pathname === prefix || pathname.startsWith(`${prefix}/`),
  )
  const isFundraisingAppProxy = request.nextUrl.searchParams.get('fundraising-app-proxy') === '1'

  if (fundraisingOrigin && isFundraisingRoute && !isFundraisingAppProxy) {
    const target = new URL(pathname + search, fundraisingOrigin)
    const requestHost = request.headers.get('x-forwarded-host') ?? request.nextUrl.host

    if (target.host !== requestHost) {
      return NextResponse.redirect(target)
    }
  }

  // The matcher below also covers /api, which must be left alone — fetching
  // the redirect table from inside a request to it would recurse.
  const isApiRoute = pathname.startsWith('/api') || pathname.startsWith('/trpc')

  if (!isApiRoute) {
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
  // through `headers()`; announcements and banners are targeted by path, and a
  // layout has no other way to know which page it is rendering.
  const requestHeaders = new Headers(request.headers)
  requestHeaders.set('x-pathname', pathname)
  return NextResponse.next({ request: { headers: requestHeaders } })
}

export const config = {
  matcher: [
    // Skip Next.js internals and all static files, unless found in search params
    '/((?!_next|[^?]*\\.(?:html?|css|js(?!on)|jpe?g|webp|png|gif|svg|ttf|woff2?|ico|csv|docx?|xlsx?|zip|webmanifest)).*)',
    // Always run for API routes
    '/(api|trpc)(.*)',
  ],
}
