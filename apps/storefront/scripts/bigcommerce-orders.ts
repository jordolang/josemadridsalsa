/**
 * Copies BigCommerce orders into this site's order table (the same copy the
 * order webhook and hourly sweep make), from a date onward.
 *
 *   npm run bigcommerce:orders --workspace @jose-madrid/storefront -- 2026-09-01
 *   npm run bigcommerce:orders --workspace @jose-madrid/storefront -- 2020-01-01 --store fundraising
 *
 * `--store fundraising` copies the fundraising store's orders instead of the
 * retail store's, crediting each to the fundraiser for its checkout group
 * (created on first sight). Run with BIGCOMMERCE_* (or BIGCOMMERCE_FUNDRAISING_*)
 * and DATABASE_URL set for the target environment. Safe to re-run: an order
 * already copied is brought up to date, never duplicated.
 */
import { syncBigCommerceOrders } from '../lib/bigcommerce/orders'

const USAGE = 'Usage: bigcommerce-orders <since, e.g. 2026-09-01> [--store main|fundraising]'

function parseArgs(argv: string[]): { since: Date; store: 'main' | 'fundraising' } | null {
  const storeFlag = argv.indexOf('--store')
  const store = storeFlag === -1 ? 'main' : argv[storeFlag + 1]
  const positional = argv.filter((_, index) => storeFlag === -1 || (index !== storeFlag && index !== storeFlag + 1))
  const since = new Date(positional[0] ?? '')
  if (Number.isNaN(since.getTime()) || (store !== 'main' && store !== 'fundraising')) return null
  return { since, store }
}

async function main() {
  const args = parseArgs(process.argv.slice(2))
  if (!args) {
    console.error(USAGE)
    process.exit(1)
  }

  const fundraisers = new Set<string>()
  const newFundraisers = new Set<string>()
  let withoutGroup = 0

  const tally = await syncBigCommerceOrders(
    args.since,
    (id, result) => {
      if (result instanceof Error) {
        console.error(`#${id} failed: ${result.message}`)
        return
      }
      if (result.unmatched?.length) console.warn(`#${id} ${result.action}; not copied: ${result.unmatched.join('; ')}`)
      if (args.store !== 'fundraising' || result.action === 'skipped') return
      if (result.fundraiserId) {
        fundraisers.add(result.fundraiserId)
        if (result.fundraiserCreated) newFundraisers.add(result.fundraiserId)
      } else {
        withoutGroup++
      }
    },
    args.store,
  )

  console.log(
    args.store === 'fundraising'
      ? { ...tally, fundraisers: fundraisers.size, fundraisersCreated: newFundraisers.size, ordersWithoutGroup: withoutGroup }
      : tally,
  )
}

main().catch((error) => {
  console.error(error instanceof Error ? error.message : error)
  process.exit(1)
})
