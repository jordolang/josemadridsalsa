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

export interface ShippingCalculationInput {
  /** Items in the order */
  items: Array<{
    weight?: number // Weight in pounds
    dimensions?: {
      // Dimensions in inches
      length?: number
      width?: number
      height?: number
    }
    quantity: number
  }>
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

/**
 * Shipping rate configuration
 * Can be moved to database for dynamic configuration
 */
const SHIPPING_RATES = {
  // Free shipping threshold
  FREE_SHIPPING_THRESHOLD: 50,

  // Flat rate shipping
  FLAT_RATE: {
    cost: 6.99,
    estimatedDays: '3-5 business days',
  },

  // Weight-based shipping (per pound)
  WEIGHT_BASED: {
    baseRate: 4.99,
    perPound: 0.5,
    estimatedDays: '3-5 business days',
  },

  // Express shipping
  EXPRESS: {
    cost: 14.99,
    estimatedDays: '1-2 business days',
  },

  // International shipping (flat rate for simplicity)
  INTERNATIONAL: {
    cost: 24.99,
    estimatedDays: '7-14 business days',
  },

  // State-specific rates (for states with higher shipping costs)
  STATE_MULTIPLIERS: {
    AK: 1.5, // Alaska
    HI: 1.5, // Hawaii
    PR: 2.0, // Puerto Rico
  } as Record<string, number>,
}

/**
 * Default origin address for shipping calculations
 * Configurable via environment variables
 */
const DEFAULT_ORIGIN_ADDRESS: ShippingAddress = {
  street1: process.env.SHIPPING_ORIGIN_ADDRESS || '123 Main St',
  city: process.env.SHIPPING_ORIGIN_CITY || 'San Francisco',
  state: process.env.SHIPPING_ORIGIN_STATE || 'CA',
  zip: process.env.SHIPPING_ORIGIN_ZIP || '94111',
  country: 'US',
}

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
 * Get free shipping threshold from database settings
 *
 * Fetches the configurable free shipping threshold from ShippingSettings
 * Falls back to default value if settings don't exist
 *
 * Following error handling pattern from lib/tax-calculator.ts
 */
async function getFreeShippingThreshold(): Promise<number> {
  try {
    const settings = await prisma.shippingSettings.findUnique({
      where: { singleton: 'singleton' },
      select: { freeShippingThreshold: true },
    })

    if (settings?.freeShippingThreshold) {
      const parsed = parseFloat(settings.freeShippingThreshold.toString())
      if (Number.isFinite(parsed) && parsed > 0) {
        return parsed
      }
      console.warn('[Shipping Calculator] Invalid freeShippingThreshold in DB, using default')
    }

    // Return default if no settings found
    return SHIPPING_RATES.FREE_SHIPPING_THRESHOLD
  } catch (error) {
    console.error('[Shipping Calculator] Error fetching free shipping threshold:', error)

    // Return default threshold to not block checkout
    return SHIPPING_RATES.FREE_SHIPPING_THRESHOLD
  }
}

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
 * Calculate parcel dimensions from order items using bin packing
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
  let totalWeight = 0
  let totalVolume = 0
  let maxItemLength = 0
  let maxItemWidth = 0
  let maxItemHeight = 0

  // Collect item dimensions and calculate totals
  for (const item of items) {
    // Weight in pounds -> convert to ounces
    const itemWeight = (item.weight || 1.0) * 16 // Default 1 lb = 16 oz
    totalWeight += itemWeight * item.quantity

    // Dimensions - use defaults if not provided
    const dims = item.dimensions || { length: 10, width: 8, height: 2 }
    const length = dims.length || 10
    const width = dims.width || 8
    const height = dims.height || 2

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
  freeShippingThreshold: number,
  markAsFallback = false
): ShippingCalculationResult {
  const { items, shippingAddress, subtotal } = input

  // Free shipping for orders over threshold
  if (subtotal >= freeShippingThreshold) {
    return {
      shippingCost: 0,
      shippingMethod: 'Free Shipping',
      estimatedDelivery: SHIPPING_RATES.FLAT_RATE.estimatedDays,
      fallback: markAsFallback,
    }
  }

  // International shipping
  if (shippingAddress.country !== 'US') {
    return {
      shippingCost: SHIPPING_RATES.INTERNATIONAL.cost,
      shippingMethod: 'International Shipping',
      estimatedDelivery: SHIPPING_RATES.INTERNATIONAL.estimatedDays,
      fallback: markAsFallback,
    }
  }

  // Check if destination is a PO Box
  const isPoBox = isPOBox(shippingAddress.line1) || isPOBox(shippingAddress.line2)

  // Calculate total weight
  const totalWeight = items.reduce((sum, item) => {
    const itemWeight = item.weight || 1.0 // Default 1 lb per item if not specified
    return sum + itemWeight * item.quantity
  }, 0)

  // Base shipping cost (flat rate)
  let baseCost = SHIPPING_RATES.FLAT_RATE.cost

  // Apply weight-based pricing if items are heavy
  if (totalWeight > 5) {
    baseCost = Math.max(
      baseCost,
      SHIPPING_RATES.WEIGHT_BASED.baseRate +
        (totalWeight - 5) * SHIPPING_RATES.WEIGHT_BASED.perPound
    )
  }

  // Apply state multiplier for remote locations
  const stateMultiplier =
    SHIPPING_RATES.STATE_MULTIPLIERS[shippingAddress.state.toUpperCase()] || 1.0

  const finalCost = baseCost * stateMultiplier

  // Build available options based on address type
  const availableOptions = []

  if (isPoBox) {
    // PO Box - only USPS options
    const expressCost = SHIPPING_RATES.EXPRESS.cost * stateMultiplier

    availableOptions.push(
      {
        method: 'USPS Ground Advantage',
        cost: parseFloat(finalCost.toFixed(2)),
        estimatedDays: SHIPPING_RATES.FLAT_RATE.estimatedDays,
      },
      {
        method: 'USPS Priority Mail',
        cost: parseFloat((finalCost * 1.5).toFixed(2)),
        estimatedDays: '1-3 business days',
      },
      {
        method: 'USPS Priority Mail Express',
        // Make express free if it exceeds the subtotal
        cost: expressCost > subtotal ? 0 : expressCost,
        estimatedDays: SHIPPING_RATES.EXPRESS.estimatedDays,
      }
    )
  } else {
    // Regular address - all carriers available
    const expressCost = parseFloat((SHIPPING_RATES.EXPRESS.cost * stateMultiplier).toFixed(2))

    availableOptions.push(
      {
        method: 'Standard Shipping',
        cost: parseFloat(finalCost.toFixed(2)),
        estimatedDays: SHIPPING_RATES.FLAT_RATE.estimatedDays,
      },
      {
        method: 'Express Shipping',
        // Make express free if it exceeds the subtotal
        cost: expressCost > subtotal ? 0 : expressCost,
        estimatedDays: SHIPPING_RATES.EXPRESS.estimatedDays,
      }
    )
  }

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
 * 1. Check free shipping threshold first
 * 2. Call real carrier API for accurate rates
 * 3. Return multiple shipping options (standard, expedited, express)
 * 4. Fall back to estimate-based rates if API fails (never block checkout)
 *
 * Follows error handling pattern from lib/tax-calculator.ts
 */
export async function calculateShipping(
  input: ShippingCalculationInput
): Promise<ShippingCalculationResult> {
  const { items, shippingAddress, subtotal } = input

  // Get configurable free shipping threshold from database
  const freeShippingThreshold = await getFreeShippingThreshold()

  // Free shipping for orders over threshold (check first to avoid API call)
  if (subtotal >= freeShippingThreshold) {
    return {
      shippingCost: 0,
      shippingMethod: 'Free Shipping',
      estimatedDelivery: SHIPPING_RATES.FLAT_RATE.estimatedDays,
    }
  }

  // For international shipping, fall back to estimate rates for now
  // TODO: Add international shipping API support
  if (shippingAddress.country !== 'US') {
    return calculateEstimateRates(input, freeShippingThreshold, false)
  }

  try {
    // Calculate parcel dimensions from items
    const parcel = calculateParcelDimensions(items)

    // Build shipping API request
    const shipmentRequest: ShipmentRequest = {
      fromAddress: DEFAULT_ORIGIN_ADDRESS,
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
          return calculateEstimateRates(input, freeShippingThreshold, true)
        }
      }

      // Sort rates by cost (cheapest first)
      const sortedRates = [...filteredRates].sort((a, b) => a.rate - b.rate)

      // Map API rates to our format
      const availableOptions = sortedRates.map((rate) => ({
        method: `${rate.carrier} ${rate.service}`,
        cost: rate.rate,
        estimatedDays: rate.deliveryDays
          ? `${rate.deliveryDays} business days`
          : '3-5 business days',
        estimatedDeliveryDate: rate.deliveryDate || undefined,
      }))

      // Use cheapest rate as default
      const cheapestRate = sortedRates[0]

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
      return calculateEstimateRates(input, freeShippingThreshold, true)
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

    // Return estimate rates rather than failing checkout
    return calculateEstimateRates(input, freeShippingThreshold, true)
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
  // Get configurable free shipping threshold from database
  const freeShippingThreshold = await getFreeShippingThreshold()

  // Quick estimate without detailed item info
  if (params.subtotal >= freeShippingThreshold) {
    return 0
  }

  if (params.country && params.country !== 'US') {
    return SHIPPING_RATES.INTERNATIONAL.cost
  }

  const stateMultiplier =
    SHIPPING_RATES.STATE_MULTIPLIERS[params.state.toUpperCase()] || 1.0

  return parseFloat((SHIPPING_RATES.FLAT_RATE.cost * stateMultiplier).toFixed(2))
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
