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
    let subtotal = 0
    const itemsWithWeights = items.map((item) => {
      const product = productMap.get(item.productId)
      if (!product) {
        throw new Error(`Product ${item.productId} not found`)
      }

      const price = Number(product.price)
      subtotal += price * item.quantity

      return {
        weight: product.weight ? Number(product.weight) : 1.0, // Default 1 lb
        quantity: item.quantity,
      }
    })

    // Calculate shipping
    const shippingResult = calculateShipping({
      items: itemsWithWeights,
      shippingAddress: {
        state: shippingAddress.state,
        postalCode: shippingAddress.postalCode,
        country: shippingAddress.country,
      },
      subtotal,
    })

    return NextResponse.json({
      success: true,
      ...shippingResult,
      subtotal,
    })
  } catch (error) {
    console.error('[Shipping Calculation API] Error:', error)

    const errorMessage =
      error instanceof Error ? error.message : 'Failed to calculate shipping'

    return NextResponse.json(
      {
        error: 'Unable to calculate shipping',
        message: errorMessage,
      },
      { status: 500 }
    )
  }
}
