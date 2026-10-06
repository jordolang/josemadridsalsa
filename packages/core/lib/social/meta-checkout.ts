/**
 * Meta Commerce Manager checkout-URL parsing.
 *
 * When a shopper buys from the Facebook/Instagram Shop (catalog fed by
 * `/api/social/facebook-catalog-feed`), Meta redirects them to our checkout
 * URL in the shape documented in Commerce Manager's "Build checkout URL" step:
 *
 *   /checkout/start?products=<contentId>:<qty>,<contentId>:<qty>&coupon=<CODE>
 *
 * Our catalog feed emits each product's `id` as its SKU (e.g. `JMS-MILD-003`),
 * so `contentId` is normally a SKU. We keep the parser identifier-agnostic and
 * resolve the reference against SKU / id / slug downstream.
 *
 * This is the TypeScript equivalent of Meta's Java/Spring sample controller —
 * the sample only echoes JSON; the real work is parsing, validating, and
 * hydrating a cart, which happens here and in the `/checkout/start` route.
 */

export interface ParsedProductRef {
  /** Catalog content id from Meta — resolved later to a product (SKU/id/slug). */
  ref: string
  /** Total requested quantity (>= 1); duplicate refs are summed. */
  quantity: number
}

export interface ParsedMetaCheckout {
  items: ParsedProductRef[]
  /** Normalized coupon code, or null when none/blank was supplied. */
  coupon: string | null
  /** Human-readable problems with malformed entries (never throws). */
  errors: string[]
}

const MAX_QUANTITY_PER_LINE = 99

/**
 * Parse the `products` and `coupon` query parameters from a Meta checkout URL.
 *
 * Never throws on malformed input — bad entries are collected into `errors`
 * and skipped so a single typo can't break the whole cart.
 */
export function parseMetaCheckoutParams(
  productsParam: string | null | undefined,
  couponParam?: string | null
): ParsedMetaCheckout {
  const errors: string[] = []
  const quantitiesByRef = new Map<string, number>()

  const raw = (productsParam ?? '').trim()
  if (raw.length > 0) {
    for (const entry of raw.split(',')) {
      const trimmed = entry.trim()
      if (trimmed.length === 0) continue

      // Split on the first ':' only — refs never contain ':', quantities do not.
      const sep = trimmed.indexOf(':')
      if (sep === -1) {
        errors.push(`Missing quantity for "${trimmed}" (expected "id:qty")`)
        continue
      }

      const ref = trimmed.slice(0, sep).trim()
      const qtyRaw = trimmed.slice(sep + 1).trim()

      if (ref.length === 0) {
        errors.push(`Missing product id in "${trimmed}"`)
        continue
      }

      // Integer-only quantity — reject "2.5", "abc", "", negatives, zero.
      if (!/^\d+$/.test(qtyRaw)) {
        errors.push(`Invalid quantity "${qtyRaw}" for "${ref}"`)
        continue
      }

      const qty = Number.parseInt(qtyRaw, 10)
      if (qty < 1) {
        errors.push(`Quantity must be at least 1 for "${ref}"`)
        continue
      }

      const next = (quantitiesByRef.get(ref) ?? 0) + qty
      quantitiesByRef.set(ref, Math.min(next, MAX_QUANTITY_PER_LINE))
    }
  }

  const items: ParsedProductRef[] = Array.from(quantitiesByRef.entries()).map(
    ([ref, quantity]) => ({ ref, quantity })
  )

  const couponTrimmed = (couponParam ?? '').trim()
  const coupon = couponTrimmed.length > 0 ? couponTrimmed : null

  return { items, coupon, errors }
}
