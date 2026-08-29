/**
 * What a supporter pays on a fundraiser page.
 *
 * A fundraiser is its own store. It sells the same catalogue as the retail storefront at its
 * own price, above retail, so the group's share comes out of the gap rather than out of the
 * margin on the jar. Two prices can apply, in this order:
 *
 *   1. `FundraiserProduct.price` — this fundraiser's price for this one product.
 *   2. `Fundraiser.defaultUnitPrice` — this fundraiser's store price, ten dollars by default.
 *
 * The retail catalogue price is deliberately not a third fallback. A fundraiser that has set
 * neither still sells at its store price; falling through to `Product.price` is what used to
 * put a ten dollar jar in the cart at nine.
 *
 * Every caller — the fundraiser store component, the portal product block, and all three
 * checkout routes — resolves the price through here.
 */

/** Prisma hands back `Decimal`; the pages hand back numbers or strings. Accept all three. */
export type PriceLike = number | string | { toString(): string }

function toNumber(value: PriceLike): number {
  return typeof value === 'number' ? value : Number(value.toString())
}

/**
 * The product override wins when there is one, the fundraiser's store price otherwise.
 *
 * Deliberately `??` and not a truthiness check at both levels: an override of zero is a
 * fundraiser giving something away, and falling through would charge for it.
 */
export function fundraiserUnitPrice(
  storeDefaultPrice: PriceLike,
  override: PriceLike | null | undefined
): number {
  return override === null || override === undefined
    ? toNumber(storeDefaultPrice)
    : toNumber(override)
}

/**
 * The group's share and ours, for one order's worth of merchandise.
 *
 * Exposed so the fundraiser pages and the portal can state the split in the same terms the
 * money is actually credited in — half and half by default. Shipping and tax are not part of
 * `merchandiseTotal` and never are: shipping is owed to a carrier, tax to a state.
 */
export function splitFundraiserProceeds(merchandiseTotal: number, ratePercent: number) {
  const toGroup = Math.round(merchandiseTotal * (ratePercent / 100) * 100) / 100
  return { toGroup, toCompany: Math.round((merchandiseTotal - toGroup) * 100) / 100 }
}
