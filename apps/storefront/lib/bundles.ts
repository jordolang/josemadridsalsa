/**
 * Mix-and-match salsa packs — "Choose 3", "Choose 5", "Choose 6", "Choose 12".
 *
 * A pack is sold at its own price: five jars in a Choose 5 cost $28, not five times the
 * catalogue price. That price is the whole point of the offer, so it is defined once here
 * and read by everything that quotes or charges it — the pages that advertise a pack, the
 * cart, and all three checkout routes.
 *
 * It used to be written out twice in the storefront and nowhere on the server: the selector
 * added the chosen jars to the cart at catalogue price and checkout re-priced them from the
 * catalogue again, so a pack advertised at $28 was charged at $45.
 */

export interface SalsaBundle {
  /** Stable id, carried on every cart line and checkout item belonging to a pack. */
  id: string
  name: string
  /** How many jars the pack holds. A pack is priced only when it holds exactly this many. */
  size: number
  /** What the customer pays for the whole pack, however the jars are chosen. */
  price: number
  image: string
  description: string
}

export const SALSA_BUNDLES: readonly SalsaBundle[] = [
  {
    id: 'choose-3',
    name: 'Choose 3 Pack',
    size: 3,
    price: 23.0,
    image:
      'https://can9pwc8drhj1bme.public.blob.vercel-storage.com/site/images/new-products/3-product-box.webp',
    description: 'Perfect gift for trying new flavors',
  },
  {
    id: 'choose-5',
    name: 'Choose 5 Pack',
    size: 5,
    price: 28.0,
    image:
      'https://can9pwc8drhj1bme.public.blob.vercel-storage.com/site/images/new-products/6-products.webp',
    description: 'Great variety for any occasion',
  },
  {
    id: 'choose-6',
    name: 'Choose 6 Pack',
    size: 6,
    price: 32.0,
    image:
      'https://can9pwc8drhj1bme.public.blob.vercel-storage.com/site/images/new-products/6-products.webp',
    description: 'Popular choice for families',
  },
  {
    id: 'choose-12',
    name: 'Choose 12 Pack',
    size: 12,
    price: 60.0,
    image:
      'https://can9pwc8drhj1bme.public.blob.vercel-storage.com/site/images/new-products/12-products.webp',
    description: 'Best value - stock up and save',
  },
] as const

export function getSalsaBundle(bundleId: string): SalsaBundle | undefined {
  return SALSA_BUNDLES.find((bundle) => bundle.id === bundleId)
}

/**
 * A cart line as both the browser and the checkout routes see it.
 *
 * `bundleId` says which pack a line belongs to; `bundleGroupId` says which *instance* of
 * that pack, so two Choose 5 packs in one cart stay separate and each is checked for the
 * right number of jars on its own.
 */
export interface BundleCartLine {
  productId: string
  quantity: number
  bundleId?: string | null
  bundleGroupId?: string | null
}

export type PricedCartLine<T extends BundleCartLine> = T & {
  /** What one jar on this line costs. Inside a pack this is a share of the pack price. */
  unitPrice: number
  /** What the line costs in total. Authoritative — see the note on rounding below. */
  lineTotal: number
}

/** Thrown when a pack cannot be priced. Callers turn this into a 400, never a silent sale. */
export class BundlePricingError extends Error {
  constructor(message: string) {
    super(message)
    this.name = 'BundlePricingError'
  }
}

const round2 = (value: number) => Math.round(value * 100) / 100

const toCents = (value: number) => Math.round(value * 100)

/**
 * Split `totalCents` across `weights` so the parts sum to exactly `totalCents`.
 *
 * Largest remainder: each line gets its floor share and the leftover cents go to the lines
 * with the largest fractional part. Without it a pack of three at $23 would come to $23.01
 * or $22.99 depending on which way each line rounded.
 */
export function allocateCents(totalCents: number, weights: number[]): number[] {
  const weightTotal = weights.reduce((sum, weight) => sum + weight, 0)
  // Every jar free is a legitimate catalogue state; splitting by weight would divide by zero,
  // so fall back to an even split.
  const shares = weightTotal > 0 ? weights : weights.map(() => 1)
  const shareTotal = shares.reduce((sum, share) => sum + share, 0)

  const allocated = shares.map((share) => Math.floor((totalCents * share) / shareTotal))
  const remainders = shares.map((share, index) => ({
    index,
    fraction: (totalCents * share) / shareTotal - allocated[index],
  }))

  // Each floor above loses less than a cent, so the leftover never exceeds the line count.
  const leftover = totalCents - allocated.reduce((sum, cents) => sum + cents, 0)
  remainders
    .sort((a, b) => b.fraction - a.fraction || a.index - b.index)
    .slice(0, Math.max(leftover, 0))
    .forEach((entry) => {
      allocated[entry.index] += 1
    })

  return allocated
}

/**
 * Price a cart, pack-aware.
 *
 * Loose lines are priced at whatever `retailUnitPrice` returns for them — the catalogue
 * price, or a fundraiser's own price. Lines carrying a `bundleGroupId` are grouped, checked
 * against the pack they claim to be, and priced so the group totals exactly the pack price.
 *
 * The pack price is read from `SALSA_BUNDLES` here rather than taken from the caller, for
 * the same reason checkout recomputes shipping and discounts server-side: the browser may
 * not name its own price.
 *
 * Where a jar appears twice in one pack, its line total is exact but its unit price can
 * carry a half cent (two jars sharing $15.33). `lineTotal` is the figure to sum; a unit
 * price is a display of it.
 */
export function priceCartLines<T extends BundleCartLine>(
  lines: readonly T[],
  retailUnitPrice: (line: T) => number
): Array<PricedCartLine<T>> {
  const priced = new Array<PricedCartLine<T>>(lines.length)
  const groups = new Map<string, number[]>()

  lines.forEach((line, index) => {
    if (line.bundleGroupId && !line.bundleId) {
      throw new BundlePricingError('A pack item arrived without the pack it belongs to.')
    }
    if (line.bundleId && !line.bundleGroupId) {
      throw new BundlePricingError('A pack item arrived without its pack group.')
    }

    if (!line.bundleGroupId) {
      const unitPrice = retailUnitPrice(line)
      priced[index] = { ...line, unitPrice, lineTotal: round2(unitPrice * line.quantity) }
      return
    }

    const group = groups.get(line.bundleGroupId)
    if (group) {
      group.push(index)
    } else {
      groups.set(line.bundleGroupId, [index])
    }
  })

  for (const indexes of groups.values()) {
    const groupLines = indexes.map((index) => lines[index])
    const bundleId = groupLines[0].bundleId as string

    if (groupLines.some((line) => line.bundleId !== bundleId)) {
      throw new BundlePricingError('A pack cannot mix items from two different packs.')
    }

    const bundle = getSalsaBundle(bundleId)
    if (!bundle) {
      throw new BundlePricingError(`Unknown pack: ${bundleId}.`)
    }

    const jars = groupLines.reduce((sum, line) => sum + line.quantity, 0)
    if (jars !== bundle.size) {
      throw new BundlePricingError(
        `A ${bundle.name} holds ${bundle.size} jars, but ${jars} were sent.`
      )
    }

    const weights = groupLines.map((line) => toCents(retailUnitPrice(line)) * line.quantity)
    const allocated = allocateCents(toCents(bundle.price), weights)

    indexes.forEach((lineIndex, position) => {
      const line = lines[lineIndex]
      const lineTotal = allocated[position] / 100
      priced[lineIndex] = {
        ...line,
        unitPrice: round2(lineTotal / line.quantity),
        lineTotal,
      }
    })
  }

  return priced
}

/**
 * What one jar usually sells for, for the "was $45, save $17" copy beside a pack.
 *
 * The most common price in the catalogue rather than the highest or the average, so a single
 * odd-priced item cannot overstate the saving; ties go to the cheaper price. The savings copy
 * used to be figured against a jar price hardcoded at $7, which stopped being true when the
 * catalogue moved and left the packs advertising a discount narrower than the real one.
 */
export function typicalJarPrice(prices: number[]): number | null {
  const counts = new Map<number, number>()
  for (const price of prices) {
    if (!Number.isFinite(price) || price <= 0) continue
    const cents = toCents(price)
    counts.set(cents, (counts.get(cents) ?? 0) + 1)
  }

  if (counts.size === 0) return null

  const [cents] = Array.from(counts.entries()).sort(
    (a, b) => b[1] - a[1] || a[0] - b[0]
  )[0]

  return cents / 100
}

/** What a pack saves against buying its jars one by one, or null when it saves nothing. */
export function bundleSavings(bundle: SalsaBundle, jarPrice: number | null): number | null {
  if (!jarPrice) return null
  const saving = round2(jarPrice * bundle.size - bundle.price)
  return saving > 0 ? saving : null
}
