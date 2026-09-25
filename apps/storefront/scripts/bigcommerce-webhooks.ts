/**
 * Registers (or repairs) the main store's BigCommerce webhooks so product
 * edits in the BigCommerce admin refresh the storefront.
 *
 *   npm run bigcommerce:webhooks --workspace @jose-madrid/storefront -- https://www.josemadridsalsa.com
 *
 * Run it after the site is deployed at that address, with BIGCOMMERCE_* and
 * BIGCOMMERCE_WEBHOOK_SECRET set to the same values as production. Safe to
 * re-run; also use it to revive hooks BigCommerce disabled after an outage.
 */
import { BIGCOMMERCE_WEBHOOK_PATH, ensureBigCommerceWebhooks } from '../lib/bigcommerce/webhooks'

async function main() {
  const origin = process.argv[2]?.replace(/\/+$/, '')
  if (!origin || !/^https:\/\//.test(origin)) {
    console.error('Usage: bigcommerce-webhooks <https://site-origin>')
    process.exit(1)
  }

  const destination = `${origin}${BIGCOMMERCE_WEBHOOK_PATH}`
  const results = await ensureBigCommerceWebhooks(destination)
  for (const { scope, action } of results) {
    console.log(`${action.padEnd(11)} ${scope} → ${destination}`)
  }
}

main().catch((error) => {
  console.error(error instanceof Error ? error.message : error)
  process.exit(1)
})
