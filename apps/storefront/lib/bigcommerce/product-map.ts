/**
 * BigCommerce product id (main store) → slug of this site's existing product
 * page, which carries the heat rating, nutrition panel, ingredients and
 * recipes that BigCommerce does not hold.
 *
 * A product missing from this map is still linked when the site product has the
 * same name as the BigCommerce one (see `findBigCommerceProductBySlug`), so staff
 * can add a new salsa in both places with no code change. An entry here is only
 * needed when the two names differ.
 */
export const BIGCOMMERCE_PRODUCT_SLUGS: Readonly<Record<number, string>> = {
  95: 'black-bean-corn-salsa',
  96: 'cherry-chocolate-hot',
  97: 'cherry-mild-salsa',
  98: 'original-hot',
  99: 'chipotle-hot-salsa',
  100: 'chipotle-con-queso-salsa',
  101: 'clovis-medium-salsa',
  102: 'original-x-hot',
  103: 'garden-cilantro-hot-salsa',
  104: 'jose-madrid-original-mild',
  105: 'garden-cilantro-mild-salsa',
  106: 'jamaican-jerk-salsa',
  107: 'mango-mild-salsa',
  108: 'pineapple-mild-salsa',
  109: 'raspberry-bbq-chipotle',
  110: 'raspberry-mild-salsa',
  111: 'roasted-garlic-olives',
  112: 'roasted-pineapple-habanero-hot',
  113: 'strawberry-mild',
  114: 'spanish-verde-hot',
  115: 'spanish-verde-mild',
  116: 'spanish-verde-xx-hot',
  124: 'peach-mild-salsa',
  128: 'mango-habanero-salsa',
  129: 'ghost-of-clovis',
  135: 'cherry-hot',
  155: 'blueberry-mild-salsa',
}

/**
 * Mix-and-match pack id (see `lib/bundles.ts`) → the BigCommerce product that
 * sells it. Each carries one "Jar N" dropdown per jar plus an order-notes field.
 */
export const BIGCOMMERCE_BUNDLE_PRODUCT_IDS: Readonly<Record<string, number>> = {
  'choose-3': 120,
  'choose-5': 122,
  'choose-6': 121,
  'choose-12': 119,
}
