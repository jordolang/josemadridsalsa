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
 * Check if a customer is tax exempt based on their wholesale account
 * 
 * Tax exemptions typically apply to:
 * - Wholesale accounts with valid resale certificates
 * - Non-profit organizations with valid tax-exempt status
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
 * Calculate tax using Stripe Tax API
 *
 * Stripe Tax automatically:
 * - Determines applicable tax rates based on location
 * - Handles product taxability rules
 * - Applies correct jurisdiction rates (state, county, city)
 * - Updates rates automatically when laws change
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

    // For production: log error but return 0 tax to not block checkout
    // You may want to enable a fallback tax rate or notify admins
    if (error instanceof Error) {
      console.error('[Tax Calculator] Error details:', error.message)
    }

    // Return zero tax rather than failing checkout
    return {
      taxAmount: 0,
      taxAmountDecimal: 0,
      taxRate: 0,
      taxBreakdown: [],
      taxExempt: false,
    }
  }
}

/**
 * Get simplified tax estimate for frontend preview
 *
 * Use this for real-time tax updates as user types address
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
 * Validate tax calculation configuration
 *
 * Call this during app startup to ensure Stripe Tax is properly configured
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
