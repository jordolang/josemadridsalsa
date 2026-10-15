/**
 * Writes the Google Merchant Center feed (lib/merchant-center-feed.ts) for every active product to
 * `public/merchant-center-feed.xml`, which Merchant Center fetches daily once it is deployed. Dry
 * run by default: prints what the feed would hold and writes nothing. Pass --apply to write.
 *
 *   npm run products:feed --workspace @jose-madrid/storefront            # dry run
 *   npm run products:feed --workspace @jose-madrid/storefront -- --apply # write
 *
 * Products missing a slug, price, barcode (GTIN) or image are listed and left out of the feed.
 */
import { writeFileSync } from 'node:fs'
import { join, relative } from 'node:path'
import { PrismaClient } from '@prisma/client'
import { getErrorMessage } from '@/lib/errors'
import {
  MERCHANT_FEED_PATH,
  buildFeedItem,
  buildFeedXml,
  feedSkipReasons,
  type MerchantFeedProduct,
} from '@/lib/merchant-center-feed'
import { SITE_URL } from '@/lib/site-url'

const prisma = new PrismaClient()
const apply = process.argv.includes('--apply')
const outputPath = join(process.cwd(), 'public', MERCHANT_FEED_PATH)

async function writeProductsFeed() {
  try {
    const rows = await prisma.product.findMany({
      where: { isActive: true },
      select: {
        name: true,
        slug: true,
        sku: true,
        price: true,
        barcode: true,
        description: true,
        metaDescription: true,
        heatLevel: true,
        featuredImage: true,
        images: true,
        inventory: true,
        weight: true,
        category: { select: { name: true, slug: true } },
      },
      orderBy: [{ sortOrder: 'asc' }, { name: 'asc' }],
    })
    const products: MerchantFeedProduct[] = rows.map((row) => ({
      ...row,
      price: row.price !== null ? Number(row.price) : null,
      weight: row.weight !== null ? Number(row.weight) : null,
    }))

    const skipped = products.flatMap((product) => {
      const reasons = feedSkipReasons(product)
      return reasons.length ? [{ product, reasons }] : []
    })
    const items = products
      .filter((product) => feedSkipReasons(product).length === 0)
      .map((product) => buildFeedItem(product, SITE_URL))

    console.log(apply ? 'WRITING Merchant Center feed\n' : 'DRY RUN (pass --apply to write)\n')
    console.log(`Active products: ${products.length}`)
    console.log(`Items in feed: ${items.length}`)
    console.log(`\nSkipped: ${skipped.length}`)
    for (const { product, reasons } of skipped) {
      console.log(`  - ${product.name} (${product.sku || product.slug}): ${reasons.join(', ')}`)
    }
    if (items[0]) console.log(`\nSample item:\n${items[0]}`)

    if (!apply) {
      console.log(`\nWould write ${relative(process.cwd(), outputPath)}`)
      return
    }

    writeFileSync(outputPath, buildFeedXml(items, SITE_URL))
    console.log(`\n✅ Wrote ${items.length} items to ${relative(process.cwd(), outputPath)}`)
    console.log(`Feed URL: ${SITE_URL}${MERCHANT_FEED_PATH}`)
    console.log('It goes live when this file is committed and Vercel deploys; Merchant Center picks it up on its next daily fetch.')
  } catch (error) {
    console.error('❌ Failed to build the Merchant Center feed:', getErrorMessage(error))
    process.exitCode = 1
  } finally {
    await prisma.$disconnect()
  }
}

writeProductsFeed()
