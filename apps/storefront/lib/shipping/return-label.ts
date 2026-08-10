import { z } from 'zod'

import type { ShippingAddress } from '@/lib/shipping-api'

/**
 * Prepaid return labels.
 *
 * A return label is an outbound label with the addresses swapped: the customer ships, the
 * warehouse receives. That is the whole difference, and it is worth stating because the
 * failure mode is buying a label that ships *to* the customer again.
 *
 * Two things this module does not do, deliberately:
 *
 * - It does not reuse `app/api/admin/orders/[id]/shipping-label`. That route never calls the
 *   carrier — it synthesises `${CARRIER}${Date.now()}` as a tracking number and a local URL as
 *   the label. A return label the customer is emailed has to be a real label, so this goes
 *   through `createShipment` + `buyShipmentLabel` and money actually moves.
 * - It does not write a `ShippingLabel` row. See the comment on `ReturnRequest.returnLabelUrl`:
 *   the EasyPost tracking webhook advances a label's order to delivered, which would mark the
 *   customer's original order delivered when their return reached the warehouse.
 */

export const ReturnLabelRequestSchema = z.object({
  /** Omitted means the cheapest rate available. Staff can pin a service when it matters. */
  rateId: z.string().min(1).optional(),
  parcel: z
    .object({
      length: z.number().positive().max(108),
      width: z.number().positive().max(108),
      height: z.number().positive().max(108),
      /** Ounces, matching the outbound label path. */
      weight: z.number().positive().max(1120),
    })
    .optional(),
})

export type ReturnLabelRequest = z.infer<typeof ReturnLabelRequestSchema>

/**
 * Fallback parcel for a return.
 *
 * The same box the goods arrived in is the realistic assumption, and jars are heavy for their
 * size, so an under-declared weight gets the label rejected at the counter rather than
 * silently costing less. Staff can override per return.
 */
export const DEFAULT_RETURN_PARCEL = {
  length: 10,
  width: 8,
  height: 4,
  weight: 16,
} as const

export interface ReturnAddressPair {
  /** Where the parcel starts: the customer. */
  from: ShippingAddress
  /** Where it goes: the warehouse. */
  to: ShippingAddress
}

export interface CustomerAddressInput {
  firstName: string | null
  lastName: string | null
  street: string
  city: string
  state: string
  zipCode: string
  country: string | null
  phone: string | null
}

export interface WarehouseAddressInput {
  name?: string | null
  street?: string | null
  city?: string | null
  state?: string | null
  zipCode?: string | null
  country?: string | null
}

export type ReturnAddressError =
  | { code: 'NO_CUSTOMER_ADDRESS'; message: string }
  | { code: 'INCOMPLETE_WAREHOUSE_ADDRESS'; message: string; missing: string[] }

/**
 * Build the swapped address pair, refusing rather than guessing.
 *
 * The warehouse address is validated field by field because EasyPost accepts a partial address
 * and then produces a label that cannot be delivered — a blank return destination would be
 * discovered by a customer whose parcel came back to them.
 */
export function buildReturnAddresses(
  customer: CustomerAddressInput | null,
  warehouse: WarehouseAddressInput
): { ok: true; addresses: ReturnAddressPair } | { ok: false; error: ReturnAddressError } {
  if (!customer) {
    return {
      ok: false,
      error: {
        code: 'NO_CUSTOMER_ADDRESS',
        message:
          'This order has no shipping address, so there is nowhere to collect the return from. Counter and phone sales need a label bought manually.',
      },
    }
  }

  const missing: string[] = []
  if (!warehouse.street?.trim()) missing.push('street')
  if (!warehouse.city?.trim()) missing.push('city')
  if (!warehouse.state?.trim()) missing.push('state')
  if (!warehouse.zipCode?.trim()) missing.push('postal code')

  if (missing.length > 0) {
    return {
      ok: false,
      error: {
        code: 'INCOMPLETE_WAREHOUSE_ADDRESS',
        message: `The return destination is incomplete (missing ${missing.join(', ')}). Set the origin address under Settings → Shipping.`,
        missing,
      },
    }
  }

  const customerName = [customer.firstName, customer.lastName]
    .filter((part) => part && part.trim())
    .join(' ')
    .trim()

  return {
    ok: true,
    addresses: {
      from: {
        name: customerName || 'Customer',
        street1: customer.street,
        city: customer.city,
        state: customer.state,
        zip: customer.zipCode,
        country: customer.country || 'US',
        ...(customer.phone ? { phone: customer.phone } : {}),
      },
      to: {
        name: warehouse.name?.trim() || 'Jose Madrid Salsa',
        street1: warehouse.street!.trim(),
        city: warehouse.city!.trim(),
        state: warehouse.state!.trim(),
        zip: warehouse.zipCode!.trim(),
        country: warehouse.country?.trim() || 'US',
      },
    },
  }
}

export interface SelectableRate {
  id: string
  carrier: string
  service: string
  rate: number
}

/**
 * Pick the rate to buy.
 *
 * Cheapest by default: the business is paying for the customer's mistake or its own, and a
 * return has no delivery promise attached to it. A pinned rate wins, and a pinned rate that is
 * no longer offered is an error rather than a silent downgrade to the cheapest — staff chose a
 * service for a reason.
 */
export function selectReturnRate(
  rates: SelectableRate[],
  rateId?: string
): { ok: true; rate: SelectableRate } | { ok: false; message: string } {
  if (rates.length === 0) {
    return {
      ok: false,
      message: 'No carrier returned a rate for this return. Check the addresses and parcel size.',
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

  const cheapest = rates.reduce((best, rate) => (rate.rate < best.rate ? rate : best), rates[0])
  return { ok: true, rate: cheapest }
}
