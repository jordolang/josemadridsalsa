/**
 * Address readiness check for real-time shipping-rate requests.
 *
 * The checkout page requests a shipping estimate as the customer types their
 * address. The server route (`app/api/checkout/calculate-shipping`) validates
 * `state` with a 2-character minimum and `postalCode` with a 5-character
 * minimum, so firing a request while those fields are still being typed
 * returns a 400 "Invalid shipping calculation request". This predicate mirrors
 * those server minimums so the client only asks for rates once the address can
 * actually pass validation.
 */
export interface ShippingRateAddressInput {
  address1: string
  city: string
  state: string
  postalCode: string
}

/** Minimums kept in sync with ShippingCalculationSchema on the server route. */
export function isShippingAddressReadyForRates(
  address: ShippingRateAddressInput
): boolean {
  return (
    address.address1.trim().length >= 1 &&
    address.city.trim().length >= 1 &&
    address.state.trim().length >= 2 &&
    address.postalCode.trim().length >= 5
  )
}
