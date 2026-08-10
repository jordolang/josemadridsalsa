/**
 * How jars actually go in a box.
 *
 * The generic volume-fitting this replaces summed each item's bounding box and then picked the
 * smallest standard carton whose *volume* was larger. That is wrong for jars in two ways: volume
 * ignores that cylinders pack in a grid rather than pouring like liquid, and six jars do not stack
 * into a jar-shaped space. It produced a plausible box that was not the box.
 *
 * The real rule, from the warehouse: **three jars side by side make a line, four lines make a
 * case of twelve, one layer deep.** Smaller orders use smaller boxes on the same grid.
 *
 * Every number below is a stated assumption in one place, so correcting one corrects every quote.
 */

/**
 * Outside diameter of a 16oz regular-mouth mason jar, inches.
 *
 * Measured across the body, which is the widest point and therefore what decides the grid.
 */
export const JAR_DIAMETER_IN = 3.0

/** Height of the same jar with lid and band on, inches. */
export const JAR_HEIGHT_IN = 5.0

/** Jars per line, across the width of the box. */
export const JARS_PER_LINE = 3

/** Lines per case, along the depth of the box. `JARS_PER_LINE × LINES_PER_CASE` = 12. */
export const LINES_PER_CASE = 4

/** A full case. */
export const JARS_PER_CASE = JARS_PER_LINE * LINES_PER_CASE

/**
 * Weight of the empty jar, lid and band, ounces.
 *
 * **This is the number to check against a real scale.** `Product.weight` stores `16`, which is the
 * jar *size* — the net contents — not what the carrier weighs. Shipping on 16 oz under-declares a
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
export const DEFAULT_JAR_CONTENTS_OZ = 16

/** Corrugated box itself, ounces. Roughly constant across the sizes used here. */
export const BOX_TARE_OZ = 5

/** Dividers and paper per jar, ounces. */
export const PACKING_PER_JAR_OZ = 1

/** Clearance added across width and depth for box walls and a little slack, inches. */
export const BOX_WALL_ALLOWANCE_IN = 0.5

/** Padding above and below the jars, inches. */
export const BOX_VERTICAL_PADDING_IN = 0.75

/**
 * Gross shipping weight of one filled jar, in ounces.
 *
 * @param netContentsOz The jar size — 16 for a 16oz jar. This is what `Product.weight` holds.
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
  /** The grid, for showing staff what to pack. */
  jarsAcross: number
  lines: number
  layers: number
}

const round = (value: number) => Math.round(value * 100) / 100

/**
 * Size the parcel for a number of jars.
 *
 * Beyond one case the jars are modelled as **stacked cases in a single taller parcel**, because the
 * carrier client quotes one parcel per shipment. That is a real approximation and it is stated
 * rather than hidden: a genuine three-case order ships as three boxes, and quoting it as one tall
 * box gets the weight right but the dimensional pricing wrong. Splitting a quote across boxes needs
 * multi-parcel support at the carrier layer.
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
    return {
      length: 0,
      width: 0,
      height: 0,
      weightOz: 0,
      boxes: 0,
      jarsAcross: 0,
      lines: 0,
      layers: 0,
    }
  }

  const boxes = Math.ceil(jars / JARS_PER_CASE)
  const jarsInFootprint = Math.min(jars, JARS_PER_CASE)

  // A short order is a short box: one jar does not ship in a twelve-jar carton.
  const jarsAcross = Math.min(jarsInFootprint, JARS_PER_LINE)
  const lines = Math.ceil(jarsInFootprint / JARS_PER_LINE)
  // Full cases stack; a partial case sits on top of them as its own layer.
  const layers = boxes

  const width = jarsAcross * JAR_DIAMETER_IN + BOX_WALL_ALLOWANCE_IN
  const depth = lines * JAR_DIAMETER_IN + BOX_WALL_ALLOWANCE_IN
  const height = layers * JAR_HEIGHT_IN + BOX_VERTICAL_PADDING_IN

  // Contents at their real density, plus the glass and lid for each jar. Falls back to one jar's
  // worth apiece when the caller knows only how many there are.
  const netContents = totalNetContentsOz ?? jars * DEFAULT_JAR_CONTENTS_OZ
  const jarWeight = netContents * SALSA_SPECIFIC_GRAVITY + jars * JAR_TARE_OZ
  const packaging = boxes * BOX_TARE_OZ + jars * PACKING_PER_JAR_OZ

  // Longest side is the length, which is how carriers describe a parcel.
  const [length, shorter] = depth >= width ? [depth, width] : [width, depth]

  return {
    length: round(length),
    width: round(shorter),
    height: round(height),
    weightOz: round(jarWeight + packaging),
    boxes,
    jarsAcross,
    lines,
    layers,
  }
}

/** Human description of the packing, for the admin fulfillment screen. */
export function describeJarPacking(parcel: JarParcel): string {
  if (parcel.boxes === 0) return 'Nothing to pack'
  const grid = `${parcel.lines} line${parcel.lines === 1 ? '' : 's'} of ${parcel.jarsAcross}`
  return parcel.boxes === 1
    ? `${grid} — ${parcel.length}″ × ${parcel.width}″ × ${parcel.height}″, ${(parcel.weightOz / 16).toFixed(1)} lb`
    : `${parcel.boxes} boxes, ${grid} each — quoted as one parcel of ${(parcel.weightOz / 16).toFixed(1)} lb`
}
