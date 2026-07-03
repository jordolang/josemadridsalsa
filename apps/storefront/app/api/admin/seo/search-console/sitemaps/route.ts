import { NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import { hasPermission } from '@/lib/rbac'
import { getGscServiceAccount, getSeoConfiguration } from '@/lib/seo/configuration'
import { listSitemaps, submitSitemap } from '@/lib/seo/search-console'

async function loadContext() {
  const session = await getServerSession(authOptions)
  if (!session?.user) {
    return { denied: NextResponse.json({ error: 'Unauthorized' }, { status: 401 }) }
  }
  const permitted = await hasPermission(session.user as any, 'seo:manage')
  if (!permitted) {
    return { denied: NextResponse.json({ error: 'Forbidden' }, { status: 403 }) }
  }

  const [config, serviceAccount] = await Promise.all([
    getSeoConfiguration(),
    getGscServiceAccount(),
  ])

  if (!serviceAccount || !config?.gscProperty) {
    return {
      denied: NextResponse.json(
        { error: 'Search Console is not configured. Add a service account and property first.' },
        { status: 400 }
      ),
    }
  }

  return { config, serviceAccount }
}

export async function GET() {
  const ctx = await loadContext()
  if (ctx.denied) return ctx.denied

  try {
    const sitemaps = await listSitemaps(ctx.serviceAccount, ctx.config.gscProperty!)
    return NextResponse.json({ sitemaps })
  } catch (error) {
    return NextResponse.json(
      { error: 'Failed to list sitemaps', details: String(error) },
      { status: 502 }
    )
  }
}

/** Submit the site's sitemap.xml to Search Console. */
export async function POST() {
  const ctx = await loadContext()
  if (ctx.denied) return ctx.denied

  const siteUrl = ctx.config.siteUrl?.replace(/\/+$/, '')
  if (!siteUrl) {
    return NextResponse.json(
      { error: 'Set the Site URL in SEO configuration before submitting a sitemap.' },
      { status: 400 }
    )
  }

  const sitemapUrl = `${siteUrl}/sitemap.xml`

  try {
    await submitSitemap(ctx.serviceAccount, ctx.config.gscProperty!, sitemapUrl)
    return NextResponse.json({ success: true, sitemapUrl })
  } catch (error) {
    return NextResponse.json(
      { error: 'Failed to submit sitemap', details: String(error) },
      { status: 502 }
    )
  }
}
