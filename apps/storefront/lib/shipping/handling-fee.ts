/**
 * The packaging-and-materials fee added to every shipping quote.
 *
 * What a customer pays to have an order shipped is not just what the carrier charges to move the
 * parcel — it is also the box, the dividers that keep glass jars from knocking together, the tape
 * and the label. Quoting the carrier rate alone sold all of that at a loss on every single order.
 *
 * The fee is charged **once per order**, not per item or per parcel, and it applies to every rate
 * the calculator can land on: a live EasyPost rate, the domestic estimate, and the international
 * flat rate. It is deliberately flat rather than scaled — a state multiplier or a weight surcharge
 * prices *carriage*, and a box costs the same to Ohio as it does to Alaska.
 *
 * It is a constant rather than another `ShippingSettings` column because it is one number the
 * business set for the cost of its packaging; nothing has asked for it to be tuneable per store.
 * If that changes, move it onto the singleton the way `lib/shipping/rate-config.ts` did with the
 * flat-rate presets.
 */
export const HANDLING_FEE_CENTS = 400

/** The same fee in dollars, to match the calculator's `number` (dollars) contract. */
export const HANDLING_FEE = HANDLING_FEE_CENTS / 100

/**
 * A shipping cost with the packaging fee added, rounded to cents.
 *
 * Rounds with `toFixed(2)` for the same reason `rate-config.ts` does: it is the rounding every
 * existing quote was built on, so the only thing that moves is the fee itself.
 */
export function withHandlingFee(shippingCost: number): number {
  return parseFloat((shippingCost + HANDLING_FEE).toFixed(2))
}
