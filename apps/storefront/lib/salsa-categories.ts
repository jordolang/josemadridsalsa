/**
 * The five shopper-facing salsa categories and which flavor belongs to each.
 *
 * `Product.categoryId` holds exactly one category per product, so every salsa lands in exactly one
 * of these. The product's own `heatLevel` is left alone; categories are the browse taxonomy.
 * Sorting rule: fruit-based salsas split into Fruit Mild / Fruit Hot; savory salsas split by the
 * 0–10 heat rating the site already shows (`lib/salsa-heat.ts`): up to 4 is Mild, 4.5–5.5 is Medium,
 * 6 and up is Hot (Extra Hot flavors are folded into Hot).
 *
 * Applied to the database by `scripts/apply-salsa-categories.ts`.
 */

export type SalsaCategorySlug =
  | 'fruit-mild-salsa'
  | 'fruit-hot-salsa'
  | 'mild-salsa'
  | 'medium-salsa'
  | 'hot-salsa'

export interface SalsaCategory {
  name: string
  slug: SalsaCategorySlug
  description: string
  image: string
  metaTitle: string
  metaDescription: string
  ogImage: string
  sortOrder: number
}

export const SALSA_CATEGORIES: SalsaCategory[] = [
  {
    name: 'Fruit Mild Salsa',
    slug: 'fruit-mild-salsa',
    description:
      'Sweet, fruit-forward salsas with just a whisper of heat. Ripe peach, strawberry, raspberry, mango, pineapple, cherry and crisp green apple are kettle-cooked in small batches in Zanesville, Ohio. Scoop them up with tortilla chips, spoon them over cream cheese, or use them to glaze chicken and pork.',
    image: '/images/categories/fruit-mild-salsa.jpg',
    metaTitle: 'Mild Fruit Salsa | Peach, Mango & Berry | Jose Madrid',
    metaDescription:
      'Shop sweet, mild fruit salsas from Jose Madrid: peach, strawberry, raspberry, mango, pineapple, cherry and green apple. Small-batch in Zanesville, Ohio.',
    ogImage: '/images/categories/fruit-mild-salsa.jpg',
    sortOrder: 10,
  },
  {
    name: 'Fruit Hot Salsa',
    slug: 'fruit-hot-salsa',
    description:
      'Sweet heat. Mango, roasted pineapple, cherry and raspberry meet habanero, chipotle and hot peppers for salsas that start sweet and finish with a real kick. Great with chips, on fish tacos and wings, or brushed onto anything coming off the grill.',
    image: '/images/categories/fruit-hot-salsa.jpg',
    metaTitle: 'Hot Fruit Salsa | Mango Habanero & More | Jose Madrid',
    metaDescription:
      'Sweet-heat fruit salsas from Jose Madrid: Mango Habanero, Roasted Pineapple Habanero, Cherry Hot, Cherry Chocolate Hot and more. Small-batch in Ohio.',
    ogImage: '/images/categories/fruit-hot-salsa.jpg',
    sortOrder: 20,
  },
  {
    name: 'Mild Salsa',
    slug: 'mild-salsa',
    description:
      'All the flavor, none of the sweat. Our mild salsas start with tomato, onion, garlic and gentle peppers, from the everyday Original Mild to Garden Fresh Cilantro, Spanish Verde and Roasted Garlic & Olives. Easy for the whole family and endlessly dippable.',
    image: '/images/categories/mild-salsa.jpg',
    metaTitle: 'Mild Salsa | Original, Cilantro & Verde | Jose Madrid',
    metaDescription:
      'Shop Jose Madrid mild salsas: Original Mild, Garden Fresh Cilantro, Spanish Verde Mild and Roasted Garlic & Olives. Full flavor, gentle heat, made in Ohio.',
    ogImage: '/images/categories/mild-salsa.jpg',
    sortOrder: 30,
  },
  {
    name: 'Medium Salsa',
    slug: 'medium-salsa',
    description:
      'Right in the middle, in the best way. Balanced heat and bold flavor, led by Clovis Medium, the original recipe that started Jose Madrid, plus chunky Black Bean Corn Poblano and smoky Chipotle Con Queso.',
    image: '/images/categories/medium-salsa.jpg',
    metaTitle: 'Medium Salsa | Clovis Medium & More | Jose Madrid',
    metaDescription:
      'Balanced heat, bold flavor. Shop Jose Madrid medium salsas, including Clovis Medium, Black Bean Corn Poblano and Chipotle Con Queso. Small-batch in Ohio.',
    ogImage: '/images/categories/medium-salsa.jpg',
    sortOrder: 40,
  },
  {
    name: 'Hot Salsa',
    slug: 'hot-salsa',
    description:
      'For heat seekers. From Original Hot and Chipotle Hot up to Original X Hot, Spanish Verde XX Hot and the ghost-pepper Ghost of Clovis, these salsas bring serious fire without giving up the flavor.',
    image: '/images/categories/hot-salsa.jpg',
    metaTitle: 'Hot Salsa | Ghost Pepper, X Hot & Verde | Jose Madrid',
    metaDescription:
      'Shop Jose Madrid hot salsas: Original Hot, Chipotle Hot, Jamaican Jerk, Spanish Verde XX Hot and Ghost of Clovis ghost pepper salsa. Made in small batches.',
    ogImage: '/images/categories/hot-salsa.jpg',
    sortOrder: 50,
  },
]

/**
 * Flavor names per category. Names are matched after `normalizeSalsaName`, so "Salsa", "&"/"and",
 * parentheticals and "X X"/"XX" spellings don't matter. Known spelling variants from the imported
 * catalog are listed as extra entries.
 */
export const SALSA_CATEGORY_FLAVORS: Record<SalsaCategorySlug, string[]> = {
  'fruit-mild-salsa': [
    'Peach Mild',
    'Strawberry Mild',
    'Raspberry Mild',
    'Pineapple Mild',
    'Mango Mild',
    'Cherry Mild',
    'Green Apple',
    'Blueberry Mild',
    'Cranberry', // seasonal
  ],
  'fruit-hot-salsa': [
    'Mango Habanero',
    'Roasted Pineapple Habanero Hot',
    'Roasted Pineapple Habanero',
    'Cherry Hot',
    'Cherry Chocolate Hot',
    'Raspberry BBQ Chipotle', // rated medium (5); no fruit-medium category, so it sits with the sweet-heat salsas
    'Cranberry Chipotle', // heat not rated anywhere in the catalog; chipotle puts it here
  ],
  'mild-salsa': [
    'Original Mild',
    'Garden Fresh Cilantro Mild',
    'Garden Cilantro Mild',
    'Spanish Verde Mild',
    'Roasted Garlic & Olives', // the old import tagged it FRUIT; treated as savory
  ],
  'medium-salsa': [
    'Clovis Medium',
    'Black Bean Corn Poblano', // site rates 5.5; the Amazon copy calls it mild
    'Black Bean Corn Pablano',
    'Chipotle Con Queso', // site rates 5; the Amazon copy calls it mild
  ],
  'hot-salsa': [
    'Original Hot',
    'Original X Hot',
    'Chipotle Hot',
    'Garden Fresh Cilantro Hot',
    'Garden Cilantro Hot',
    'Spanish Verde Hot',
    'Spanish Verde XX Hot',
    'Jamaican Jerk', // "sweet, savory and fiery"; not listed as a fruit salsa
    'Ghost of Clovis',
  ],
}

export function normalizeSalsaName(name: string): string {
  return name
    .toLowerCase()
    .replace(/&amp;/g, '&')
    .replace(/\(.*?\)/g, ' ')
    .replace(/&/g, ' and ')
    .replace(/\bsalsa\b/g, ' ')
    .replace(/[^a-z0-9]+/g, ' ')
    .replace(/\bx x\b/g, 'xx')
    .trim()
    .replace(/\s+/g, ' ')
}

const CATEGORY_BY_NAME = new Map<string, SalsaCategorySlug>(
  (Object.entries(SALSA_CATEGORY_FLAVORS) as [SalsaCategorySlug, string[]][]).flatMap(
    ([slug, names]) => names.map((name) => [normalizeSalsaName(name), slug] as const)
  )
)

/** The category a salsa belongs to, or null when the product isn't a known flavor (e.g. variety packs). */
export function getSalsaCategorySlug(productName: string): SalsaCategorySlug | null {
  return CATEGORY_BY_NAME.get(normalizeSalsaName(productName)) ?? null
}
