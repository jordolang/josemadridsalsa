import { NextResponse } from 'next/server'
import type { NextRequest } from 'next/server'
import { getToken } from 'next-auth/jwt'

const authSecret = process.env.NEXTAUTH_SECRET
const STAFF_ROLES = ['ADMIN', 'DEVELOPER', 'STAFF']

function buildCallbackUrl(request: NextRequest) {
  const callbackPath = `${request.nextUrl.pathname}${request.nextUrl.search}`
  const signInUrl = new URL('/auth/signin', request.url)
  signInUrl.searchParams.set('callbackUrl', callbackPath)
  return signInUrl
}

export async function middleware(request: NextRequest) {
  const { pathname } = request.nextUrl

  // Skip middleware for SEO files
  if (pathname === '/sitemap.xml' || pathname === '/robots.txt') {
    return NextResponse.next()
  }

  console.log('[Middleware] Request to:', pathname)

  // Block common WordPress probe paths (bots/scanners)
  const wordpressPaths = [
    '/wordpress',
    '/wp-admin',
    '/wp-content',
    '/wp-includes',
    '/wp-login.php',
    '/wp-config.php',
    '/xmlrpc.php',
    '/wp-cron.php',
    '/readme.html',
    '/license.txt',
    '/wp-load.php',
    '/wp-blog-header.php',
  ]

  if (wordpressPaths.some((path) => pathname.startsWith(path))) {
    return new NextResponse(null, { status: 404 })
  }

  // If the auth secret is not available (e.g. misconfigured environment),
  // skip middleware-based enforcement and allow server components / API
  // handlers to perform the authorization checks to avoid redirect loops.
  if (!authSecret) {
    return NextResponse.next()
  }

  // Protect /admin routes
  if (pathname.startsWith('/admin')) {
    console.log('[Middleware] Checking admin access for:', pathname)
    console.log('[Middleware] Cookies:', request.cookies.getAll().map(c => c.name))
    
    const token = await getToken({
      req: request,
      secret: authSecret,
    })

    console.log('[Middleware] Token found:', !!token)
    if (token) {
      console.log('[Middleware] Token role:', token.role)
      console.log('[Middleware] Token email:', token.email)
    }

    if (!token) {
      console.log('[Middleware] No token - redirecting to login')
      return NextResponse.redirect(buildCallbackUrl(request))
    }

    const role = token.role as string | undefined
    if (!role || !STAFF_ROLES.includes(role)) {
      console.log('[Middleware] Invalid role - redirecting to home')
      return NextResponse.redirect(new URL('/', request.url))
    }
    
    console.log('[Middleware] Access granted to:', pathname)
  }

  // Protect /account routes
  if (pathname.startsWith('/account')) {
    const token = await getToken({
      req: request,
      secret: authSecret,
    })

    if (!token) {
      return NextResponse.redirect(buildCallbackUrl(request))
    }
  }

  // Protect /api/admin routes
  if (pathname.startsWith('/api/admin')) {
    const token = await getToken({
      req: request,
      secret: authSecret,
    })

    if (!token) {
      return NextResponse.json(
        { error: 'Unauthorized - authentication required' },
        { status: 401 }
      )
    }

    const role = token.role as string | undefined

    if (!role || !STAFF_ROLES.includes(role)) {
      return NextResponse.json(
        { error: 'Forbidden - admin access required' },
        { status: 403 }
      )
    }
  }

  return NextResponse.next()
}

export const config = {
  matcher: [
    '/admin/:path*',
    '/api/admin/:path*',
    '/account/:path*',
  ],
}
