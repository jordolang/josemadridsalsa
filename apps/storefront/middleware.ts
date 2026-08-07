import { NextRequest, NextResponse } from 'next/server'

/**
 * Two jobs, both cheap enough to run on every public request:
 *
 *  1. Apply CMS-managed redirects. Editors add these in the admin and expect
 *     them live without a deploy, which `next.config.mjs` redirects (baked in
 *     at build time) cannot do.
 *  2. Expose the current pathname as the `x-pathname` request header so server
 *     components can target content by path — announcements and banners are
 *     scoped this way, and a layout has no other way to read the path.
 *
 * Middleware must never open a database connection, so the redirect table is
 * fetched from an internal route and held in module scope for 60 seconds.
 * Next's fetch Data Cache is not available inside middleware, hence the
 * explicit cache here rather than `next: { revalidate }`.
 *
 * Any failure falls through to the normal response: a redirect table that
 * cannot be loaded must never take the site down.
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
  const age = Date.now() - cachedAt
  if (cachedAt !== 0 && age < CACHE_TTL_MS) return cachedRedirects
  // Collapse concurrent refreshes so a burst of traffic triggers one fetch.
  if (inFlight) return inFlight

  inFlight = (async () => {
    try {
      const response = await fetch(new URL('/api/cms/redirects', request.url), {
        cache: 'no-store',
      })
      if (response.ok) {
        const data = (await response.json()) as { redirects?: CmsRedirect[] }
        cachedRedirects = data.redirects ?? []
        cachedAt = Date.now()
      }
    } catch {
      // Keep serving whatever is already cached; retry on the next request.
      cachedAt = Date.now()
    } finally {
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

export async function middleware(request: NextRequest) {
  const { pathname, search } = request.nextUrl

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

  // Forward the pathname on the *request* so server components can read it
  // through `headers()`; setting it on the response would not reach them.
  const requestHeaders = new Headers(request.headers)
  requestHeaders.set('x-pathname', pathname)
  return NextResponse.next({ request: { headers: requestHeaders } })
}

export const config = {
  matcher: [
    /*
     * Every path except:
     *  - api routes (including the redirect table this middleware fetches,
     *    which would otherwise recurse)
     *  - Next.js internals and image optimisation
     *  - files with an extension (images, fonts, sitemap.xml, robots.txt)
     */
    '/((?!api|_next/static|_next/image|.*\\.[\\w]+$).*)',
  ],
}
