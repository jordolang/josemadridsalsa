import { NextResponse } from 'next/server'
import { getFeedProducts } from '@/lib/feeds/products'
import { buildFacebookCatalogCsv } from '@/lib/feeds/facebook'
import { buildGoogleShoppingTsv, buildGoogleShoppingXml } from '@/lib/feeds/google'
import { buildAmazonInventoryTsv } from '@/lib/feeds/amazon'
import { FEED_PLATFORMS } from '@/lib/feeds/platforms'

/**
 * Public product feed endpoint for third-party platforms.
 *
 * GET /api/feeds/facebook          Meta Commerce catalog CSV
 * GET /api/feeds/google-shopping   Google Merchant Center XML (?format=tsv for TSV)
 * GET /api/feeds/amazon            Amazon Inventory Loader flat file (TSV)
 * GET /api/feeds/microsoft-bing    Google-format XML (Microsoft accepts it as-is)
 * GET /api/feeds/pinterest         Google-format XML (Pinterest accepts it as-is)
 *
 * Append ?download=1 to receive the feed as a file download instead of inline.
 * Feed URLs are meant to be pasted into each platform's scheduled-fetch data
 * source, mirroring how /api/social/facebook-catalog-feed already works for
 * Meta Commerce Manager.
 */

export const dynamic = 'force-dynamic'

const CONTENT_TYPES = {
  csv: 'text/csv; charset=utf-8',
  tsv: 'text/tab-separated-values; charset=utf-8',
  xml: 'application/xml; charset=utf-8',
} as const

export async function GET(
  request: Request,
  { params }: { params: Promise<{ platform: string }> },
) {
  const { platform } = await params
  const info = FEED_PLATFORMS.find((entry) => entry.id === platform)
  if (!info) {
    return NextResponse.json({ error: 'Unknown feed platform' }, { status: 404 })
  }

  const { searchParams } = new URL(request.url)
  const products = await getFeedProducts()

  let body: string
  let format = info.format
  let filename = info.filename

  switch (info.id) {
    case 'facebook':
      body = buildFacebookCatalogCsv(products)
      break
    case 'amazon':
      body = buildAmazonInventoryTsv(products)
      break
    // Microsoft and Pinterest ingest the Google-format feed unchanged.
    case 'google-shopping':
    case 'microsoft-bing':
    case 'pinterest':
      if (searchParams.get('format') === 'tsv') {
        body = buildGoogleShoppingTsv(products)
        format = 'tsv'
        filename = filename.replace(/\.xml$/, '.txt')
      } else {
        body = buildGoogleShoppingXml(products)
      }
      break
  }

  const disposition = searchParams.get('download') ? 'attachment' : 'inline'

  return new Response(body, {
    headers: {
      'Content-Type': CONTENT_TYPES[format],
      'Content-Disposition': `${disposition}; filename="${filename}"`,
      // Platforms re-fetch on their own schedule; a short cache shields the DB
      // from incidental traffic while keeping inventory reasonably fresh.
      'Cache-Control': 'public, max-age=300, s-maxage=300',
    },
  })
}
