/**
 * Registers (or repairs) a BigCommerce store's webhooks: product edits refresh
 * the storefront, and orders are copied into this site's order table.
 *
 *   npm run bigcommerce:webhooks --workspace @jose-madrid/storefront -- https://www.josemadridsalsa.com
 *   npm run bigcommerce:webhooks --workspace @jose-madrid/storefront -- https://www.josemadridsalsa.com --store fundraising
 *
 * Without `--store` it registers the main (retail) store. Run it after the
 * site is deployed at that address, with BIGCOMMERCE_* (or
 * BIGCOMMERCE_FUNDRAISING_*) and BIGCOMMERCE_WEBHOOK_SECRET set to the same
 * values as production. Safe to re-run; also use it to revive hooks
 * BigCommerce disabled after an outage.
 */
import { bigCommerceWebhookDestination, ensureBigCommerceWebhooks } from '../lib/bigcommerce/webhooks'

async function main() {
  const argv = process.argv.slice(2)
  const storeFlag = argv.indexOf('--store')
  const store = storeFlag === -1 ? 'main' : argv[storeFlag + 1]
  const origin = argv.find((arg, index) => storeFlag === -1 || (index !== storeFlag && index !== storeFlag + 1))
  if (!origin || !/^https:\/\//.test(origin) || (store !== 'main' && store !== 'fundraising')) {
    console.error('Usage: bigcommerce-webhooks <https://site-origin> [--store main|fundraising]')
    process.exit(1)
  }

  const destination = bigCommerceWebhookDestination(origin, store)
  const results = await ensureBigCommerceWebhooks(destination, store)
  for (const { scope, action } of results) {
    console.log(`${action.padEnd(11)} ${scope} → ${destination} (${store} store)`)
  }
}

main().catch((error) => {
  console.error(error instanceof Error ? error.message : error)
  process.exit(1)
})
