/**
 * Which box an order of jars ships in, and what it weighs.
 *
 * The boxes are the ones the warehouse actually uses, picked by jar count. Checkout quotes, EasyPost
 * labels and the Pirate Ship export all size parcels from `SHIPPING_BOXES`, so changing a box here
 * changes it everywhere.
 *
 * Every number below is a stated assumption in one place, so correcting one corrects every quote.
 */

export interface ShippingBox {
  name: string
  /** Most jars this box holds. */
  maxJars: number
  /** Outer dimensions, inches, longest side first. */
  length: number
  width: number
  height: number
}

/** The warehouse's boxes, smallest first. */
export const SHIPPING_BOXES: readonly ShippingBox[] = [
  { name: '1–3 jar box', maxJars: 3, length: 10, width: 7, height: 5 },
  { name: '4–6 jar box', maxJars: 6, length: 12, width: 9, height: 6 },
  { name: 'Case box', maxJars: 12, length: 14, width: 10, height: 8 },
  { name: '2-case box', maxJars: 24, length: 20, width: 15, height: 9 },
]

/** A full case. */
export const JARS_PER_CASE = 12

/** The biggest box, which larger orders are split across. */
const LARGEST_BOX = SHIPPING_BOXES[SHIPPING_BOXES.length - 1]

/** The smallest box that holds this many jars, or the largest box when none does. */
export function boxForJars(jarCount: number): ShippingBox {
  return SHIPPING_BOXES.find((box) => jarCount <= box.maxJars) ?? LARGEST_BOX
}

/**
 * Weight of the empty jar, lid and band, ounces.
 *
 * **This is the number to check against a real scale.** `Product.weight` stores `13`, which is the
 * jar *size* — the net contents — not what the carrier weighs. Shipping on 13 oz under-declares a
 * jar by roughly two thirds, and an under-declared parcel is rejected at the counter or surcharged
 * after the fact.
 *
 * Empty regular-mouth pint jar ≈ 9.8 oz, lid and band ≈ 0.7 oz.
 */
export const JAR_TARE_OZ = 10.5

/**
 * Density of salsa relative to water, for turning fluid ounces of contents into weight.
 *
 * Salsa is a little denser than water — tomato solids and salt — so 16 *fluid* ounces weighs a
 * little over 16 ounces. Ignoring this under-declares every parcel slightly.
 */
export const SALSA_SPECIFIC_GRAVITY = 1.04

/** Net contents of the standard jar, ounces — used only when a caller knows just the count. */
export const DEFAULT_JAR_CONTENTS_OZ = 13

/** Corrugated box itself, ounces. Roughly constant across the sizes used here. */
export const BOX_TARE_OZ = 5

/** Dividers and paper per jar, ounces. */
export const PACKING_PER_JAR_OZ = 1

/**
 * Gross shipping weight of one filled jar, in ounces.
 *
 * @param netContentsOz The jar size — 13 for a 13oz jar. This is what `Product.weight` holds.
 */
export function jarGrossWeightOz(netContentsOz: number): number {
  return netContentsOz * SALSA_SPECIFIC_GRAVITY + JAR_TARE_OZ
}

export interface JarParcel {
  /** Outer dimensions, inches. */
  length: number
  width: number
  height: number
  /** Total declared weight including jars, dividers and the box itself, ounces. */
  weightOz: number
  /** How many boxes this many jars really needs. */
  boxes: number
  /** The box the jars go in, for showing staff what to pack. Null when there is nothing to pack. */
  box: ShippingBox | null
}

const round = (value: number) => Math.round(value * 100) / 100

/**
 * Size the parcel for a number of jars.
 *
 * Beyond the largest box the jars are modelled as **stacked 2-case boxes in a single taller
 * parcel**, because the carrier client quotes one parcel per shipment. That is a real approximation
 * and it is stated rather than hidden: a genuine 36-jar order ships as two boxes, and quoting it as
 * one tall box gets the weight right but the dimensional pricing wrong. Splitting a quote across
 * boxes needs multi-parcel support at the carrier layer.
 */
export function packJars(
  jarCount: number,
  /**
   * Total **net contents** across the jars, in ounces — the sum of each product's `weight`.
   *
   * Passed in rather than assumed per jar, because the catalogue is not guaranteed uniform: a 32oz
   * jar weighs twice a 16oz one and multiplying a count by a fixed size would silently ignore that.
   * Defaults to a jar apiece for callers that only know the count.
   */
  totalNetContentsOz?: number
): JarParcel {
  const jars = Math.max(0, Math.floor(jarCount))

  if (jars === 0) {
    return { length: 0, width: 0, height: 0, weightOz: 0, boxes: 0, box: null }
  }

  const box = boxForJars(jars)
  const boxes = Math.ceil(jars / LARGEST_BOX.maxJars)

  // Contents at their real density, plus the glass and lid for each jar. Falls back to one jar's
  // worth apiece when the caller knows only how many there are.
  const netContents = totalNetContentsOz ?? jars * DEFAULT_JAR_CONTENTS_OZ
  const jarWeight = netContents * SALSA_SPECIFIC_GRAVITY + jars * JAR_TARE_OZ
  const packaging = boxes * BOX_TARE_OZ + jars * PACKING_PER_JAR_OZ

  return {
    length: box.length,
    width: box.width,
    height: box.height * boxes,
    weightOz: round(jarWeight + packaging),
    boxes,
    box,
  }
}

/** Human description of the packing, for the admin fulfillment screen. */
export function describeJarPacking(parcel: JarParcel): string {
  if (parcel.boxes === 0 || !parcel.box) return 'Nothing to pack'
  const { name, length, width, height } = parcel.box
  const size = `${length}″ × ${width}″ × ${height}″`
  const pounds = `${(parcel.weightOz / 16).toFixed(1)} lb`
  return parcel.boxes === 1
    ? `${name} — ${size}, ${pounds}`
    : `${parcel.boxes} × ${name} (${size}) — quoted as one parcel of ${pounds}`
}
