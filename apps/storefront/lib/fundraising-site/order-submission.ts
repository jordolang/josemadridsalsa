import { z } from 'zod'

/**
 * Final orders from community (order-form) fundraisers, submitted at the
 * fundraising site's /submit page. The flavor lists match the printed 2026
 * kits (public/fundraising/downloads/2026-Fundraiser-Kit-*.zip); change them
 * together.
 */

export const PRICE_PER_JAR = 10
export const DUE_PER_JAR = 5

export type FlavorCategory = 'Fruit' | 'Specialty' | 'Verde' | 'Original'
export type KitFlavor = { id: string; name: string; category: FlavorCategory }

const ALL_FLAVORS: readonly KitFlavor[] = [
  { id: 'raspberry', name: 'Raspberry – Mild', category: 'Fruit' },
  { id: 'peach', name: 'Peach – Mild', category: 'Fruit' },
  { id: 'strawberry', name: 'Strawberry – Mild', category: 'Fruit' },
  { id: 'pineapple', name: 'Pineapple – Mild', category: 'Fruit' },
  { id: 'mango', name: 'Mango – Mild', category: 'Fruit' },
  { id: 'cherry', name: 'Cherry – Mild', category: 'Fruit' },
  { id: 'cherry-chocolate', name: 'Cherry Chocolate – Hot', category: 'Fruit' },
  { id: 'mango-habanero', name: 'Mango Habanero – Hot', category: 'Fruit' },
  { id: 'roasted-pineapple-habanero', name: 'Roasted Pineapple Habanero – X-Hot', category: 'Fruit' },
  { id: 'chipotle-con-queso', name: 'Chipotle Con Queso – Medium', category: 'Specialty' },
  { id: 'black-bean-corn-poblano', name: 'Black Bean Corn Poblano – Medium', category: 'Specialty' },
  { id: 'roasted-garlic-olives', name: 'Roasted Garlic & Olives – Medium', category: 'Specialty' },
  { id: 'chipotle-hot', name: 'Chipotle – Hot', category: 'Specialty' },
  { id: 'raspberry-bbq-chipotle', name: 'Raspberry BBQ Chipotle – Medium', category: 'Specialty' },
  { id: 'garden-fresh-cilantro-mild', name: 'Garden Fresh Cilantro – Mild', category: 'Specialty' },
  { id: 'garden-fresh-cilantro-hot', name: 'Garden Fresh Cilantro – Hot', category: 'Specialty' },
  { id: 'jamaican-jerk', name: 'Jamaican Jerk – Medium', category: 'Specialty' },
  { id: 'spanish-verde-mild', name: 'Spanish Verde – Mild', category: 'Verde' },
  { id: 'spanish-verde-hot', name: 'Spanish Verde – Hot', category: 'Verde' },
  { id: 'spanish-verde-xx-hot', name: 'Spanish Verde – XX-Hot ("Stupid Hot")', category: 'Verde' },
  { id: 'original-mild', name: 'Original – Mild', category: 'Original' },
  { id: 'clovis-medium', name: 'Clovis – Medium', category: 'Original' },
  { id: 'original-hot', name: 'Original – Hot', category: 'Original' },
  { id: 'original-x-hot', name: 'Original – X-Hot', category: 'Original' },
  { id: 'ghost-of-clovis', name: 'Ghost of Clovis – X-Hot', category: 'Original' },
]

const pick = (ids: readonly string[]) => ALL_FLAVORS.filter((flavor) => ids.includes(flavor.id))

export const ORDER_KITS = {
  '25': { label: '25-flavor kit', flavors: ALL_FLAVORS },
  '16': {
    label: '16-flavor kit',
    flavors: pick([
      'raspberry', 'peach', 'pineapple', 'mango', 'roasted-pineapple-habanero',
      'chipotle-con-queso', 'black-bean-corn-poblano', 'roasted-garlic-olives', 'raspberry-bbq-chipotle',
      'garden-fresh-cilantro-mild', 'garden-fresh-cilantro-hot', 'jamaican-jerk',
      'spanish-verde-mild', 'spanish-verde-xx-hot', 'original-mild', 'original-hot',
    ]),
  },
  '9': {
    label: '9-flavor kit',
    flavors: pick([
      'raspberry', 'mango', 'roasted-pineapple-habanero', 'chipotle-con-queso', 'black-bean-corn-poblano',
      'garden-fresh-cilantro-mild', 'jamaican-jerk', 'original-mild', 'original-hot',
    ]),
  },
} as const satisfies Record<string, { label: string; flavors: readonly KitFlavor[] }>

export type KitId = keyof typeof ORDER_KITS
export const KIT_IDS = Object.keys(ORDER_KITS) as [KitId, ...KitId[]]

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
