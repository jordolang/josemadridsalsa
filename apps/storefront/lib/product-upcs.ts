/**
 * UPC (GTIN-12) for each single-jar salsa, keyed by flavor name. The codes are the ones printed on
 * the jar labels, as recorded in the kiosk catalog (`lib/kiosk/catalog.ts`), which stays the one
 * place they are written down.
 *
 * Written to `Product.barcode` by `scripts/apply-product-upcs.ts`. The barcode is what the Google
 * Customer Reviews survey and the Merchant Center / Amazon feeds send as the product's GTIN.
 */
import { KIOSK_FLAVORS } from '@/lib/kiosk/catalog'
import { normalizeSalsaName } from '@/lib/salsa-categories'

/** Catalog spellings that differ from the kiosk flavor name, mapped to the kiosk name. */
const NAME_ALIASES: Record<string, string> = {
  'Garden Cilantro Mild': 'Garden Fresh Cilantro Mild',
  'Garden Cilantro Hot': 'Garden Fresh Cilantro Hot',
  'Black Bean Corn Pablano': 'Black Bean Corn Poblano',
  'Roasted Pineapple Habanero': 'Roasted Pineapple Habanero Hot',
}

const UPC_BY_NAME = new Map<string, string>()
for (const flavor of KIOSK_FLAVORS) {
  if (flavor.upc) UPC_BY_NAME.set(normalizeSalsaName(flavor.name), flavor.upc)
}
for (const [alias, name] of Object.entries(NAME_ALIASES)) {
  const upc = UPC_BY_NAME.get(normalizeSalsaName(name))
  if (upc) UPC_BY_NAME.set(normalizeSalsaName(alias), upc)
}

/**
 * The UPC of a single-jar product, or null when the name isn't a known flavor with a barcode
 * (variety packs, gift boxes and multi-packs carry their own codes, if any).
 */
export function getProductUpc(productName: string): string | null {
  const name = normalizeSalsaName(productName).replace(/^jose madrid /, '')
  return UPC_BY_NAME.get(name) ?? null
}

