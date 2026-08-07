import prisma from '@/lib/prisma'
import { isMissingTableError } from '@/lib/prisma-errors'

/**
 * Active redirect table, consumed by middleware.
 *
 * Middleware runs on every request, so it must not open a database connection
 * per request. It fetches this route instead with a short revalidate window,
 * which collapses to roughly one query a minute regardless of traffic.
 *
 * Redirects are public routing information — the same data a visitor observes
 * by following the old URL — so this endpoint is unauthenticated.
 */
export const dynamic = 'force-dynamic'

export async function GET() {
  try {
    const redirects = await prisma.redirect.findMany({
      where: { isActive: true },
      select: { source: true, destination: true, permanent: true },
    })
    return Response.json(
      { redirects },
      { headers: { 'Cache-Control': 'public, s-maxage=60, stale-while-revalidate=300' } }
    )
  } catch (error) {
    if (!isMissingTableError(error)) {
      console.error('[cms] failed to load redirects:', error)
    }
    return Response.json({ redirects: [] })
  }
}
