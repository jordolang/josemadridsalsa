import { NextRequest, NextResponse } from 'next/server'

const OLD_INTERNAL_PREFIX = '/fundraising-site'

export default function proxy(request: NextRequest) {
  const { pathname, search } = request.nextUrl

  // These pages used to be served from the main app under /fundraising-site.
  if (pathname === OLD_INTERNAL_PREFIX || pathname.startsWith(`${OLD_INTERNAL_PREFIX}/`)) {
    const rest = pathname.slice(OLD_INTERNAL_PREFIX.length) || '/'
    return NextResponse.redirect(new URL(rest + search, request.url), 308)
  }

  // Forward the pathname on the request so server components can read it
  // through `headers()` (the fundraiser portal layout does).
  const requestHeaders = new Headers(request.headers)
  requestHeaders.set('x-pathname', pathname)
  return NextResponse.next({ request: { headers: requestHeaders } })
}

export const config = {
  matcher: [
    // Skip Next.js internals and all static files, unless found in search params
    '/((?!_next|[^?]*\\.(?:html?|css|js(?!on)|jpe?g|webp|png|gif|svg|ttf|woff2?|ico|csv|docx?|xlsx?|zip|pdf|webmanifest)).*)',
  ],
}
