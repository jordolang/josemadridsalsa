/**
 * Pure helpers for product bundles — a fixed set of products sold together at one set price.
 *
 * The load-bearing piece is {@link allocateBundlePrices}: at checkout a bundle expands into one
 * order line per component product, and the bundle's single price has to be split across those
 * lines so the line totals sum back to the bundle price *to the cent*. Keeping this pure means the
 * proration and its rounding are tested without a database, and the checkout route stays the only
 * place that reads product prices.
 */
import { z } from 'zod'

// The slug rule is the same URL-safe single segment collections already defines; reuse it rather
// than restating it, so a bundle slug and a collection slug can never drift apart.
export { slugify, SLUG_PATTERN, slugSchema } from '@/lib/collections'

/** A component of a bundle: which product, and how many of it one bundle contains. */
export interface BundleComponentInput {
  productId: string
  quantity: number
}

/**
 * Turn an ordered list of components into `BundleProduct` create rows, carrying each product's
 * position as `sortOrder`. Duplicate product ids are dropped keeping the first (the join is unique
 * per (bundle, product)); a quantity below 1 is floored to 1; blank ids are ignored.
 */
export function bundleProductRows(
  components: BundleComponentInput[]
): Array<{ productId: string; quantity: number; sortOrder: number }> {
  const seen = new Set<string>()
  const rows: Array<{ productId: string; quantity: number; sortOrder: number }> = []

  for (const raw of components) {
    const productId = raw.productId?.trim()
    if (!productId || seen.has(productId)) continue
    seen.add(productId)
    const quantity = Number.isInteger(raw.quantity) && raw.quantity > 0 ? raw.quantity : 1
    rows.push({ productId, quantity, sortOrder: rows.length })
  }

  return rows
}

/** A component priced for the order: which product, how many units, and its share of the bundle. */
export interface AllocatedBundleLine {
  productId: string
  /** Units of this product on the order = component quantity × number of bundles. */
  quantity: number
  /** Per-unit price (2 dp) derived from the allocated total; `totalPrice` is authoritative. */
  unitPrice: number
  /** This component's exact share of the bundle total, in dollars (2 dp). */
  totalPrice: number
}

/** A component as the allocator needs it: its catalogue price and how many one bundle contains. */
export interface BundleComponentForPricing {
  productId: string
  /** The product's own catalogue price (dollars), used only to weight the split. */
  basePrice: number
  /** How many of this product are in one bundle. */
  quantity: number
}

const toCents = (dollars: number) => Math.round(dollars * 100)

/**
 * Split a bundle's price across its component lines so the line totals sum **exactly** to
 * `bundlePrice × bundleQuantity`.
 *
 * The split is weighted by each component's catalogue value (`basePrice × quantity`) so a $20 item
 * carries more of the discount than a $4 one — the same proportional approach the checkout already
 * uses to prorate tax across lines. Allocation is done in integer cents with the largest-remainder
 * method, so no cent is lost or invented; the leftover cents from rounding go to the components with
 * the largest fractional remainders (ties broken by order, for determinism).
 *
 * When every component has a zero/absent base price the weight falls back to unit count, so a
 * bundle of cost-price-unknown items still splits sensibly rather than dividing by zero.
 *
 * `unitPrice` is the line total divided by its unit count, rounded to a displayable 2 dp; the
 * `totalPrice` is the exact allocated share and is what the order subtotal is summed from.
 */
export function allocateBundlePrices(
  components: BundleComponentForPricing[],
  bundlePrice: number,
  bundleQuantity: number
): AllocatedBundleLine[] {
  if (components.length === 0) return []

  const totalCents = toCents(bundlePrice) * bundleQuantity

  // Weight each component by its catalogue value within one bundle; fall back to unit count when
  // the base prices give nothing to weight by.
  let weights = components.map((c) => Math.max(0, c.basePrice) * c.quantity)
  if (weights.reduce((s, w) => s + w, 0) <= 0) {
    weights = components.map((c) => c.quantity)
  }
  const weightTotal = weights.reduce((s, w) => s + w, 0)

  // Largest-remainder apportionment of totalCents by weight.
  const exact = components.map((_, i) => (totalCents * weights[i]) / weightTotal)
  const floors = exact.map((v) => Math.floor(v))
  let remaining = totalCents - floors.reduce((s, v) => s + v, 0)
  const order = exact
    .map((v, i) => ({ i, frac: v - Math.floor(v) }))
    .sort((a, b) => b.frac - a.frac || a.i - b.i)
  const centsByIndex = [...floors]
  for (const { i } of order) {
    if (remaining <= 0) break
    centsByIndex[i] += 1
    remaining -= 1
  }

  return components.map((c, i) => {
    const quantity = c.quantity * bundleQuantity
    const totalPrice = centsByIndex[i] / 100
    const unitPrice = quantity > 0 ? Math.round(centsByIndex[i] / quantity) / 100 : 0
    return { productId: c.productId, quantity, unitPrice, totalPrice }
  })
}

/** The customer's saving versus buying the components separately, in dollars (0 if none). */
export function bundleSavings(componentsRetailTotal: number, bundlePrice: number): number {
  return Math.max(0, Math.round((componentsRetailTotal - bundlePrice) * 100) / 100)
}

/** Zod schema for the bundle create/update payload (shared by the admin create and update routes). */
export const bundleComponentSchema = z.object({
  productId: z.string().min(1),
  quantity: z.number().int().min(1).max(1000),
})
