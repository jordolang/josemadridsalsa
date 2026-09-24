/**
 * BigCommerce store credentials.
 *
 * Jose Madrid runs two BigCommerce stores, and each has its own store-level
 * API account:
 *   - `main`        — josemadridsalsa.com (retail storefront)
 *   - `fundraising` — josemadridsalsafundraising.com
 *
 * BigCommerce stays the system of record for catalog, carts, checkout and
 * orders; this app is a headless storefront on top of it.
 */

export type BigCommerceStoreKey = 'main' | 'fundraising'

export type BigCommerceStoreConfig = {
  key: BigCommerceStoreKey
  storeHash: string
  accessToken: string
  clientId: string
  clientSecret: string
}

const ENV_PREFIX: Record<BigCommerceStoreKey, string> = {
  main: 'BIGCOMMERCE_',
  fundraising: 'BIGCOMMERCE_FUNDRAISING_',
}

export class BigCommerceConfigError extends Error {
  constructor(message: string) {
    super(message)
    this.name = 'BigCommerceConfigError'
  }
}

function readEnv(name: string): string | undefined {
  const value = process.env[name]?.trim()
  return value ? value : undefined
}

/** Returns the store's credentials, or `null` when any of them is unset. */
export function findBigCommerceStore(key: BigCommerceStoreKey): BigCommerceStoreConfig | null {
  const prefix = ENV_PREFIX[key]
  const storeHash = readEnv(`${prefix}STORE_HASH`)
  const accessToken = readEnv(`${prefix}ACCESS_TOKEN`)
  const clientId = readEnv(`${prefix}CLIENT_ID`)
  const clientSecret = readEnv(`${prefix}CLIENT_SECRET`)

  if (!storeHash || !accessToken || !clientId || !clientSecret) return null
  return { key, storeHash, accessToken, clientId, clientSecret }
}

export function isBigCommerceConfigured(key: BigCommerceStoreKey): boolean {
  return findBigCommerceStore(key) !== null
}

/** Like `findBigCommerceStore`, but names the missing variables when unset. */
export function getBigCommerceStore(key: BigCommerceStoreKey): BigCommerceStoreConfig {
  const store = findBigCommerceStore(key)
  if (store) return store

  const prefix = ENV_PREFIX[key]
  const missing = ['STORE_HASH', 'ACCESS_TOKEN', 'CLIENT_ID', 'CLIENT_SECRET']
    .map((suffix) => `${prefix}${suffix}`)
    .filter((name) => !readEnv(name))
  throw new BigCommerceConfigError(
    `BigCommerce ${key} store is not configured (missing ${missing.join(', ')})`,
  )
}
