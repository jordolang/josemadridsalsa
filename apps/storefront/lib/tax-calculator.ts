/**
 * Tax Calculator - Stripe Tax integration
 * José Madrid Salsa E-commerce Platform
 */

import { getStripe } from './stripe'
import { prisma } from './prisma'

export interface TaxCalculationInput {
  /** Order line items */
  lineItems: Array<{
    amount: number // Amount in cents
    reference: string // Product ID or SKU
    taxCode?: string // Stripe Tax Code (txcd_99999999 = general tangible goods)
  }>
  /** Shipping address for tax calculation */
  shippingAddress: {
    line1: string
    line2?: string
    city: string
    state: string
    postalCode: string
    country: string // Default: 'US'
  }
  /** Customer email (optional, for tax exemption lookups) */
  customerEmail?: string
}

export interface TaxCalculationResult {
  /** Total tax amount in cents */
  taxAmount: number
  /** Total tax amount in dollars */
  taxAmountDecimal: number
  /** Tax rate as a percentage (e.g., 8.5 for 8.5%) */
  taxRate: number
  /** Breakdown by jurisdiction (state, county, city) */
  taxBreakdown: Array<{
    jurisdiction: string
    rate: number
    amount: number
  }>
  /** Whether customer is tax exempt */
  taxExempt: boolean
}

/**
 * Check if a customer is tax exempt based on their wholesale account.
 *
 * Tax exemptions apply to:
 * - Wholesale accounts with approved status and a valid resale number.
 * - Non-profit organizations with valid tax-exempt status.
 *
 * @param {string} [customerEmail] - The customer's email address to look up.
 * @returns {Promise<boolean>} True if the customer is tax exempt, false otherwise.
 */
async function checkTaxExemption(customerEmail?: string): Promise<boolean> {
  if (!customerEmail) {
    return false
  }
  
  try {
    // Look up customer by email
    const user = await prisma.user.findUnique({
      where: { email: customerEmail },
      include: {
        wholesaleAccount: true,
      },
    })
    
    // Check if user has an approved wholesale account with resale number
    if (
      user?.wholesaleAccount &&
      user.wholesaleAccount.status === 'APPROVED' &&
      user.wholesaleAccount.resaleNumber
    ) {
      return true
    }
    
    return false
  } catch (error) {
    console.error('[Tax Calculator] Error checking tax exemption:', error)
    // In case of error, default to not exempt
    return false
  }
}

/**
 * Calculate tax for an order using the Stripe Tax API.
 *
 * Stripe Tax automatically determines applicable rates based on location,
 * handles product taxability rules, and applies the correct jurisdiction
 * rates (state, county, city), keeping up with law changes automatically.
 *
 * Throws if Stripe Tax returns an error, rather than silently reporting $0.
 * A silent zero is indistinguishable from a legitimately untaxed order, so
 * swallowing the failure here could ship untaxed orders indefinitely with
 * nothing surfacing it. Callers decide how to handle the failure (the checkout
 * routes alert operators; the frontend estimate helper degrades to 0 on its own).
 *
 * @param {TaxCalculationInput} input - Line items, shipping address, and optional customer email.
 * @returns {Promise<TaxCalculationResult>} Tax amount, effective rate, per-jurisdiction breakdown, and exemption flag.
 * @throws Propagates any error from the Stripe Tax API.
 */
export async function calculateTax(
  input: TaxCalculationInput
): Promise<TaxCalculationResult> {
  try {
    // Check for tax exemption first
    const taxExempt = await checkTaxExemption(input.customerEmail)
    
    if (taxExempt) {
      // Return zero tax for exempt customers
      return {
        taxAmount: 0,
        taxAmountDecimal: 0,
        taxRate: 0,
        taxBreakdown: [],
        taxExempt: true,
      }
    }
    
    const stripe = getStripe()

    // Create a tax calculation using Stripe Tax API
    const calculation = await stripe.tax.calculations.create({
      currency: 'usd',
      line_items: input.lineItems.map((item) => ({
        amount: item.amount,
        reference: item.reference,
        // Use general tangible goods tax code if not specified
        // For food products, you might want to use a specific code
        // See: https://stripe.com/docs/tax/tax-codes
        tax_code: item.taxCode || 'txcd_99999999', // General tangible goods
      })),
      customer_details: {
        address: {
          line1: input.shippingAddress.line1,
          line2: input.shippingAddress.line2,
          city: input.shippingAddress.city,
          state: input.shippingAddress.state,
          postal_code: input.shippingAddress.postalCode,
          country: input.shippingAddress.country,
        },
        address_source: 'shipping',
      },
      shipping_cost: {
        amount: 0, // Set to actual shipping cost if charging for shipping
      },
      expand: ['line_items.data.tax_breakdown'],
    })

    // Extract tax amount (in cents)
    const taxAmount = calculation.tax_amount_exclusive || 0

    // Calculate effective tax rate
    const subtotal = input.lineItems.reduce((sum, item) => sum + item.amount, 0)
    const taxRate = subtotal > 0 ? (taxAmount / subtotal) * 100 : 0

    // Extract tax breakdown by jurisdiction
    const taxBreakdown: Array<{
      jurisdiction: string
      rate: number
      amount: number
    }> = []

    if (calculation.tax_breakdown) {
      for (const breakdown of calculation.tax_breakdown) {
        const breakdownData = breakdown as any // Stripe Tax types may not be fully up-to-date
        taxBreakdown.push({
          jurisdiction: breakdownData.jurisdiction?.display_name || 'Unknown',
          rate: breakdownData.tax_rate_details?.percentage_decimal
            ? parseFloat(breakdownData.tax_rate_details.percentage_decimal)
            : 0,
          amount: breakdownData.tax_amount || 0,
        })
      }
    }

    return {
      taxAmount,
      taxAmountDecimal: taxAmount / 100,
      taxRate: parseFloat(taxRate.toFixed(2)),
      taxBreakdown,
      taxExempt: false,
    }
  } catch (error) {
    console.error('[Tax Calculator] Error calculating tax:', error)
    if (error instanceof Error) {
      console.error('[Tax Calculator] Error details:', error.message)
    }

    // Propagate rather than returning a silent $0. A zero result here would be
    // indistinguishable from a legitimately untaxed order, letting a misconfigured
    // Stripe Tax key ship untaxed orders with nothing surfacing it. Each caller
    // decides how to handle the failure.
    throw error
  }
}

/**
 * Get a simplified tax estimate for frontend preview.
 *
 * Use this for real-time tax updates as the user types their address.
 * Internally calls {@link calculateTax} with a placeholder street address;
 * tax is computed from city/state/postalCode only.
 *
 * @param params - Estimation parameters.
 * @param {number} params.subtotal - Order subtotal in dollars.
 * @param {string} params.city - City name.
 * @param {string} params.state - Two-letter US state code.
 * @param {string} params.postalCode - ZIP code.
 * @returns {Promise<number>} Estimated tax amount in dollars (0 on error).
 */
export async function getTaxEstimate(params: {
  subtotal: number // Subtotal in dollars
  city: string
  state: string
  postalCode: string
}): Promise<number> {
  try {
    const result = await calculateTax({
      lineItems: [
        {
          amount: Math.round(params.subtotal * 100), // Convert to cents
          reference: 'order-estimate',
          taxCode: 'txcd_99999999',
        },
      ],
      shippingAddress: {
        line1: '123 Main St', // Placeholder - tax is based on city/state/zip
        city: params.city,
        state: params.state,
        postalCode: params.postalCode,
        country: 'US',
      },
    })

    return result.taxAmountDecimal
  } catch (error) {
    console.error('[Tax Calculator] Error getting tax estimate:', error)
    return 0
  }
}

/**
 * Validate that the Stripe Tax integration is properly configured.
 *
 * Performs a test calculation against a known US address. Call during
 * app startup or health-check to surface misconfiguration early.
 *
 * @returns {Promise<{ configured: boolean; error?: string }>} Configuration status and optional error message.
 */
export async function validateTaxConfiguration(): Promise<{
  configured: boolean
  error?: string
}> {
  try {
    // Try a test calculation with a known address
    const result = await calculateTax({
      lineItems: [
        {
          amount: 1000, // $10.00
          reference: 'test',
          taxCode: 'txcd_99999999',
        },
      ],
      shippingAddress: {
        line1: '123 Main St',
        city: 'San Francisco',
        state: 'CA',
        postalCode: '94111',
        country: 'US',
      },
    })

    // If we got a result (even 0 tax), configuration is valid
    return { configured: true }
  } catch (error) {
    const errorMessage =
      error instanceof Error
        ? error.message
        : 'Unknown error validating tax configuration'

    console.error('[Tax Calculator] Configuration validation failed:', errorMessage)

    return {
      configured: false,
      error: errorMessage,
    }
  }
}
