import { NextResponse } from 'next/server'
import type { NextRequest } from 'next/server'
import { getToken } from 'next-auth/jwt'

export async function middleware(request: NextRequest) {
  const { pathname } = request.nextUrl

  // Protect /admin routes
  if (pathname.startsWith('/admin')) {
    const token = await getToken({
      req: request,
      secret: process.env.NEXTAUTH_SECRET,
    })

    // Not authenticated
    if (!token) {
      const signInUrl = new URL('/auth/signin', request.url)
      signInUrl.searchParams.set('callbackUrl', pathname)
      return NextResponse.redirect(signInUrl)
    }

    // Check if user has staff access
    const role = token.role as string
    const allowedRoles = ['ADMIN', 'DEVELOPER', 'STAFF']

    if (!allowedRoles.includes(role)) {
      // Redirect to unauthorized page or home
      return NextResponse.redirect(new URL('/', request.url))
    }
  }

  // Protect /api/admin routes
  if (pathname.startsWith('/api/admin')) {
    const token = await getToken({
      req: request,
      secret: process.env.NEXTAUTH_SECRET,
    })

    // Not authenticated
    if (!token) {
      return NextResponse.json(
        { error: 'Unauthorized - authentication required' },
        { status: 401 }
      )
    }

    // Check if user has staff access
    const role = token.role as string
    const allowedRoles = ['ADMIN', 'DEVELOPER', 'STAFF']

    if (!allowedRoles.includes(role)) {
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
  ],
}
