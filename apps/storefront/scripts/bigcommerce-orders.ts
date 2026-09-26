/**
 * Copies BigCommerce retail orders into this site's order table (the same copy
 * the order webhook and hourly sweep make), from a date onward.
 *
 *   npm run bigcommerce:orders --workspace @jose-madrid/storefront -- 2026-09-01
 *
 * Run with BIGCOMMERCE_* and DATABASE_URL set for the target environment. Safe to
 * re-run: an order already copied is brought up to date, never duplicated.
 */
import { syncBigCommerceOrders } from '../lib/bigcommerce/orders'

async function main() {
  const since = new Date(process.argv[2] ?? '')
  if (Number.isNaN(since.getTime())) {
    console.error('Usage: bigcommerce-orders <since, e.g. 2026-09-01>')
    process.exit(1)
  }

  const tally = await syncBigCommerceOrders(since, (id, result) => {
    if (result instanceof Error) console.error(`#${id} failed: ${result.message}`)
    else if (result.unmatched?.length) console.warn(`#${id} ${result.action}; not copied: ${result.unmatched.join('; ')}`)
  })
  console.log(tally)
}

main().catch((error) => {
  console.error(error instanceof Error ? error.message : error)
  process.exit(1)
})
