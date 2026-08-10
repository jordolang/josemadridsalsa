/**
 * What a customer is told to do with a return.
 *
 * **The customer arranges and pays their own return postage.** This replaced a feature that bought
 * a prepaid label on the business's carrier account: the goods coming back are the customer's
 * responsibility to send, so there is no label to buy, no cost to front, and nothing to claw back
 * if the parcel never arrives.
 *
 * They also do not need permission. A return raised inside the published window is approved on
 * creation, so this is everything they need in one place — the RMA to write on the box, and where
 * to send it.
 */

export interface ReturnShippingAddress {
  name: string
  street1: string
  city: string
  state: string
  zip: string
  country: string
}

export interface ReturnInstructions {
  rmaNumber: string
  address: ReturnShippingAddress
  /** Ordered steps, written for the customer. */
  steps: string[]
  /** The condition the goods have to come back in for a full refund. */
  conditionNote: string
}

export function buildReturnInstructions(
  rmaNumber: string,
  address: ReturnShippingAddress
): ReturnInstructions {
  return {
    rmaNumber,
    address,
    steps: [
      `Write ${rmaNumber} clearly on the outside of the box.`,
      'Pack the jars so they cannot move — the original box and dividers are ideal.',
      'Send it to the address below using any carrier you like. Return postage is yours to arrange and pay for.',
      'Keep your tracking number until the refund lands.',
    ],
    conditionNote:
      'Unopened jars in the condition they left in are refunded in full, less the original shipping. If something arrived damaged or wrong, we cover the return and the original shipping too.',
  }
}

/** One-line address for a label field or a copy button. */
export function formatReturnAddress(address: ReturnShippingAddress): string {
  return [
    address.name,
    address.street1,
    `${address.city}, ${address.state} ${address.zip}`,
    address.country === 'US' ? null : address.country,
  ]
    .filter(Boolean)
    .join('\n')
}
