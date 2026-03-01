import { NextRequest, NextResponse } from 'next/server'
import { z } from 'zod'
import prisma from '@/lib/prisma'
import { getCurrentUser } from '@/lib/rbac'
import { logAuditWithRequest } from '@/lib/audit'

const AddToCartSchema = z.object({
  productId: z.string().cuid(),
  quantity: z.number().int().positive(),
})

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
