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

export default function proxy(request: NextRequest) {
  const fundraisingOrigin = process.env.FUNDRAISING_APP_ORIGIN
  const isFundraisingRoute = FUNDRAISING_ROUTE_PREFIXES.some(
    (prefix) => request.nextUrl.pathname === prefix || request.nextUrl.pathname.startsWith(`${prefix}/`),
  )
  const isFundraisingAppProxy = request.nextUrl.searchParams.get('fundraising-app-proxy') === '1'

  if (fundraisingOrigin && isFundraisingRoute && !isFundraisingAppProxy) {
    const target = new URL(request.nextUrl.pathname + request.nextUrl.search, fundraisingOrigin)
    const requestHost = request.headers.get('x-forwarded-host') ?? request.nextUrl.host

    if (target.host !== requestHost) {
      return NextResponse.redirect(target)
    }
  }

  return NextResponse.next()
}

export const config = {
  matcher: [
    // Skip Next.js internals and all static files, unless found in search params
    '/((?!_next|[^?]*\\.(?:html?|css|js(?!on)|jpe?g|webp|png|gif|svg|ttf|woff2?|ico|csv|docx?|xlsx?|zip|webmanifest)).*)',
    // Always run for API routes
    '/(api|trpc)(.*)',
  ],
}
