/**
 * Kiosk flavor catalog — what the kiosk shows, and which database product each tile sells.
 *
 * Display data (photo, tile color, heat, filter group) lives here; stock and the product
 * row come from the database. A flavor is matched to its product by UPC (Product.barcode)
 * and, when the barcode is missing or shared, by name. Flavors with no product are listed
 * by `matchKioskProducts` so staff can fix the data instead of the kiosk guessing.
 */

export type KioskHeat = 'mild' | 'medium' | 'hot' | 'xhot'
export type KioskGroup = 'classic' | 'verde' | 'specialty' | 'fruit'

export interface KioskFlavor {
  key: string
  name: string
  heat: KioskHeat
  group: KioskGroup
  /** Tile background, matched to the jar's label color. */
  tint: string
  image: string
  /** UPC printed on the jar (public/upc.txt). Null when we don't have one. */
  upc: string | null
}

const flavor = (
  key: string,
  name: string,
  heat: KioskHeat,
  group: KioskGroup,
  tint: string,
  upc: string | null
): KioskFlavor => ({ key, name, heat, group, tint, upc, image: `/images/kiosk/jar-${key}.webp` })

export const KIOSK_FLAVORS: readonly KioskFlavor[] = [
  flavor('original-mild', 'Original Mild', 'mild', 'classic', '#3E8ED0', '093662452522'),
  flavor('clovis-medium', 'Clovis Medium', 'medium', 'classic', '#D9452B', '093662452638'),
  flavor('original-hot', 'Original Hot', 'hot', 'classic', '#245C9E', '093662452546'),
  flavor('original-x-hot', 'Original X Hot', 'xhot', 'classic', '#123A6B', '093662452553'),
  flavor('ghost-of-clovis', 'Ghost of Clovis', 'xhot', 'classic', '#2A1F1A', '093662452980'),
  flavor('spanish-verde-mild', 'Spanish Verde Mild', 'mild', 'verde', '#22A38D', '093662452690'),
  flavor('spanish-verde-hot', 'Spanish Verde Hot', 'hot', 'verde', '#147A68', '093662452683'),
  flavor('spanish-verde-xx-hot', 'Spanish Verde X X Hot', 'xhot', 'verde', '#0B5246', '093662452676'),
  flavor('cilantro-mild', 'Garden Fresh Cilantro Mild', 'mild', 'classic', '#E06A92', '093662452904'),
  flavor('cilantro-hot', 'Garden Fresh Cilantro Hot', 'hot', 'classic', '#C2416E', '093662452898'),
  flavor('chipotle-hot', 'Chipotle Hot', 'hot', 'specialty', '#8E4FA0', '093662452805'),
  flavor('chipotle-con-queso', 'Chipotle Con Queso', 'medium', 'specialty', '#C98A3C', '093662452935'),
  flavor('black-bean-corn-poblano', 'Black Bean Corn Poblano', 'mild', 'specialty', '#E3A21A', '093662452874'),
  flavor('roasted-garlic-olives', 'Roasted Garlic & Olives', 'mild', 'specialty', '#8C6A3C', '093662452812'),
  flavor('jamaican-jerk', 'Jamaican Jerk', 'hot', 'specialty', '#C8642A', '093662452942'),
  flavor('peach-mild', 'Peach Mild', 'mild', 'fruit', '#EE8A73', '093662452706'),
  flavor('mango-mild', 'Mango Mild', 'mild', 'fruit', '#F08A24', '093662452850'),
  flavor('pineapple-mild', 'Pineapple Mild', 'mild', 'fruit', '#EBB21C', '093662452836'),
  flavor('strawberry-mild', 'Strawberry Mild', 'mild', 'fruit', '#B23A5E', '093662452829'),
  flavor('raspberry-mild', 'Raspberry Mild', 'mild', 'fruit', '#C2477A', '093662452751'),
  flavor('blueberry', 'Blueberry Mild', 'mild', 'fruit', '#2F6DB5', '093662453017'),
  flavor('cherry-mild', 'Cherry Mild', 'mild', 'fruit', '#E0533D', '093662452911'),
  // Retired, so it has no barcode; it shows only while an active product still matches by name.
  flavor('green-apple', 'Green Apple', 'mild', 'fruit', '#7DAA2B', null),
  flavor('cherry-hot', 'Cherry Hot', 'hot', 'fruit', '#C23A28', '093662453000'),
  flavor('cherry-chocolate-hot', 'Cherry Chocolate Hot', 'hot', 'fruit', '#6B2A1F', '093662452928'),
  flavor('mango-habanero', 'Mango Habanero', 'hot', 'fruit', '#E5641A', '093662452973'),
  flavor('roasted-pineapple-habanero', 'Roasted Pineapple Habanero Hot', 'hot', 'fruit', '#D99A12', '093662452867'),
  flavor('raspberry-bbq-chipotle', 'Raspberry BBQ Chipotle', 'medium', 'fruit', '#9D2B5B', '093662452843'),
]

export interface CatalogProduct {
  id: string
  name: string
  sku: string
  barcode: string | null
  inventory: number
  stockReserved: number
  isActive: boolean
}

export interface KioskCatalogItem extends KioskFlavor {
  productId: string | null
  sku: string | null
  inStock: boolean
}

/** Lowercase words, minus filler, so "Jose Madrid Mango Habanero Salsa" ≈ "Mango Habanero". */
export function nameTokens(name: string): string[] {
  const filler = new Set(['jose', 'madrid', 'salsa', 'the', 'of', 'and', 'garden', 'fresh', 'original', '13', 'oz'])
  return name
    .toLowerCase()
    .replace(/&/g, ' and ')
    .replace(/x\s*x/g, 'xx')
    .replace(/[^a-z0-9 ]+/g, ' ')
    .split(/\s+/)
    .filter((w) => w && !filler.has(w))
}

function sameName(a: string, b: string): boolean {
  const ta = nameTokens(a)
  const tb = nameTokens(b)
  return ta.length > 0 && ta.length === tb.length && ta.every((w) => tb.includes(w))
}

/**
 * Pair every kiosk flavor with an active product: a barcode match whose name also agrees
 * wins, then a lone barcode match, then an exact name match. Each product is used once.
 */
export function matchKioskProducts(
  products: CatalogProduct[],
  flavors: readonly KioskFlavor[] = KIOSK_FLAVORS
): { items: KioskCatalogItem[]; unmatched: string[] } {
  const active = products.filter((p) => p.isActive)
  const taken = new Set<string>()

  const pick = (f: KioskFlavor): CatalogProduct | undefined => {
    const free = active.filter((p) => !taken.has(p.id))
    const byUpc = f.upc ? free.filter((p) => p.barcode === f.upc) : []
    return (
      byUpc.find((p) => sameName(p.name, f.name)) ??
      (byUpc.length === 1 && !flavors.some((o) => o !== f && o.upc === f.upc) ? byUpc[0] : undefined) ??
      free.find((p) => sameName(p.name, f.name))
    )
  }

  const items = flavors.map((f) => {
    const product = pick(f)
    if (product) taken.add(product.id)
    return {
      ...f,
      productId: product?.id ?? null,
      sku: product?.sku ?? null,
      // Reserved jars belong to orders waiting on payment; only the rest can be sold.
      inStock: !!product && product.inventory - product.stockReserved > 0,
    }
  })

  return { items, unmatched: items.filter((i) => !i.productId).map((i) => i.name) }
}

/** Flavors a scanned code could be. More than one means the UPC data is ambiguous. */
export function flavorsForUpc(code: string, flavors: readonly KioskFlavor[] = KIOSK_FLAVORS): KioskFlavor[] {
  const digits = code.replace(/\D/g, '')
  // Scanners may report UPC-A (12) or EAN-13 with a leading zero.
  const upc = digits.length === 13 && digits.startsWith('0') ? digits.slice(1) : digits
  return flavors.filter((f) => f.upc === upc)
}
