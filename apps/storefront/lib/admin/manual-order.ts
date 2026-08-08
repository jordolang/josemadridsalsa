import { z } from 'zod'

/**
 * Orders taken somewhere other than the website — over the phone, at a wholesale table, at a
 * festival stand.
 *
 * The defining difference from checkout: **a manual order records a deal that was already
 * struck.** Nothing here is quoted or calculated on the customer's behalf. Line prices,
 * shipping and tax are all entered, because recomputing them would either contradict what the
 * customer was already told or fail outright on an address nobody collected. The one thing
 * that is *not* trusted from the client is the total, which is derived from the parts below.
 *
 * There is deliberately no `Payment` row for these. `Payment` is the processor ledger, and
 * `PaymentProvider` has no honest value for cash or a cheque; the method goes in
 * `Order.paymentMethod` as free text instead. The consequence, stated so nobody has to
 * rediscover it: manual sales do not appear in transaction history or in net-revenue-after-fees.
 */

/** Channels a person can pick. Website, POS, fundraiser and import are set by their own paths. */
export const MANUAL_SALES_CHANNELS = ['MANUAL', 'PHONE', 'WHOLESALE', 'MARKETPLACE'] as const

export const ManualOrderSchema = z.object({
  customer: z.object({
    email: z.string().email(),
    firstName: z.string().max(100).optional(),
    lastName: z.string().max(100).optional(),
    phone: z.string().max(40).optional(),
  }),
  items: z
    .array(
      z.object({
        productId: z.string().cuid(),
        quantity: z.number().int().positive().max(10_000),
        // Negotiated prices are the norm on these channels, so an override is expected rather
        // than exceptional. Omitted means the catalogue price.
        unitPrice: z.number().min(0).max(100_000).optional(),
      })
    )
    .min(1, 'Add at least one product'),
  salesChannel: z.enum(MANUAL_SALES_CHANNELS),
  // Only two states are offerable: money came in, or it has not yet. Anything else belongs to
  // a processor path that this one does not touch.
  paymentStatus: z.enum(['PAID', 'PENDING']),
  paymentMethod: z.string().max(100).optional(),
  shippingCost: z.number().min(0).max(100_000).default(0),
  tax: z.number().min(0).max(100_000).default(0),
  discountAmount: z.number().min(0).max(100_000).default(0),
  shipping: z
    .object({
      address1: z.string().min(1),
      address2: z.string().optional(),
      city: z.string().min(1),
      state: z.string().min(1),
      postalCode: z.string().min(1),
    })
    .optional(),
  notes: z.string().max(2000).optional(),
})

export type ManualOrderInput = z.infer<typeof ManualOrderSchema>

export interface PricedProduct {
  id: string
  name: string
  sku: string
  price: number
  costPrice: number | null
  featuredImage?: string | null
}

export interface ManualOrderLine {
  productId: string
  quantity: number
  unitPrice: number
  totalPrice: number
  unitCost: number | null
  productName: string
  productSku: string
  productImage?: string | null
}

export interface ManualOrderTotals {
  lines: ManualOrderLine[]
  subtotal: number
  discountAmount: number
  shippingCost: number
  tax: number
  total: number
}

const round2 = (value: number) => Math.round(value * 100) / 100

/**
 * Build the order lines and totals.
 *
 * The total is computed here rather than accepted, for the same reason checkout recomputes
 * shipping: it is the one figure a client should never be able to assert. A discount larger
 * than the goods is clamped rather than allowed to make the order negative.
 */
export function priceManualOrder(
  input: ManualOrderInput,
  products: Map<string, PricedProduct>
): ManualOrderTotals {
  const lines: ManualOrderLine[] = []
  let subtotal = 0

  for (const item of input.items) {
    const product = products.get(item.productId)
    if (!product) continue

    const unitPrice = item.unitPrice ?? product.price
    const totalPrice = round2(unitPrice * item.quantity)
    subtotal = round2(subtotal + totalPrice)

    lines.push({
      productId: product.id,
      quantity: item.quantity,
      unitPrice,
      totalPrice,
      // Snapshot at the moment of sale, exactly as the checkout paths do. Null stays null —
      // an unknown cost must not become zero.
      unitCost: product.costPrice,
      productName: product.name,
      productSku: product.sku,
      productImage: product.featuredImage ?? undefined,
    })
  }

  const discountAmount = Math.min(input.discountAmount, subtotal)
  const total = round2(subtotal - discountAmount + input.shippingCost + input.tax)

  return {
    lines,
    subtotal,
    discountAmount,
    shippingCost: input.shippingCost,
    tax: input.tax,
    total,
  }
}

/**
 * How long two identical orders are treated as the same submission.
 *
 * This is the only order-creating path with no natural idempotency key — checkout has a
 * payment intent, the POS has a terminal checkout, the importer has a batch id. An admin
 * double-clicking Save, or retrying after a slow response, would otherwise create a second
 * order and deduct the stock twice.
 */
export const DUPLICATE_WINDOW_SECONDS = 60

export function duplicateWindowStart(now: Date): Date {
  return new Date(now.getTime() - DUPLICATE_WINDOW_SECONDS * 1000)
}

/** `JMS-YYYYMMDD-####`, matching the format every other order path produces. */
export function generateManualOrderNumber(now: Date, random: number): string {
  const datePart = now.toISOString().slice(0, 10).replace(/-/g, '')
  const randomPart = Math.floor(random * 9000 + 1000)
  return `JMS-${datePart}-${randomPart}`
}
