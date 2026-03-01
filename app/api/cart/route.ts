import { NextRequest, NextResponse } from 'next/server'
import { z } from 'zod'
import prisma from '@/lib/prisma'
import { getCurrentUser } from '@/lib/rbac'
import { logAuditWithRequest } from '@/lib/audit'

const AddToCartSchema = z.object({
  productId: z.string().cuid(),
  quantity: z.number().int().positive(),
})

export async function GET(request: NextRequest) {
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

export async function POST(request: NextRequest) {
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
    const parsed = AddToCartSchema.safeParse(json)

    if (!parsed.success) {
      return NextResponse.json(
        { error: 'Invalid request payload', details: parsed.error.flatten() },
        { status: 400 }
      )
    }

    const { productId, quantity } = parsed.data

    // Check if product exists
    const product = await prisma.product.findUnique({
      where: { id: productId },
    })

    if (!product) {
      return NextResponse.json(
        { error: 'Product not found' },
        { status: 404 }
      )
    }

    // Check inventory
    if (product.inventory < quantity) {
      return NextResponse.json(
        {
          error: `Insufficient inventory for ${product.name}. Available: ${product.inventory}`,
        },
        { status: 400 }
      )
    }

    // Check if cart item already exists
    const existingCartItem = await prisma.cartItem.findFirst({
      where: {
        userId: user.id,
        productId: productId,
      },
    })

    let cartItem
    if (existingCartItem) {
      // Update quantity
      cartItem = await prisma.cartItem.update({
        where: { id: existingCartItem.id },
        data: {
          quantity: existingCartItem.quantity + quantity,
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
          productId: productId,
          quantity: quantity,
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
        action: 'create',
        entityType: 'CartItem',
        entityId: cartItem.id,
        changes: {
          productId,
          quantity,
          productName: product.name,
        },
      },
      request
    )

    return NextResponse.json({
      success: true,
      cartItem: {
        id: cartItem.id,
        productId: cartItem.productId,
        quantity: cartItem.quantity,
        product: {
          id: product.id,
          name: product.name,
          price: product.price,
          featuredImage: product.featuredImage,
        },
      },
    })
  } catch (error) {
    console.error('[Cart API] Error adding to cart:', error)
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    )
  }
}
