/**
 * Adapts persisted orders to the framework-free Pirate Ship shipment shape.
 * Kept separate from `pirate-ship.ts` so the pure mapping/parcel logic stays
 * testable without Prisma.
 *
 * @module lib/shipping/pirate-ship-order
 */

import type { Address, Order, OrderItem, Product, User } from '@prisma/client'
import {
  computeParcel,
  type ComputedParcel,
  type ParcelItemInput,
  type PirateShipRecipient,
} from '@/lib/shipping/pirate-ship'

/** Minimal product fields the parcel calc needs off each line item. */
type ProductDims = Pick<
  Product,
  'weight' | 'lengthInches' | 'widthInches' | 'heightInches'
>

/** An order loaded with the relations required to build a shipment. */
export type OrderForShipment = Order & {
  shippingAddress: Address | null
  user: Pick<User, 'name' | 'email' | 'phone'> | null
  items: Array<OrderItem & { product: ProductDims | null }>
}

/** Prisma `include` fragment that loads exactly what {@link toShipment} needs. */
export const shipmentInclude = {
  shippingAddress: true,
  user: { select: { name: true, email: true, phone: true } },
  items: {
    include: {
      product: {
        select: {
          weight: true,
          lengthInches: true,
          widthInches: true,
          heightInches: true,
        },
      },
    },
  },
} as const

const decToNumber = (d: Product['weight']): number | null =>
  d == null ? null : Number(d)

/**
 * Convert an order to a Pirate Ship shipment (recipient + computed parcel), or
 * `null` when the order has no shipping address to ship to.
 */
export function toShipment(
  order: OrderForShipment
): { recipient: PirateShipRecipient; parcel: ComputedParcel } | null {
  const addr = order.shippingAddress
  if (!addr) return null

  const parcelItems: ParcelItemInput[] = order.items.map((item) => ({
    quantity: item.quantity,
    weightLb: decToNumber(item.product?.weight ?? null),
    lengthIn: decToNumber(item.product?.lengthInches ?? null),
    widthIn: decToNumber(item.product?.widthInches ?? null),
    heightIn: decToNumber(item.product?.heightInches ?? null),
  }))

  const parcel = computeParcel(parcelItems)

  const itemsSummary = order.items
    .map((item) => `${item.quantity}x ${item.productName}`)
    .join('; ')

  const recipient: PirateShipRecipient = {
    reference: order.orderNumber,
    name: `${addr.firstName} ${addr.lastName}`.trim(),
    company: addr.company,
    email: order.user?.email ?? order.guestEmail ?? null,
    phone: addr.phone ?? order.user?.phone ?? order.guestPhone ?? null,
    address1: addr.street,
    address2: null,
    city: addr.city,
    state: addr.state,
    zip: addr.zipCode,
    country: addr.country,
    itemsSummary,
  }

  return { recipient, parcel }
}
