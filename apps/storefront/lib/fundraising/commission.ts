/**
 * What a fundraising group earns from an order.
 *
 * The rate is stored as a percentage (`50.00`, not `0.50`) on `Fundraiser.commissionRate`,
 * which is the convention every live path uses. Note that `lib/fundraising/calculate-commission.ts`
 * implements the opposite convention and has no callers; it is not used here.
 */

export interface CommissionOrder {
  subtotal: number
  discountAmount: number
}

/**
 * The figure commission is taken from: merchandise only.
 *
 * This used to be `order.total`. Shipping is money owed to a carrier and tax is money owed
 * to a state — paying a share of either comes straight out of the gap between the fundraiser
 * price and the catalogue price, which is the only thing funding the group's share in the
 * first place. On a fifty-percent fundraiser, a ten dollar jar shipped for six with tax paid
 * out about eight to the group instead of five.
 *
 * Discounts come off, because a promo code reduces what was actually earned on the goods.
 * Gift certificates do not: those are a means of payment, not a lower price.
 */
export function commissionBase(order: CommissionOrder): number {
  return Math.max(0, order.subtotal - order.discountAmount)
}

/** Rounded to cents, since it is written straight to a `Decimal(10,2)` rollup. */
export function calculateFundraiserCommission(
  order: CommissionOrder,
  ratePercent: number
): number {
  const amount = commissionBase(order) * (ratePercent / 100)
  return Math.round(amount * 100) / 100
}
