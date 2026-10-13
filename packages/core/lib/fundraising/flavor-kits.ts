/**
 * The three salsa packages a fundraiser runs: 9, 16 or 25 flavors. The flavor lists match the
 * printed 2026 kits (public/fundraising/downloads/2026-Fundraiser-Kit-*.zip); change them
 * together. The order-form submission page and the signup-approval catalogue both read these.
 */

export type FlavorCategory = 'Fruit' | 'Specialty' | 'Verde' | 'Original'
export type KitFlavor = {
  id: string
  name: string
  category: FlavorCategory
  /** The `Product.slug` this flavor sells as. Slugs drifted from the kit ids over the years
   * (`black-bean-corn-poblano` is `black-bean-corn-salsa` in production), so they are kept here
   * rather than derived. */
  productSlug: string
}

const ALL_FLAVORS: readonly KitFlavor[] = [
  { id: 'raspberry', name: 'Raspberry – Mild', category: 'Fruit' , productSlug: 'raspberry-mild-salsa' },
  { id: 'peach', name: 'Peach – Mild', category: 'Fruit' , productSlug: 'peach-mild-salsa' },
  { id: 'strawberry', name: 'Strawberry – Mild', category: 'Fruit' , productSlug: 'strawberry-mild' },
  { id: 'pineapple', name: 'Pineapple – Mild', category: 'Fruit' , productSlug: 'pineapple-mild-salsa' },
  { id: 'mango', name: 'Mango – Mild', category: 'Fruit' , productSlug: 'mango-mild-salsa' },
  { id: 'cherry', name: 'Cherry – Mild', category: 'Fruit' , productSlug: 'cherry-mild-salsa' },
  { id: 'cherry-chocolate', name: 'Cherry Chocolate – Hot', category: 'Fruit' , productSlug: 'cherry-chocolate-hot' },
  { id: 'mango-habanero', name: 'Mango Habanero – Hot', category: 'Fruit' , productSlug: 'mango-habanero-salsa' },
  { id: 'roasted-pineapple-habanero', name: 'Roasted Pineapple Habanero – X-Hot', category: 'Fruit' , productSlug: 'roasted-pineapple-habanero-hot' },
  { id: 'chipotle-con-queso', name: 'Chipotle Con Queso – Medium', category: 'Specialty' , productSlug: 'chipotle-con-queso-salsa' },
  { id: 'black-bean-corn-poblano', name: 'Black Bean Corn Poblano – Medium', category: 'Specialty' , productSlug: 'black-bean-corn-salsa' },
  { id: 'roasted-garlic-olives', name: 'Roasted Garlic & Olives – Medium', category: 'Specialty' , productSlug: 'roasted-garlic-olives' },
  { id: 'chipotle-hot', name: 'Chipotle – Hot', category: 'Specialty' , productSlug: 'chipotle-hot-salsa' },
  { id: 'raspberry-bbq-chipotle', name: 'Raspberry BBQ Chipotle – Medium', category: 'Specialty' , productSlug: 'raspberry-bbq-chipotle' },
  { id: 'garden-fresh-cilantro-mild', name: 'Garden Fresh Cilantro – Mild', category: 'Specialty' , productSlug: 'garden-cilantro-mild-salsa' },
  { id: 'garden-fresh-cilantro-hot', name: 'Garden Fresh Cilantro – Hot', category: 'Specialty' , productSlug: 'garden-cilantro-hot-salsa' },
  { id: 'jamaican-jerk', name: 'Jamaican Jerk – Medium', category: 'Specialty' , productSlug: 'jamaican-jerk-salsa' },
  { id: 'spanish-verde-mild', name: 'Spanish Verde – Mild', category: 'Verde' , productSlug: 'spanish-verde-mild' },
  { id: 'spanish-verde-hot', name: 'Spanish Verde – Hot', category: 'Verde' , productSlug: 'spanish-verde-hot' },
  { id: 'spanish-verde-xx-hot', name: 'Spanish Verde – XX-Hot ("Stupid Hot")', category: 'Verde' , productSlug: 'spanish-verde-xx-hot' },
  { id: 'original-mild', name: 'Original – Mild', category: 'Original' , productSlug: 'jose-madrid-original-mild' },
  { id: 'clovis-medium', name: 'Clovis – Medium', category: 'Original' , productSlug: 'clovis-medium-salsa' },
  { id: 'original-hot', name: 'Original – Hot', category: 'Original' , productSlug: 'original-hot' },
  { id: 'original-x-hot', name: 'Original – X-Hot', category: 'Original' , productSlug: 'original-x-hot' },
  { id: 'ghost-of-clovis', name: 'Ghost of Clovis – X-Hot', category: 'Original' , productSlug: 'ghost-of-clovis' },
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

export function isKitId(value: string | null | undefined): value is KitId {
  return value != null && (KIT_IDS as readonly string[]).includes(value)
}

/** The product slugs a kit sells, in kit order — the order the new store lists them. */
export function kitProductSlugs(kit: KitId): string[] {
  return ORDER_KITS[kit].flavors.map((flavor) => flavor.productSlug)
}
