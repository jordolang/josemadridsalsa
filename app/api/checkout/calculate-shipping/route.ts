import { NextResponse } from 'next/server'
import { z } from 'zod'
import { calculateShipping } from '@/lib/shipping-calculator'
import prisma from '@/lib/prisma'

/**
 * Shipping Calculation API - Real-time shipping estimates for checkout
 * José Madrid Salsa E-commerce Platform
 */

/**
 * In-memory cache for shipping rate calculations.
 * Avoids redundant carrier API + DB calls for same address/cart combos
 * during a single checkout session (user typing, switching tabs, etc.).
 */
type ShippingCacheEntry = {
  data: Record<string, unknown>
  timestamp: number
}

const SHIPPING_CACHE_TTL_MS = 5 * 60 * 1000 // 5 minutes
const SHIPPING_CACHE_MAX_ENTRIES = 100
const shippingCache = new Map<string, ShippingCacheEntry>()

function getShippingCacheKey(
  items: Array<{ productId: string; quantity: number }>,
  address: { city: string; state: string; postalCode: string }
): string {
  const itemsKey = items
    .map((i) => `${i.productId}:${i.quantity}`)
    .sort()
    .join(',')
  return `${itemsKey}|${address.city}|${address.state}|${address.postalCode}`
}

function pruneShippingCache(): void {
  if (shippingCache.size <= SHIPPING_CACHE_MAX_ENTRIES) return
  const now = Date.now()
  for (const [key, entry] of shippingCache) {
    if (now - entry.timestamp > SHIPPING_CACHE_TTL_MS) {
      shippingCache.delete(key)
    }
  }
  // If still over limit, remove oldest entries
  if (shippingCache.size > SHIPPING_CACHE_MAX_ENTRIES) {
    const entries = [...shippingCache.entries()].sort(
      (a, b) => a[1].timestamp - b[1].timestamp
    )
    const toRemove = entries.slice(0, entries.length - SHIPPING_CACHE_MAX_ENTRIES)
    for (const [key] of toRemove) {
      shippingCache.delete(key)
    }
  }
}

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

    // Check cache for identical address/cart combo
    const cacheKey = getShippingCacheKey(items, shippingAddress)
    const cached = shippingCache.get(cacheKey)
    if (cached && Date.now() - cached.timestamp < SHIPPING_CACHE_TTL_MS) {
      return NextResponse.json(cached.data)
    }

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
    const itemsWithWeights = items.map((item) => {
      const product = productMap.get(item.productId)
      if (!product) {
        // Log missing product but don't block checkout
        console.warn(
          `[Shipping Calculation API] Product ${item.productId} not found, using defaults`
        )
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

    const responseData = {
      success: true,
      shippingCost: shippingResult.shippingCost,
      shippingMethod: shippingResult.shippingMethod,
      estimatedDelivery: shippingResult.estimatedDelivery,
      availableOptions: shippingResult.availableOptions || [],
      subtotal,
      fallback: shippingResult.fallback || false,
    }

    // Cache the result for identical future requests
    shippingCache.set(cacheKey, { data: responseData, timestamp: Date.now() })
    pruneShippingCache()

    return NextResponse.json(responseData)
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

    // Return a fallback response instead of 500 error
    return NextResponse.json(
      {
        success: false,
        error: 'Unable to calculate exact shipping cost',
        message: errorMessage,
        // Return estimate rates as fallback
        shippingCost: 6.99, // Standard flat rate
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
        fallback: true, // Flag to indicate this is a fallback response
      },
      { status: 200 } // Return 200 instead of 500 to not block checkout
    )
  }
}
