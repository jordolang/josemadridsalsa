import { NextResponse } from 'next/server'
import { z } from 'zod'
import { calculateShipping } from '@/lib/shipping-calculator'
import prisma from '@/lib/prisma'

/**
 * Shipping Calculation API - Real-time shipping estimates for checkout
 * José Madrid Salsa E-commerce Platform
 */

const ShippingCalculationSchema = z.object({
  items: z
    .array(
      z.object({
        productId: z.string().cuid(),
        quantity: z.number().int().positive(),
      })
    )
    .min(1, 'Items array cannot be empty'),
  shippingAddress: z.object({
    address1: z.string().min(1, 'Address is required'),
    address2: z.string().optional(),
    city: z.string().min(1, 'City is required'),
    state: z.string().length(2, 'State must be 2 letters (e.g., CA)'),
    postalCode: z.string().min(5, 'ZIP code is required'),
    country: z.string().default('US'),
  }),
})

export async function POST(request: Request) {
  let subtotal = 0

  try {
    const json = await request.json()
    const parsed = ShippingCalculationSchema.safeParse(json)

    if (!parsed.success) {
      return NextResponse.json(
        {
          error: 'Invalid shipping calculation request',
          details: parsed.error.flatten(),
        },
        { status: 400 }
      )
    }

    const { items, shippingAddress } = parsed.data

    // Fetch product details to get weights and prices
    const productIds = items.map((item) => item.productId)
    const products = await prisma.product.findMany({
      where: { id: { in: productIds } },
      select: {
        id: true,
        price: true,
        weight: true,
      },
    })

    const productMap = new Map(products.map((p) => [p.id, p]))

    // Calculate subtotal and prepare items with weights
    const missingProducts: string[] = []
    const itemsWithWeights = items.map((item) => {
      const product = productMap.get(item.productId)
      if (!product) {
        // Log missing product but don't block checkout
        console.warn(
          `[Shipping Calculation API] Product ${item.productId} not found, using defaults`
        )
        missingProducts.push(item.productId)
        // Use default values to allow shipping calculation to continue
        return {
          weight: 1.0, // Default 1 lb
          quantity: item.quantity,
        }
      }

      const price = Number(product.price)
      subtotal += price * item.quantity

      return {
        weight: product.weight ? Number(product.weight) : 1.0, // Default 1 lb
        quantity: item.quantity,
      }
    })

    // Calculate shipping - this function has internal error handling
    // and will fall back to estimate rates if the carrier API fails
    const shippingResult = await calculateShipping({
      items: itemsWithWeights,
      shippingAddress: {
        line1: shippingAddress.address1,
        line2: shippingAddress.address2,
        city: shippingAddress.city,
        state: shippingAddress.state,
        postalCode: shippingAddress.postalCode,
        country: shippingAddress.country,
      },
      subtotal,
    })

    return NextResponse.json({
      success: true,
      shippingCost: shippingResult.shippingCost,
      shippingMethod: shippingResult.shippingMethod,
      estimatedDelivery: shippingResult.estimatedDelivery,
      availableOptions: shippingResult.availableOptions || [],
      subtotal,
      subtotalIncomplete: missingProducts.length > 0,
      missingProducts: missingProducts.length > 0 ? missingProducts : undefined,
      fallback: shippingResult.fallback || false,
    })
  } catch (error) {
    console.error('[Shipping Calculation API] Error:', error)

    if (error instanceof Error) {
      console.error('[Shipping Calculation API] Error details:', error.message)
    }

    // For production: log error but return fallback rates to not block checkout
    // Critical: Shipping calculation failures should never prevent checkout
    console.warn(
      '[Shipping Calculation API] Returning fallback shipping estimate due to error'
    )

    const errorMessage =
      error instanceof Error ? error.message : 'Failed to calculate shipping'

    // Return fallback rates as a successful response so the client can use them.
    // The fallback: true flag signals that these are estimates, not exact rates.
    return NextResponse.json({
      success: true,
      shippingCost: 6.99,
      shippingMethod: 'Standard Shipping (Estimate)',
      estimatedDelivery: '3-5 business days',
      availableOptions: [
        {
          method: 'Standard Shipping (Estimate)',
          cost: 6.99,
          estimatedDays: '3-5 business days',
        },
      ],
      subtotal,
      fallback: true,
    })
  }
}
