/**
 * What a supporter pays on a fundraiser page.
 *
 * A fundraiser sells above retail so the group's share comes out of the gap rather than out
 * of the margin on the jar. `FundraiserProduct.price` carries that figure and falls back to
 * the catalogue price when a fundraiser has not set one.
 *
 * Every caller — the two public fundraiser pages, the portal product block, and all three
 * checkout routes — resolves the price through here. The rule used to be written out at each
 * site, which is how the checkout routes came to ignore the override entirely and charge
 * retail for something the cart had just quoted at ten dollars.
 */

/** Prisma hands back `Decimal`; the pages hand back numbers or strings. Accept all three. */
export type PriceLike = number | string | { toString(): string }

function toNumber(value: PriceLike): number {
  return typeof value === 'number' ? value : Number(value.toString())
}

/**
 * The override wins when there is one.
 *
 * Deliberately `??` and not a truthiness check: an override of zero is a fundraiser giving
 * something away, and falling through to the catalogue price would charge for it.
 */
export function fundraiserUnitPrice(
  basePrice: PriceLike,
  override: PriceLike | null | undefined
): number {
  return override === null || override === undefined ? toNumber(basePrice) : toNumber(override)
}
