/**
 * Shipping Calculator - Calculate shipping costs for orders
 * José Madrid Salsa E-commerce Platform
 */

import {
  getShippingRates,
  type ShipmentRequest,
  type ShippingAddress,
  type Parcel,
} from './shipping-api'
import { prisma } from './prisma'
import { describeMissingOrigin, getShippingOrigin } from './shipping/origin'
import { packJars } from './shipping/jar-packing'
import {
  DEFAULT_RATE_CONFIG,
  estimateDomesticCost,
  flatEstimateCost,
  getShippingRateConfig,
  internationalCost,
  type ShippingRateConfig,
} from './shipping/rate-config'

/**
 * One line of an order, as the shipping calculator needs it.
 *
 * `weightOz` carries its unit in its name on purpose. It used to be `weight`, documented as
 * pounds — while every caller passed `Product.weight`, which is **ounces** (a jar is `16`; see
 * `lib/feeds/products.ts`, which maps the same column to `weightOz` for the Google and Amazon
 * feeds). Both code paths here then treated it as pounds, so every quote was 16× overweight: a
 * single 16oz jar priced as 16 lb, which tripped the heavy-parcel surcharge and cost $10.49
 * instead of $6.99, and a six-jar order quoted as 96 lb.
 *
 * Naming the unit is the fix that stops it recurring — a mismatch is now visible at the call
 * site instead of hidden behind a comment that disagreed with reality.
 */
export interface ShippingItem {
  /** Weight of a single unit, in **ounces**. */
  weightOz?: number
  /** Dimensions of a single unit, in inches. */
  dimensions?: {
    length?: number
    width?: number
    height?: number
  }
  quantity: number
}

export interface ShippingCalculationInput {
  /** Items in the order */
  items: ShippingItem[]
  /** Shipping address */
  shippingAddress: {
    line1?: string
    line2?: string
    city?: string
    state: string
    postalCode: string
    country: string
  }
  /** Subtotal amount for percentage-based calculations */
  subtotal: number
}

export interface ShippingCalculationResult {
  /** Shipping cost in dollars */
  shippingCost: number
  /** Shipping method selected */
  shippingMethod: string
  /** Estimated delivery time */
  estimatedDelivery: string
  /** Available shipping options */
  availableOptions?: Array<{
    method: string
    cost: number
    estimatedDays: string
    estimatedDeliveryDate?: string
  }>
  /** Flag indicating if fallback estimate rates were used */
  fallback?: boolean
}

export const OUNCES_PER_POUND = 16

/**
 * Assumed weight of a unit whose product has none recorded.
 *
 * 16 oz, because the catalogue is 16oz jars — six of the thirty-four active products have a null
 * `weight`, and assuming a jar is a jar is far closer than any generic default. It is deliberately
 * a documented assumption rather than a silent `1`: an under-declared parcel gets rejected at the
 * counter, so a wrong guess here should be wrong in the safe direction.
 */
export const DEFAULT_ITEM_WEIGHT_OZ = 16

/**
 * Assumed dimensions of a unit whose product has none recorded — which is currently **all** of
 * them, since no product carries `lengthInches`/`widthInches`/`heightInches`. Roughly a 16oz jar.
 *
 * The box-selection logic below is real bin packing over `STANDARD_BOXES`; it is only ever as good
 * as these numbers. Entering real per-product dimensions is what makes it accurate.
 */
export const DEFAULT_ITEM_DIMENSIONS = { length: 3.5, width: 3.5, height: 5 } as const

/** Above this, the estimate path charges per pound instead of the flat rate. */
export const WEIGHT_SURCHARGE_THRESHOLD_LB = 5

/** Total parcel weight in ounces. One definition, so the two rate paths cannot disagree. */
export function totalWeightOunces(items: ShippingItem[]): number {
  return items.reduce(
    (sum, item) => sum + (item.weightOz ?? DEFAULT_ITEM_WEIGHT_OZ) * item.quantity,
    0
  )
}

/** The product columns needed to ship a line. All nullable — nothing is guaranteed populated. */
export interface ShippableProduct {
  weight?: number | string | { toString(): string } | null
  lengthInches?: number | string | { toString(): string } | null
  widthInches?: number | string | { toString(): string } | null
  heightInches?: number | string | { toString(): string } | null
}

const toNumber = (value: ShippableProduct[keyof ShippableProduct]): number | undefined => {
  if (value === null || value === undefined) return undefined
  const parsed = Number(value.toString())
  return Number.isFinite(parsed) && parsed > 0 ? parsed : undefined
}

/**
 * Turn order lines plus their products into shipping items.
 *
 * Five checkout routes each had their own copy of this mapping, all five spelling the weight
 * `weight: Number(product.weight)` with a comment claiming pounds. One definition means a unit
 * mistake can only be made once, and it is the only place that knows `Product.weight` is ounces
 * and `Product.*Inches` are inches.
 *
 * Dimensions are included, which no caller used to pass — so every parcel was sized from the
 * fallback regardless of what the catalogue knew.
 */
export function buildShippingItems<T extends { productId: string; quantity: number }>(
  lines: T[],
  products: Map<string, ShippableProduct>
): ShippingItem[] {
  return lines.map((line) => {
    const product = products.get(line.productId)
    const length = toNumber(product?.lengthInches)
    const width = toNumber(product?.widthInches)
    const height = toNumber(product?.heightInches)

    return {
      weightOz: toNumber(product?.weight),
      // Omitted entirely when the product has no dimensions, so the documented fallback applies
      // rather than a half-populated box with zeroes in it.
      ...(length && width && height ? { dimensions: { length, width, height } } : {}),
      quantity: line.quantity,
    }
  })
}

/**
 * Estimated delivery windows for the estimate/fallback path. These are descriptive copy, not
 * prices, so they stay here — the configurable *money* (flat rate, weight surcharge, international
 * rate, state multipliers) now lives on the `ShippingSettings` singleton via
 * `lib/shipping/rate-config.ts`.
 */
const ESTIMATED_DAYS = {
  standard: '3-5 business days',
  international: '7-14 business days',
} as const

// The origin now comes from `lib/shipping/origin.ts`, which reads the admin setting first and the
// environment second. It replaced a constant here that defaulted to `123 Main St, San Francisco,
// CA 94111` — so an unconfigured deployment quoted every rate from the wrong coast and the
// response looked entirely normal.

/**
 * Detect if an address is a PO Box
 *
 * PO Boxes have delivery restrictions - only USPS can deliver to them.
 * UPS, FedEx, and other carriers cannot deliver to PO Boxes.
 *
 * @param address Address line to check
 * @returns True if address appears to be a PO Box
 */
function isPOBox(address: string | undefined): boolean {
  if (!address) return false

  const normalizedAddress = address.toUpperCase().replace(/\./g, '')

  // Common PO Box patterns
  const poBoxPatterns = [
    /\bP\s*O\s+BOX\b/,           // PO BOX, P.O. BOX, P O BOX
    /\bPO\s+BOX\b/,              // PO BOX
    /\bPOST\s+OFFICE\s+BOX\b/,  // POST OFFICE BOX
    /\bP\s*O\s*B\b/,             // POB, P.O.B
    /^\s*BOX\s+\d+/,              // BOX 123 (only at start of address)
  ]

  return poBoxPatterns.some(pattern => pattern.test(normalizedAddress))
}

/**
 * Detect if an address is likely residential vs commercial
 *
 * This is a heuristic check - real carrier APIs do more sophisticated detection.
 * Residential addresses may have different rates than commercial addresses.
 *
 * @param address Shipping address to check
 * @returns 'residential' | 'commercial' | 'unknown'
 */

/**
 * Standard shipping box sizes (USPS/UPS/FedEx common sizes)
 * Dimensions in inches: length x width x height
 * Sorted by volume (smallest to largest) for optimal box selection
 */
const STANDARD_BOXES = [
  { name: 'Small', length: 8, width: 6, height: 4, volume: 192 },
  { name: 'Medium Flat', length: 12, width: 9, height: 3, volume: 324 },
  { name: 'Medium', length: 11, width: 8.5, height: 5.5, volume: 514 },
  { name: 'Large Flat', length: 15, width: 12, height: 3, volume: 540 },
  { name: 'Large', length: 16, width: 12, height: 8, volume: 1536 },
  { name: 'Extra Large', length: 18, width: 14, height: 12, volume: 3024 },
  { name: 'Oversized', length: 24, width: 18, height: 12, volume: 5184 },
] as const

/**
 * Whether an order is entirely jars, and therefore packs on the warehouse grid.
 *
 * A product with real dimensions recorded is something other than a jar — merchandise, a gift set —
 * and goes through the generic volume fit below instead.
 */
function isAllJars(items: ShippingItem[]): boolean {
  return items.length > 0 && items.every((item) => !item.dimensions)
}

/** Total jars in an order. Only meaningful once `isAllJars` says so. */
function totalJarCount(items: ShippingItem[]): number {
  return items.reduce((sum, item) => sum + item.quantity, 0)
}

/**
 * The parcel a set of items actually ships in.
 *
 * **Jars take the warehouse grid** — three across, four lines to a case of twelve — via
 * `lib/shipping/jar-packing.ts`, which also computes the *gross* weight: glass, lid, contents,
 * dividers and box. That matters because `Product.weight` holds `16`, the jar size, and shipping a
 * jar as 16 oz under-declares it by about two thirds.
 *
 * Anything with real recorded dimensions falls through to the generic volume fit against
 * `STANDARD_BOXES`, which is the previous behaviour and is fine for non-cylinders.
 */
export function calculateOrderParcel(items: ShippingItem[]): Parcel {
  if (isAllJars(items)) {
    // Real per-item contents, not a count times a guess: a 32oz jar weighs twice a 16oz one.
    const packed = packJars(totalJarCount(items), totalWeightOunces(items))
    return {
      length: packed.length,
      width: packed.width,
      height: packed.height,
      weight: packed.weightOz,
    }
  }

  return calculateParcelDimensions(items)
}

/**
 * Generic bin packing for items that are not jars.
 *
 * Strategy:
 * 1. Calculate total volume of all items
 * 2. Find smallest standard box that can fit the volume
 * 3. Verify largest item dimensions fit within selected box
 * 4. Fall back to custom dimensions if no standard box fits
 */
function calculateParcelDimensions(
  items: ShippingCalculationInput['items']
): Parcel {
  // Through the shared helper rather than a second accumulator. Two paths computing parcel
  // weight their own way is precisely how one of them ended up 16x out.
  const totalWeight = totalWeightOunces(items)
  let totalVolume = 0
  let maxItemLength = 0
  let maxItemWidth = 0
  let maxItemHeight = 0

  // Collect item dimensions
  for (const item of items) {
    // Dimensions - use defaults if not provided
    const dims = item.dimensions || DEFAULT_ITEM_DIMENSIONS
    const length = dims.length || DEFAULT_ITEM_DIMENSIONS.length
    const width = dims.width || DEFAULT_ITEM_DIMENSIONS.width
    const height = dims.height || DEFAULT_ITEM_DIMENSIONS.height

    // Calculate volume for each item instance
    const itemVolume = length * width * height
    totalVolume += itemVolume * item.quantity

    // Track largest individual item dimensions (for fit check)
    maxItemLength = Math.max(maxItemLength, length)
    maxItemWidth = Math.max(maxItemWidth, width)
    maxItemHeight = Math.max(maxItemHeight, height)
  }

  // Calculate total stacked height (sum of all item heights) for per-dimension check
  const totalStackedHeight = items.reduce((sum, item) => {
    const height = item.dimensions?.height || 2
    return sum + height * item.quantity
  }, 0)

  // Find the smallest standard box that can fit all items
  for (const box of STANDARD_BOXES) {
    // Check if total volume fits
    if (totalVolume <= box.volume) {
      // Verify largest item dimensions fit within box
      // Items can be rotated, so check if dimensions fit in any orientation
      const itemDimensions = [maxItemLength, maxItemWidth, maxItemHeight].sort(
        (a, b) => b - a
      )
      const boxDimensions = [box.length, box.width, box.height].sort((a, b) => b - a)

      // Check if each item dimension fits within corresponding box dimension
      if (
        itemDimensions[0] <= boxDimensions[0] &&
        itemDimensions[1] <= boxDimensions[1] &&
        itemDimensions[2] <= boxDimensions[2]
      ) {
        // Also verify all units physically stack within the box's shortest dimension.
        // Volume alone doesn't guarantee fit (e.g. two flat items may not stack in a
        // shallow box). Use the smallest box dimension as the stacking axis.
        if (totalStackedHeight <= boxDimensions[2]) {
          // Found a suitable standard box
          return {
            length: box.length,
            width: box.width,
            height: box.height,
            weight: totalWeight,
          }
        }
      }
    }
  }

  // Fallback: No standard box fits, use custom dimensions
  // Use max dimensions approach with height stacking
  const maxLength = maxItemLength
  const maxWidth = maxItemWidth
  const stackedHeight = Math.min(
    items.reduce((sum, item) => {
      const height = item.dimensions?.height || 2
      return sum + height * item.quantity
    }, 0),
    24 // Cap at 24 inches for carrier limits
  )

  return {
    length: Math.max(maxLength, 10), // Minimum 10 inches
    width: Math.max(maxWidth, 8), // Minimum 8 inches
    height: Math.max(stackedHeight, 2), // Minimum 2 inches
    weight: totalWeight,
  }
}

/**
 * Fallback shipping calculation using estimate-based rates
 *
 * Used when API is unavailable to ensure checkout is never blocked
 */
function calculateEstimateRates(
  input: ShippingCalculationInput,
  markAsFallback = false,
  config: ShippingRateConfig = DEFAULT_RATE_CONFIG
): ShippingCalculationResult {
  const { items, shippingAddress } = input

  // International shipping
  if (shippingAddress.country !== 'US') {
    return {
      shippingCost: internationalCost(config),
      shippingMethod: 'International Shipping',
      estimatedDelivery: ESTIMATED_DAYS.international,
      fallback: markAsFallback,
    }
  }

  // Check if destination is a PO Box
  const isPoBox = isPOBox(shippingAddress.line1) || isPOBox(shippingAddress.line2)

  // The same parcel the carrier path would quote, so the estimate and the real rate are priced on
  // one weight. Reading it off the parcel rather than recomputing is what stops the two drifting —
  // the original bug was exactly two paths measuring weight their own way.
  const totalPounds = calculateOrderParcel(items).weight / OUNCES_PER_POUND

  // Flat rate, bumped to the weight-based price over the threshold, then scaled by the state
  // multiplier — all driven by the admin-configurable rate config.
  const finalCost = estimateDomesticCost({
    pounds: totalPounds,
    state: shippingAddress.state,
    config,
  })

  // Build the single available option based on address type.
  // Standard shipping is the only method offered.
  const availableOptions = [
    {
      // Only USPS can deliver to a PO Box
      method: isPoBox ? 'USPS Ground Advantage' : 'Standard Shipping',
      cost: finalCost,
      estimatedDays: ESTIMATED_DAYS.standard,
    },
  ]

  return {
    shippingCost: availableOptions[0].cost,
    shippingMethod: availableOptions[0].method,
    estimatedDelivery: availableOptions[0].estimatedDays,
    availableOptions,
    fallback: markAsFallback,
  }
}

/**
 * Calculate shipping cost for an order using real carrier API
 *
 * Strategy:
 * 1. Call the real carrier API for accurate rates
 * 2. Return the single standard shipping option
 * 3. Fall back to estimate-based rates if the API fails (never block checkout)
 *
 * **There is no free-shipping path.** Shipping is charged on every order, without exception —
 * a threshold that zeroed the cost was removed because the business does not offer free shipping.
 *
 * Follows error handling pattern from lib/tax-calculator.ts
 */
export async function calculateShipping(
  input: ShippingCalculationInput
): Promise<ShippingCalculationResult> {
  const { items, shippingAddress } = input

  // Admin-configurable flat-rate presets for any estimate/fallback below. Live carrier rates, when
  // available, are used ahead of these and are unaffected. Never throws — defaults on any DB issue.
  const rateConfig = await getShippingRateConfig()

  // For international shipping, fall back to estimate rates for now
  // TODO: Add international shipping API support
  if (shippingAddress.country !== 'US') {
    return calculateEstimateRates(input, false, rateConfig)
  }

  // No origin means no honest carrier rate. Estimates are used instead and say so via `fallback`,
  // rather than quoting real-looking prices from a placeholder address.
  const originResult = await getShippingOrigin()
  if (!originResult.ok) {
    console.error(`[Shipping Calculator] ${describeMissingOrigin(originResult.missing)}`)
    return calculateEstimateRates(input, true, rateConfig)
  }

  try {
    // Jars pack on the warehouse grid; anything else falls back to a volume fit.
    const parcel = calculateOrderParcel(items)

    // Build shipping API request
    const shipmentRequest: ShipmentRequest = {
      fromAddress: originResult.origin,
      toAddress: {
        street1: shippingAddress.line1 || '123 Main St', // Placeholder if not provided
        street2: shippingAddress.line2,
        city: shippingAddress.city || 'City',
        state: shippingAddress.state,
        zip: shippingAddress.postalCode,
        country: shippingAddress.country,
      },
      parcel,
    }

    // Get real carrier rates from API
    const ratesResponse = await getShippingRates(shipmentRequest)

    // If API returned rates, use them
    if (ratesResponse.rates.length > 0) {
      // Check if destination is a PO Box
      const isPoBox = isPOBox(shippingAddress.line1) || isPOBox(shippingAddress.line2)

      // Filter rates based on address type
      let filteredRates = ratesResponse.rates

      if (isPoBox) {
        // Only USPS can deliver to PO Boxes
        filteredRates = ratesResponse.rates.filter((rate) =>
          rate.carrier.toUpperCase().includes('USPS')
        )

        console.log('[Shipping Calculator] PO Box detected - filtering to USPS only')

        // If no USPS rates available, fall back to estimates
        if (filteredRates.length === 0) {
          console.warn('[Shipping Calculator] No USPS rates available for PO Box, using estimates')
          return calculateEstimateRates(input, true, rateConfig)
        }
      }

      // Sort rates by cost (cheapest first)
      const sortedRates = [...filteredRates].sort((a, b) => a.rate - b.rate)

      // Only standard shipping is offered, so expose a single option: the
      // cheapest carrier rate. Expedited/express services are never surfaced.
      const cheapestRate = sortedRates[0]

      const availableOptions = [
        {
          method: `${cheapestRate.carrier} ${cheapestRate.service}`,
          cost: cheapestRate.rate,
          estimatedDays: cheapestRate.deliveryDays
            ? `${cheapestRate.deliveryDays} business days`
            : '3-5 business days',
          estimatedDeliveryDate: cheapestRate.deliveryDate || undefined,
        },
      ]

      return {
        shippingCost: cheapestRate.rate,
        shippingMethod: `${cheapestRate.carrier} ${cheapestRate.service}`,
        estimatedDelivery: cheapestRate.deliveryDays
          ? `${cheapestRate.deliveryDays} business days`
          : '3-5 business days',
        availableOptions,
      }
    } else {
      // No rates returned - fall back to estimates
      console.warn('[Shipping Calculator] No rates returned from API, using estimates')
      return calculateEstimateRates(input, true, rateConfig)
    }
  } catch (error) {
    console.error('[Shipping Calculator] Error calculating shipping:', error)

    // For production: log error but return estimate rates to not block checkout
    // You may want to enable monitoring alerts or notify admins
    if (error instanceof Error) {
      console.error('[Shipping Calculator] Error details:', error.message)

      // Log specific error types for debugging
      if (error.message.includes('API key') || error.message.includes('authentication')) {
        console.error('[Shipping Calculator] Authentication error - check SHIPPING_API_KEY configuration')
      } else if (error.message.includes('network') || error.message.includes('timeout')) {
        console.error('[Shipping Calculator] Network error - carrier API may be unavailable')
      }
    }

    console.warn('[Shipping Calculator] Falling back to estimate-based rates')

    // Return estimate rates rather than failing checkout — with the admin's configured presets.
    return calculateEstimateRates(input, true, rateConfig)
  }
}

/**
 * Get shipping estimate for frontend preview
 */
export async function getShippingEstimate(params: {
  subtotal: number
  state: string
  country?: string
}): Promise<number> {
  const config = await getShippingRateConfig()

  if (params.country && params.country !== 'US') {
    return internationalCost(config)
  }

  return flatEstimateCost(params.state, config)
}

/**
 * Validate shipping address
 */
export function validateShippingAddress(address: {
  address1: string
  city: string
  state: string
  postalCode: string
  country: string
}): { valid: boolean; errors: string[] } {
  const errors: string[] = []

  if (!address.address1 || address.address1.length < 3) {
    errors.push('Address line 1 is required')
  }

  if (!address.city || address.city.length < 2) {
    errors.push('City is required')
  }

  if (!address.state || address.state.length !== 2) {
    errors.push('State must be a 2-letter code (e.g., CA, NY)')
  }

  if (!address.postalCode || address.postalCode.length < 5) {
    errors.push('Valid ZIP code is required')
  }

  if (!address.country || address.country.length !== 2) {
    errors.push('Country must be a 2-letter code (e.g., US)')
  }

  return {
    valid: errors.length === 0,
    errors,
  }
}
