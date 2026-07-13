import { NextRequest, NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import { prisma as db } from '@/lib/prisma'
import { rateLimit } from '@/lib/rateLimit'
import { logAuditWithRequest } from '@/lib/audit'
import { AddCartItemSchema } from '@/lib/validations/cart'

async function handleGet(request: NextRequest) {
  try {
    // Require authentication
    const session = await getServerSession(authOptions)

    if (!session?.user?.id) {
      return NextResponse.json(
        { error: 'Unauthorized - authentication required' },
        { status: 401 }
      )
    }

    // Fetch all cart items for the user
    const cartItems = await db.cartItem.findMany({
      where: {
        userId: session.user.id,
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

/**
 * POST /api/cart
 *
 * Adds a product to the user's cart. If the product already exists in the cart,
 * the quantity is incremented. Rate limited and requires authentication.
 */
async function handlePost(request: NextRequest) {
  const ip =
    request.headers.get('x-forwarded-for')?.split(',')[0]?.trim() ?? 'unknown'
  const rl = rateLimit(`cart:${ip}`, 10, 60_000)
  if (!rl.allowed) {
    return NextResponse.json(
      { error: 'Too many requests' },
      {
        status: 429,
        headers: { 'Retry-After': String(Math.ceil(rl.retryAfterMs / 1000)) },
      },
    )
  }

  const parsed = AddCartItemSchema.safeParse(await request.json().catch(() => ({})))
  if (!parsed.success) {
    return NextResponse.json(
      { error: 'Invalid request' },
      { status: 422 }
    )
  }

  const session = await getServerSession(authOptions)
  if (!session?.user?.id) {
    return NextResponse.json(
      { error: 'Unauthorized - authentication required' },
      { status: 401 }
    )
  }

  try {

    const { productId, quantity } = parsed.data

    // Look up the product to verify it exists and check inventory
    const product = await db.product.findUnique({
      where: { id: productId },
    })

    if (!product) {
      return NextResponse.json(
        { error: 'Product not found' },
        { status: 404 }
      )
    }

    // Check if user already has this product in their cart
    const existingItem = await db.cartItem.findFirst({
      where: {
        userId: session.user.id,
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
      cartItem = await db.cartItem.update({
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
      cartItem = await db.cartItem.create({
        data: {
          userId: session.user.id,
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
        userId: session.user.id,
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

export const GET = handleGet
export const POST = handlePost
