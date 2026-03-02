/**
 * Shipping Calculator - Calculate shipping costs for orders
 * José Madrid Salsa E-commerce Platform
 */

export interface ShippingCalculationInput {
  /** Items in the order */
  items: Array<{
    weight?: number // Weight in pounds
    quantity: number
  }>
  /** Shipping address */
  shippingAddress: {
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
  }>
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
 * Calculate shipping cost for an order
 *
 * Strategy:
 * 1. Free shipping over threshold
 * 2. International shipping for non-US
 * 3. Flat rate for domestic orders
 * 4. Apply state multipliers for remote locations
 */
export function calculateShipping(
  input: ShippingCalculationInput
): ShippingCalculationResult {
  const { items, shippingAddress, subtotal } = input

  // Free shipping for orders over threshold
  if (subtotal >= SHIPPING_RATES.FREE_SHIPPING_THRESHOLD) {
    return {
      shippingCost: 0,
      shippingMethod: 'Free Shipping',
      estimatedDelivery: SHIPPING_RATES.FLAT_RATE.estimatedDays,
    }
  }

  // International shipping
  if (shippingAddress.country !== 'US') {
    return {
      shippingCost: SHIPPING_RATES.INTERNATIONAL.cost,
      shippingMethod: 'International Shipping',
      estimatedDelivery: SHIPPING_RATES.INTERNATIONAL.estimatedDays,
    }
  }

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

  return {
    shippingCost: parseFloat(finalCost.toFixed(2)),
    shippingMethod: 'Standard Shipping',
    estimatedDelivery: SHIPPING_RATES.FLAT_RATE.estimatedDays,
    availableOptions: [
      {
        method: 'Standard Shipping',
        cost: parseFloat(finalCost.toFixed(2)),
        estimatedDays: SHIPPING_RATES.FLAT_RATE.estimatedDays,
      },
      {
        method: 'Express Shipping',
        cost:
          SHIPPING_RATES.EXPRESS.cost * stateMultiplier > subtotal
            ? 0
            : SHIPPING_RATES.EXPRESS.cost * stateMultiplier,
        estimatedDays: SHIPPING_RATES.EXPRESS.estimatedDays,
      },
    ],
  }
}

/**
 * Get shipping estimate for frontend preview
 */
export function getShippingEstimate(params: {
  subtotal: number
  state: string
  country?: string
}): number {
  // Quick estimate without detailed item info
  if (params.subtotal >= SHIPPING_RATES.FREE_SHIPPING_THRESHOLD) {
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
