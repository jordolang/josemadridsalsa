import { NextRequest, NextResponse } from 'next/server'
import prisma from '@/lib/prisma'
import { getCurrentUser } from '@/lib/rbac'
import { logAuditWithRequest } from '@/lib/audit'
import { withRateLimit } from '@/lib/middleware/api-helpers'
import { AddCartItemSchema } from '@/lib/validations/cart'
import { RATE_LIMITS } from '@/lib/rate-limiter'

async function handleGet(request: NextRequest) {
  try {
    // Require authentication
    const user = await getCurrentUser()

    if (!user) {
      return NextResponse.json(
        { error: 'Unauthorized - authentication required' },
        { status: 401 }
      )
    }

    // Fetch all cart items for the user
    const cartItems = await prisma.cartItem.findMany({
      where: {
        userId: user.id,
      },
      include: {
        product: true,
      },
      orderBy: {
        createdAt: 'asc',
      },
    })

    // Format cart items and convert Decimal prices to numbers
    const formattedCartItems = cartItems.map((item) => ({
      id: item.id,
      productId: item.productId,
      quantity: item.quantity,
      product: {
        id: item.product.id,
        name: item.product.name,
        slug: item.product.slug,
        price: parseFloat(String(item.product.price)),
        compareAtPrice: item.product.compareAtPrice
          ? parseFloat(String(item.product.compareAtPrice))
          : undefined,
        featuredImage: item.product.featuredImage,
        heatLevel: item.product.heatLevel,
        inventory: item.product.inventory,
      },
    }))

    // Calculate cart totals
    const subtotal = formattedCartItems.reduce(
      (total, item) => total + item.product.price * item.quantity,
      0
    )

    return NextResponse.json({
      items: formattedCartItems,
      itemCount: formattedCartItems.length,
      totalQuantity: formattedCartItems.reduce(
        (total, item) => total + item.quantity,
        0
      ),
      subtotal: parseFloat(subtotal.toFixed(2)),
    })
  } catch (error) {
    console.error('[Cart API] Error fetching cart:', error)
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    )
  }
}

async function handlePost(request: NextRequest) {
  try {
    // Require authentication
    const user = await getCurrentUser()

    if (!user) {
      return NextResponse.json(
        { error: 'Unauthorized - authentication required' },
        { status: 401 }
      )
    }

    const json = await request.json()
    const parsed = AddCartItemSchema.safeParse(json)

    if (!parsed.success) {
      return NextResponse.json(
        { error: 'Invalid request payload', details: parsed.error.flatten() },
        { status: 400 }
      )
    }

    const { productId, quantity } = parsed.data

    // Look up the product to verify it exists and check inventory
    const product = await prisma.product.findUnique({
      where: { id: productId },
    })

    if (!product) {
      return NextResponse.json(
        { error: 'Product not found' },
        { status: 404 }
      )
    }

    // Check if user already has this product in their cart
    const existingItem = await prisma.cartItem.findFirst({
      where: {
        userId: user.id,
        productId,
      },
    })

    // Validate inventory against accumulated quantity (existing + new)
    const accumulatedQuantity = (existingItem?.quantity ?? 0) + quantity
    if (product.inventory < accumulatedQuantity) {
      return NextResponse.json(
        {
          error: `Insufficient inventory for ${product.name}. Available: ${product.inventory}`,
        },
        { status: 400 }
      )
    }

    let cartItem

    if (existingItem) {
      // Update quantity if item already in cart
      cartItem = await prisma.cartItem.update({
        where: { id: existingItem.id },
        data: {
          quantity: accumulatedQuantity,
        },
        include: {
          product: true,
        },
      })
    } else {
      // Create new cart item
      cartItem = await prisma.cartItem.create({
        data: {
          userId: user.id,
          productId,
          quantity,
        },
        include: {
          product: true,
        },
      })
    }

    // Log audit event
    await logAuditWithRequest(
      {
        userId: user.id,
        action: existingItem ? 'update' : 'create',
        entityType: 'CartItem',
        entityId: cartItem.id,
        changes: {
          productId,
          productName: product.name,
          quantity: cartItem.quantity,
        },
      },
      request
    )

    return NextResponse.json(
      {
        success: true,
        cartItem: {
          id: cartItem.id,
          productId: cartItem.productId,
          quantity: cartItem.quantity,
          product: {
            id: cartItem.product.id,
            name: cartItem.product.name,
            price: parseFloat(String(cartItem.product.price)),
            featuredImage: cartItem.product.featuredImage,
          },
        },
      },
    )
  } catch (error) {
    console.error('[Cart API] Error adding to cart:', error)
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    )
  }
}

export const GET = withRateLimit(handleGet, RATE_LIMITS.API_GENERAL)
export const POST = withRateLimit(handlePost, RATE_LIMITS.API_GENERAL)
