import { z } from 'zod'
import { ORDER_KITS, KIT_IDS, type KitId } from '@/lib/fundraising/flavor-kits'

/**
 * Final orders from community (order-form) fundraisers, submitted at the
 * fundraising site's /submit page. The kits themselves live in
 * `@/lib/fundraising/flavor-kits`.
 */

export const PRICE_PER_JAR = 10
export const DUE_PER_JAR = 5

export {
  ORDER_KITS,
  KIT_IDS,
  type FlavorCategory,
  type KitFlavor,
  type KitId,
} from '@/lib/fundraising/flavor-kits'
export const PAYMENT_METHODS = {
  'card-online': 'Credit card online',
  check: 'Check by mail',
  'card-phone': 'Credit card by phone',
} as const
export type PaymentMethod = keyof typeof PAYMENT_METHODS

const text = (max: number) => z.string().trim().min(1, 'Required').max(max)

/** Largest drawn signature accepted, as a base64 PNG data URL (~375 KB of image). */
export const SIGNATURE_MAX_LENGTH = 500_000
const SIGNATURE_DATA_URL = /^data:image\/png;base64,[A-Za-z0-9+/]+={0,2}$/

export const orderSubmissionSchema = z
  .object({
    kit: z.enum(KIT_IDS),
    organizationName: text(120),
    contactName: text(120),
    email: z.string().trim().email().max(200),
    phone: text(40),
    shipName: text(120),
    shipStreet: text(200),
    shipCity: text(80),
    shipState: text(40),
    shipZip: z.string().trim().regex(/^\d{5}(-\d{4})?$/, 'Enter a 5-digit ZIP code'),
    quantities: z.record(z.string(), z.number().int().min(0).max(10_000)),
    paymentMethod: z.enum(Object.keys(PAYMENT_METHODS) as [PaymentMethod, ...PaymentMethod[]]),
    notes: z.string().trim().max(2000).optional(),
    /** The fundraising store's checkout group; required to pay by card online. */
    group: z.string().trim().max(200).optional(),
    confirmFinal: z.literal(true, { message: 'Please confirm this order is final' }),
    signature: z
      .string({ message: 'Please sign the order' })
      .max(SIGNATURE_MAX_LENGTH, 'Signature is too large')
      .regex(SIGNATURE_DATA_URL, 'Please sign the order'),
  })
  .superRefine((order, ctx) => {
    const allowed = new Set(ORDER_KITS[order.kit].flavors.map((flavor) => flavor.id))
    const unknown = Object.keys(order.quantities).filter((id) => !allowed.has(id))
    if (unknown.length > 0) {
      ctx.addIssue({ code: 'custom', path: ['quantities'], message: `Not in the ${order.kit}-flavor kit: ${unknown.join(', ')}` })
    }
    if (order.paymentMethod === 'card-online' && !order.group) {
      ctx.addIssue({ code: 'custom', path: ['group'], message: 'Choose your group to pay by card online' })
    }
    if (Object.values(order.quantities).every((qty) => qty === 0)) {
      ctx.addIssue({ code: 'custom', path: ['quantities'], message: 'Enter at least one jar' })
    }
  })

export type OrderSubmission = z.infer<typeof orderSubmissionSchema>

/** The order's non-zero lines in kit order, with its money totals. */
export function summarizeOrder(kit: KitId, quantities: Record<string, number>) {
  const lines = ORDER_KITS[kit].flavors
    .map((flavor) => ({ ...flavor, quantity: quantities[flavor.id] ?? 0 }))
    .filter((line) => line.quantity > 0)
  const totalJars = lines.reduce((sum, line) => sum + line.quantity, 0)
  return {
    lines,
    totalJars,
    salesValue: totalJars * PRICE_PER_JAR,
    amountDue: totalJars * DUE_PER_JAR,
    groupKeeps: totalJars * (PRICE_PER_JAR - DUE_PER_JAR),
  }
}
