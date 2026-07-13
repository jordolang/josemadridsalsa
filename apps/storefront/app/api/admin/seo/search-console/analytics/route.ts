import { NextRequest, NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import { hasPermission } from '@/lib/rbac'
import { getGscServiceAccount, getSeoConfiguration } from '@/lib/seo/configuration'
import { querySearchAnalytics } from '@/lib/seo/search-console'

function isoDate(date: Date): string {
  return date.toISOString().slice(0, 10)
}

/**
 * Search performance summary: totals plus top queries and top pages
 * over the requested window (default 28 days).
 */
export async function GET(request: NextRequest) {
  const session = await getServerSession(authOptions)
  if (!session?.user) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }
  const permitted = await hasPermission(session.user as any, 'seo:manage')
  if (!permitted) {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
  }

  const [config, serviceAccount] = await Promise.all([
    getSeoConfiguration(),
    getGscServiceAccount(),
  ])

  if (!serviceAccount || !config?.gscProperty) {
    return NextResponse.json(
      { error: 'Search Console is not configured. Add a service account and property first.' },
      { status: 400 }
    )
  }

  const days = Math.min(Math.max(Number(request.nextUrl.searchParams.get('days')) || 28, 1), 90)
  // Search Console data lags ~2 days behind
  const endDate = new Date()
  endDate.setDate(endDate.getDate() - 2)
  const startDate = new Date(endDate)
  startDate.setDate(startDate.getDate() - days)

  const range = { startDate: isoDate(startDate), endDate: isoDate(endDate) }

  try {
    const [totals, topQueries, topPages] = await Promise.all([
      querySearchAnalytics(serviceAccount, config.gscProperty, { ...range }),
      querySearchAnalytics(serviceAccount, config.gscProperty, {
        ...range,
        dimensions: ['query'],
        rowLimit: 20,
      }),
      querySearchAnalytics(serviceAccount, config.gscProperty, {
        ...range,
        dimensions: ['page'],
        rowLimit: 20,
      }),
    ])

    return NextResponse.json({
      range,
      totals: totals[0] ?? { clicks: 0, impressions: 0, ctr: 0, position: 0 },
      topQueries,
      topPages,
    })
  } catch (error) {
    return NextResponse.json(
      { error: 'Failed to fetch Search Console analytics', details: String(error) },
      { status: 502 }
    )
  }
}
