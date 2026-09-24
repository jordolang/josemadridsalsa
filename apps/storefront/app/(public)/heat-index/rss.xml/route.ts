import { getPublishedPostsForFeed } from '@/lib/blog/queries'
import { SITE_URL } from '@/lib/site-url'

export const dynamic = 'force-dynamic'

export const runtime = 'nodejs'
export const revalidate = 600

const FEED_TITLE = 'The Heat Index — Jose Madrid Salsa'
const FEED_DESC =
  'Stories, recipes, road notes, and salsa lore from the team behind Jose Madrid Salsa.'

function escapeXml(s: string): string {
  return s
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&apos;')
}

export async function GET() {
  const posts = await getPublishedPostsForFeed(40)
  const now = new Date().toUTCString()

  const items = posts
    .map((p) => {
      const url = `${SITE_URL}/heat-index/${p.slug}`
      const pubDate = p.publishedAt ? new Date(p.publishedAt).toUTCString() : now
      return `
    <item>
      <title>${escapeXml(p.title)}</title>
      <link>${url}</link>
      <guid isPermaLink="true">${url}</guid>
      <pubDate>${pubDate}</pubDate>
      <description>${escapeXml(p.excerpt)}</description>
      ${p.category ? `<category>${escapeXml(p.category.name)}</category>` : ''}
      ${p.tags.map((t) => `<category>${escapeXml(t)}</category>`).join('\n      ')}
    </item>`.trim()
    })
    .join('\n    ')

  const xml = `<?xml version="1.0" encoding="UTF-8"?>
<rss version="2.0" xmlns:atom="http://www.w3.org/2005/Atom">
  <channel>
    <title>${escapeXml(FEED_TITLE)}</title>
    <link>${SITE_URL}/heat-index</link>
    <description>${escapeXml(FEED_DESC)}</description>
    <language>en-us</language>
    <lastBuildDate>${now}</lastBuildDate>
    <atom:link href="${SITE_URL}/heat-index/rss.xml" rel="self" type="application/rss+xml" />
    ${items}
  </channel>
</rss>`

  return new Response(xml, {
    headers: {
      'Content-Type': 'application/rss+xml; charset=utf-8',
      'Cache-Control': 'public, s-maxage=600, stale-while-revalidate=3600',
    },
  })
}
