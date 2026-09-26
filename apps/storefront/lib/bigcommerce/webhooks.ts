import { timingSafeEqual } from 'node:crypto'
import { bigCommerceFetch } from './client'
import type { BigCommerceStoreKey } from './config'

/**
 * BigCommerce webhooks keep the storefront's cached catalog fresh: when staff
 * edit a product in the BigCommerce admin, BigCommerce calls
 * `/api/webhooks/bigcommerce` and the catalog cache is dropped.
 *
 * BigCommerce does not sign webhook payloads. Instead each hook is registered
 * with a custom header carrying `BIGCOMMERCE_WEBHOOK_SECRET`, and the route
 * refuses any call without it.
 */

export const BIGCOMMERCE_WEBHOOK_PATH = '/api/webhooks/bigcommerce'
export const BIGCOMMERCE_WEBHOOK_SECRET_HEADER = 'x-jms-webhook-secret'

/**
 * Every product change (created, updated, deleted, inventory), and every order
 * change, which is copied into this site's order table.
 */
export const BIGCOMMERCE_WEBHOOK_SCOPES = ['store/product/*', 'store/order/*'] as const

/** True only when a secret is configured and `provided` matches it. */
export function isValidBigCommerceWebhookSecret(provided: string | null): boolean {
  const expected = process.env.BIGCOMMERCE_WEBHOOK_SECRET?.trim()
  if (!expected || !provided) return false
  const a = Buffer.from(provided, 'utf8')
  const b = Buffer.from(expected, 'utf8')
  // timingSafeEqual throws unless both buffers are the same length.
  return a.length === b.length && timingSafeEqual(a, b)
}

type Hook = { id: number; scope: string; destination: string; is_active: boolean }

/**
 * Makes the store's webhooks point at `destination`: creates any missing
 * scope, reactivates hooks BigCommerce disabled after failed deliveries, and
 * leaves hooks for other destinations alone. Safe to run repeatedly.
 */
export async function ensureBigCommerceWebhooks(
  destination: string,
  storeKey: BigCommerceStoreKey = 'main',
): Promise<Array<{ scope: string; action: 'created' | 'reactivated' | 'unchanged' }>> {
  const secret = process.env.BIGCOMMERCE_WEBHOOK_SECRET?.trim()
  if (!secret) throw new Error('BIGCOMMERCE_WEBHOOK_SECRET must be set before registering webhooks')

  const existing = (await bigCommerceFetch<{ data: Hook[] }>(storeKey, 'v3/hooks'))?.data ?? []
  const results: Array<{ scope: string; action: 'created' | 'reactivated' | 'unchanged' }> = []

  for (const scope of BIGCOMMERCE_WEBHOOK_SCOPES) {
    const hook = existing.find((h) => h.scope === scope && h.destination === destination)
    const body = {
      scope,
      destination,
      is_active: true,
      headers: { [BIGCOMMERCE_WEBHOOK_SECRET_HEADER]: secret },
    }

    if (!hook) {
      await bigCommerceFetch(storeKey, 'v3/hooks', { method: 'POST', body })
      results.push({ scope, action: 'created' })
    } else if (!hook.is_active) {
      await bigCommerceFetch(storeKey, `v3/hooks/${hook.id}`, { method: 'PUT', body })
      results.push({ scope, action: 'reactivated' })
    } else {
      results.push({ scope, action: 'unchanged' })
    }
  }

  return results
}
