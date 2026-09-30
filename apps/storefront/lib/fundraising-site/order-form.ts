import { z } from 'zod'

/**
 * The online version of the paper fundraiser order form (the 25 flavor
 * "JMS Fundraiser Order Form" in public/fundraising/downloads). A group tallies
 * its sellers' sheets and submits one bulk order here, signed.
 *
 * Shared by the /submit page (live totals) and its API route (validation), so
 * the figures a group sees are the figures we store.
 */

/** What a supporter pays per jar. */
export const ORDER_FORM_RETAIL_CENTS = 1000
/** What the group owes Jose Madrid Salsa per jar. */
export const ORDER_FORM_DUE_CENTS = 500
/** What the group keeps per jar. */
export const ORDER_FORM_PROFIT_CENTS = ORDER_FORM_RETAIL_CENTS - ORDER_FORM_DUE_CENTS
/** Bulk orders of this many jars or more ship free. */
export const ORDER_FORM_FREE_SHIPPING_JARS = 96
/** Upper bound per flavor; a typo like 12000 should be caught, not shipped. */
export const ORDER_FORM_MAX_PER_FLAVOR = 5000

export type OrderFormFlavor = { id: string; name: string; heat: string }
export type OrderFormCategory = { id: string; label: string; flavors: readonly OrderFormFlavor[] }

/** The paper form's four sections, in its order. */
export const ORDER_FORM_CATEGORIES: readonly OrderFormCategory[] = [
  {
    id: 'fruit',
    label: 'Fruit',
    flavors: [
      { id: 'raspberry-mild', name: 'Raspberry', heat: 'Mild' },
      { id: 'peach-mild', name: 'Peach', heat: 'Mild' },
      { id: 'strawberry-mild', name: 'Strawberry', heat: 'Mild' },
      { id: 'pineapple-mild', name: 'Pineapple', heat: 'Mild' },
      { id: 'mango-mild', name: 'Mango', heat: 'Mild' },
      { id: 'cherry-mild', name: 'Cherry', heat: 'Mild' },
      { id: 'cherry-chocolate-hot', name: 'Cherry Chocolate', heat: 'Hot' },
      { id: 'mango-habanero-hot', name: 'Mango Habanero', heat: 'Hot' },
      { id: 'roasted-pineapple-habanero-x-hot', name: 'Roasted Pineapple Habanero', heat: 'X-Hot' },
    ],
  },
  {
    id: 'specialty',
    label: 'Specialty',
    flavors: [
      { id: 'chipotle-con-queso-medium', name: 'Chipotle Con Queso', heat: 'Medium' },
      { id: 'black-bean-corn-poblano-medium', name: 'Black Bean, Corn & Poblano', heat: 'Medium' },
      { id: 'roasted-garlic-olives-medium', name: 'Roasted Garlic & Olives', heat: 'Medium' },
      { id: 'chipotle-hot', name: 'Chipotle', heat: 'Hot' },
      { id: 'raspberry-bbq-chipotle-medium', name: 'Raspberry BBQ Chipotle', heat: 'Medium' },
      { id: 'garden-fresh-cilantro-mild', name: 'Garden Fresh Cilantro', heat: 'Mild' },
      { id: 'garden-fresh-cilantro-hot', name: 'Garden Fresh Cilantro', heat: 'Hot' },
      { id: 'jamaican-jerk-medium', name: 'Jamaican Jerk', heat: 'Medium' },
    ],
  },
  {
    id: 'verdes',
    label: 'Verdes',
    flavors: [
      { id: 'spanish-verde-mild', name: 'Spanish Verde', heat: 'Mild' },
      { id: 'spanish-verde-hot', name: 'Spanish Verde', heat: 'Hot' },
      { id: 'spanish-verde-xx-hot', name: 'Spanish Verde "Stupid Hot"', heat: 'XX-Hot' },
    ],
  },
  {
    id: 'originals',
    label: 'Originals',
    flavors: [
      { id: 'original-mild', name: 'Original', heat: 'Mild' },
      { id: 'clovis-medium', name: 'Clovis', heat: 'Medium' },
      { id: 'original-hot', name: 'Original', heat: 'Hot' },
      { id: 'original-x-hot', name: 'Original', heat: 'X-Hot' },
      { id: 'ghost-of-clovis-x-hot', name: 'Ghost of Clovis', heat: 'X-Hot' },
    ],
  },
]

export const ORDER_FORM_FLAVORS: readonly OrderFormFlavor[] = ORDER_FORM_CATEGORIES.flatMap((category) => category.flavors)

const FLAVOR_IDS = new Set(ORDER_FORM_FLAVORS.map((flavor) => flavor.id))

export function orderFormFlavorLabel(flavor: OrderFormFlavor): string {
  return `${flavor.name} - ${flavor.heat}`
}

export type OrderFormQuantities = Record<string, number>

/** Clamps a typed or stepped value to a whole number of jars in range. */
export function clampJarCount(value: number): number {
  if (!Number.isFinite(value)) return 0
  return Math.min(ORDER_FORM_MAX_PER_FLAVOR, Math.max(0, Math.trunc(value)))
}

export type OrderFormTotals = {
  totalJars: number
  /** Jars per category id. */
  categoryJars: Record<string, number>
  /** Total the group collected from supporters (@ $10/jar). */
  retailCents: number
  /** Amount owed to Jose Madrid Salsa (@ $5/jar). */
  dueCents: number
  /** What the group keeps (@ $5/jar). */
  profitCents: number
  freeShipping: boolean
  /** Jars still needed to reach free shipping; 0 once reached. */
  jarsToFreeShipping: number
}

/** Every figure on the form, from the per-flavor counts. Unknown ids are ignored. */
export function computeOrderFormTotals(quantities: OrderFormQuantities): OrderFormTotals {
  const categoryJars: Record<string, number> = {}
  let totalJars = 0
  for (const category of ORDER_FORM_CATEGORIES) {
    const jars = category.flavors.reduce((sum, flavor) => sum + clampJarCount(quantities[flavor.id] ?? 0), 0)
    categoryJars[category.id] = jars
    totalJars += jars
  }
  return {
    totalJars,
    categoryJars,
    retailCents: totalJars * ORDER_FORM_RETAIL_CENTS,
    dueCents: totalJars * ORDER_FORM_DUE_CENTS,
    profitCents: totalJars * ORDER_FORM_PROFIT_CENTS,
    freeShipping: totalJars >= ORDER_FORM_FREE_SHIPPING_JARS,
    jarsToFreeShipping: Math.max(0, ORDER_FORM_FREE_SHIPPING_JARS - totalJars),
  }
}

export function formatOrderFormCents(cents: number): string {
  return new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD' }).format(cents / 100)
}

/** The statement the signer agrees to; stored on the signed PDF word for word. */
export function orderFormAgreementText(totals: Pick<OrderFormTotals, 'totalJars' | 'dueCents'>): string {
  return (
    `I confirm this order of ${totals.totalJars} jar${totals.totalJars === 1 ? '' : 's'} is accurate, that I am ` +
    `authorized to place it on behalf of the organization named above, and that the organization will pay ` +
    `Jose Madrid Salsa ${formatOrderFormCents(totals.dueCents)} ($5.00 per jar). I understand the order ships ` +
    `once payment is received.`
  )
}

/** Largest drawn signature accepted, as a base64 PNG data URL. */
export const ORDER_FORM_SIGNATURE_MAX_LENGTH = 500_000
const SIGNATURE_DATA_URL = /^data:image\/png;base64,[A-Za-z0-9+/]+={0,2}$/

const requiredText = (label: string, max: number) =>
  z.string().trim().min(1, `${label} is required`).max(max, `${label} is too long`)

export const orderFormSubmissionSchema = z
  .object({
    organizationName: requiredText('Fundraiser name', 120),
    contactName: requiredText('Your name', 100),
    email: z.string().trim().toLowerCase().email('Please enter a valid email').max(200),
    phone: z
      .string()
      .trim()
      .max(30)
      .refine((value) => value.replace(/\D/g, '').length >= 10, 'Please enter a phone number with area code'),
    shipTo: z.object({
      name: requiredText('Ship-to name', 100),
      street: requiredText('Street address', 160),
      city: requiredText('City', 80),
      state: requiredText('State', 40),
      postalCode: z
        .string()
        .trim()
        .regex(/^\d{5}(-\d{4})?$/, 'Please enter a 5-digit ZIP code'),
    }),
    notes: z.string().trim().max(1000).optional().transform((value) => value || undefined),
    quantities: z
      .record(z.string(), z.number().int('Jar counts must be whole numbers').min(0).max(ORDER_FORM_MAX_PER_FLAVOR))
      .refine((value) => Object.keys(value).every((id) => FLAVOR_IDS.has(id)), 'Unknown flavor on the order'),
    agreed: z.literal(true, { error: 'Please check the box to confirm the order' }),
    signature: z
      .string()
      .max(ORDER_FORM_SIGNATURE_MAX_LENGTH, 'Signature is too large')
      .regex(SIGNATURE_DATA_URL, 'Please sign the form'),
  })
  .superRefine((data, ctx) => {
    if (computeOrderFormTotals(data.quantities).totalJars < 1) {
      ctx.addIssue({ code: 'custom', path: ['quantities'], message: 'Add at least one jar to the order' })
    }
  })
  .transform((data) => ({
    ...data,
    // Keep only flavors actually ordered, in form order.
    quantities: Object.fromEntries(
      ORDER_FORM_FLAVORS.filter((flavor) => (data.quantities[flavor.id] ?? 0) > 0).map((flavor) => [
        flavor.id,
        data.quantities[flavor.id],
      ]),
    ) as OrderFormQuantities,
  }))

export type OrderFormSubmissionInput = z.input<typeof orderFormSubmissionSchema>
export type OrderFormSubmission = z.output<typeof orderFormSubmissionSchema>
