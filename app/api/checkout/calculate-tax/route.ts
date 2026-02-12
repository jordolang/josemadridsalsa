import { NextResponse } from 'next/server'
import { z } from 'zod'
import { calculateTax } from '@/lib/tax-calculator'
import { calculateShipping } from '@/lib/shipping-calculator'

/**
 * Tax Calculation API - Real-time tax estimates for checkout
 * José Madrid Salsa E-commerce Platform
 */

const TaxCalculationSchema = z.object({
  items: z
    .array(
      z.object({
        productId: z.string().cuid(),
        quantity: z.number().int().positive(),
        price: z.number().positive(), // Price per unit in dollars
        weight: z.number().positive().optional(), // Weight in pounds (optional)
      })
    )
    .min(1, 'Items array cannot be empty'),
  shippingAddress: z.object({
    address1: z.string().min(1, 'Address is required'),
    address2: z.string().optional(),
    city: z.string().min(1, 'City is required'),
    state: z.string().min(2, 'State is required'),
    postalCode: z.string().min(5, 'ZIP code is required'),
    country: z.string().default('US'),
  }),
})

export async function POST(request: Request) {
  try {
    const json = await request.json()
    const parsed = TaxCalculationSchema.safeParse(json)

    if (!parsed.success) {
      return NextResponse.json(
        {
          error: 'Invalid tax calculation request',
          details: parsed.error.flatten(),
        },
        { status: 400 }
      )
    }

    const { items, shippingAddress } = parsed.data

    // Calculate subtotal and prepare line items for Stripe Tax
    const lineItems = items.map((item) => {
      const unitPriceInCents = Math.round(item.price * 100)
      const lineTotalInCents = unitPriceInCents * item.quantity

      return {
        amount: lineTotalInCents,
        reference: item.productId,
        // Food products may qualify for reduced tax rates in some states
        // You can customize tax codes per product if needed
        taxCode: 'txcd_30011000', // Food & beverage - Packaged food
      }
    })

    // Calculate tax using Stripe Tax API
    const taxResult = await calculateTax({
      lineItems,
      shippingAddress: {
        line1: shippingAddress.address1,
        line2: shippingAddress.address2,
        city: shippingAddress.city,
        state: shippingAddress.state,
        postalCode: shippingAddress.postalCode,
        country: shippingAddress.country,
      },
    })

    // Calculate totals
    const subtotal = items.reduce((sum, item) => sum + item.price * item.quantity, 0)
    
    // Calculate shipping cost using shipping calculator
    const shippingResult = calculateShipping({
      items: items.map((item) => ({
        weight: item.weight ?? 1.0, // Default to 1 lb if weight not provided
        quantity: item.quantity,
      })),
      shippingAddress: {
        state: shippingAddress.state,
        postalCode: shippingAddress.postalCode,
        country: shippingAddress.country,
      },
      subtotal,
    })
    
    const shippingCost = shippingResult.shippingCost
    const total = subtotal + taxResult.taxAmountDecimal + shippingCost

    return NextResponse.json({
      success: true,
      subtotal,
      tax: taxResult.taxAmountDecimal,
      taxRate: taxResult.taxRate,
      taxBreakdown: taxResult.taxBreakdown,
      shippingCost,
      shippingMethod: shippingResult.shippingMethod,
      estimatedDelivery: shippingResult.estimatedDelivery,
      total,
    })
  } catch (error) {
    console.error('[Tax Calculation API] Error:', error)

    // Return error details for debugging
    const errorMessage =
      error instanceof Error ? error.message : 'Failed to calculate tax'

    return NextResponse.json(
      {
        error: 'Unable to calculate tax',
        message: errorMessage,
        // Fallback: return 0 tax so checkout can continue
        subtotal: 0,
        tax: 0,
        taxRate: 0,
        taxBreakdown: [],
        shippingCost: 0,
        total: 0,
      },
      { status: 500 }
    )
  }
}
