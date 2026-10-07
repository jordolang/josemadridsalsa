/** Merch helpers safe to import from client components (no Printify, Square or Prisma). */

export const MERCH_MAX_QUANTITY = 10

export function formatPrice(cents: number): string {
  return new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD' }).format(cents / 100)
}

export function formatPriceRange(product: { minPriceCents: number; maxPriceCents: number }): string {
  return product.minPriceCents === product.maxPriceCents
    ? formatPrice(product.minPriceCents)
    : `From ${formatPrice(product.minPriceCents)}`
}
