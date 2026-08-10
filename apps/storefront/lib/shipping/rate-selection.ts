/**
 * Choosing which carrier rate to buy.
 *
 * Shared by outbound labels and return labels so the two cannot develop different ideas about
 * what "cheapest" means or what to do when a pinned rate has expired.
 */

/**
 * Marks a `ShippingLabel` as postage bought outside the system — Pirate Ship, a counter, anywhere
 * without an API. Stored in `carrierResponse.source`.
 */
export const EXTERNAL_LABEL_SOURCE = 'external'

/**
 * Whether a stored label represents postage that genuinely exists.
 *
 * Three kinds of row live in `shipping_labels`:
 *
 * - **Real EasyPost purchases** — have a `trackingCode`.
 * - **External purchases** — Pirate Ship and friends, marked in `carrierResponse.source`.
 * - **Legacy mock rows** — written by the old label route, which synthesised
 *   `${CARRIER}${Date.now()}` and bought nothing. These have a `trackingNumber` and neither of the
 *   above, and must **not** block buying a real label, because no parcel was ever shipped for them.
 */
export function isRealPostage(label: {
  trackingCode?: string | null
  carrierResponse?: unknown
}): boolean {
  if (label.trackingCode) return true
  const response = label.carrierResponse
  return (
    typeof response === 'object' &&
    response !== null &&
    (response as { source?: unknown }).source === EXTERNAL_LABEL_SOURCE
  )
}

export interface SelectableRate {
  id: string
  carrier: string
  service: string
  rate: number
  /** Carrier's transit estimate, when it gives one. Used only to stamp an expected delivery date. */
  deliveryDays?: number | null
}

export type RateSelection =
  | { ok: true; rate: SelectableRate }
  | { ok: false; message: string }

/**
 * Cheapest by default.
 *
 * A pinned rate wins, and a pinned rate the carrier no longer offers is an **error** rather than a
 * silent fall back to the cheapest — staff who chose a service chose it for a reason, and quietly
 * buying a slower one is how a promised delivery date gets missed.
 *
 * @param rateId Optional rate to pin. Rate ids are short-lived; carriers expire them.
 */
export function selectRate(rates: SelectableRate[], rateId?: string): RateSelection {
  if (rates.length === 0) {
    return {
      ok: false,
      message: 'No carrier returned a rate. Check the addresses and the parcel size.',
    }
  }

  if (rateId) {
    const pinned = rates.find((rate) => rate.id === rateId)
    if (!pinned) {
      return {
        ok: false,
        message: 'That rate is no longer available. Fetch rates again and pick another.',
      }
    }
    return { ok: true, rate: pinned }
  }

  return {
    ok: true,
    rate: rates.reduce((best, rate) => (rate.rate < best.rate ? rate : best), rates[0]),
  }
}

/**
 * Narrow rates to a carrier and service when staff asked for one specifically.
 *
 * Matched case-insensitively because carriers are inconsistent about it — EasyPost returns
 * `USPS`/`GroundAdvantage` while the stored carrier codes are lower case.
 */
export function filterRates(
  rates: SelectableRate[],
  carrier?: string,
  service?: string
): SelectableRate[] {
  return rates.filter(
    (rate) =>
      (!carrier || rate.carrier.toLowerCase() === carrier.toLowerCase()) &&
      (!service || rate.service.toLowerCase() === service.toLowerCase())
  )
}
