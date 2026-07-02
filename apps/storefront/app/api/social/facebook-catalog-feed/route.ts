import { getFeedProducts } from '@/lib/feeds/products'
import { buildFacebookCatalogCsv } from '@/lib/feeds/facebook'

/**
 * Public Meta (Facebook/Instagram) Commerce catalog feed.
 *
 * Paste this endpoint's URL into Commerce Manager → Catalog → Data sources →
 * "Use a data feed" → Scheduled feed. Meta fetches it on a schedule and keeps
 * the catalog in sync with active products, prices, and inventory — no API
 * tokens or business verification required to populate the catalog.
 *
 * Kept for URLs already registered in Commerce Manager; new integrations
 * should use /api/feeds/facebook, which serves the identical feed. The CSV
 * itself is built in lib/feeds/facebook.ts, shared by both routes.
 */

export const dynamic = 'force-dynamic'

export async function GET() {
  const products = await getFeedProducts()
  const csv = buildFacebookCatalogCsv(products)

  return new Response(csv, {
    headers: {
      'Content-Type': 'text/csv; charset=utf-8',
      'Content-Disposition': 'inline; filename="facebook-catalog-feed.csv"',
      // Meta re-fetches on its own schedule; a short cache shields the DB from
      // incidental traffic while keeping inventory reasonably fresh.
      'Cache-Control': 'public, max-age=300, s-maxage=300',
    },
  })
}
