import { NextRequest, NextResponse } from 'next/server'
import { z } from 'zod'
import prisma from '@/lib/prisma'
import { getCurrentUser } from '@/lib/rbac'
import { logAuditWithRequest } from '@/lib/audit'

const UpdateCartItemSchema = z.object({
  quantity: z.number().int().positive(),
})

export async function PUT(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
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
    const parsed = UpdateCartItemSchema.safeParse(json)

    if (!parsed.success) {
      return NextResponse.json(
        { error: 'Invalid request payload', details: parsed.error.flatten() },
        { status: 400 }
      )
    }

    const { quantity } = parsed.data
    const cartItemId = params.id

    // Find the cart item and verify it belongs to the user
    const cartItem = await prisma.cartItem.findUnique({
      where: { id: cartItemId },
      include: {
        product: true,
      },
    })

    if (!cartItem) {
      return NextResponse.json(
        { error: 'Cart item not found' },
        { status: 404 }
      )
    }

    // Verify the cart item belongs to the authenticated user
    if (cartItem.userId !== user.id) {
      return NextResponse.json(
        { error: 'Forbidden - cannot update another user\'s cart' },
        { status: 403 }
      )
    }

    // Check inventory
    if (cartItem.product.inventory < quantity) {
      return NextResponse.json(
        {
          error: `Insufficient inventory for ${cartItem.product.name}. Available: ${cartItem.product.inventory}`,
        },
        { status: 400 }
      )
    }

    // Update the cart item quantity
    const updatedCartItem = await prisma.cartItem.update({
      where: { id: cartItemId },
      data: {
        quantity: quantity,
      },
      include: {
        product: true,
      },
    })

    // Log audit event
    await logAuditWithRequest(
      {
        userId: user.id,
        action: 'update',
        entityType: 'CartItem',
        entityId: updatedCartItem.id,
        changes: {
          quantity: {
            from: cartItem.quantity,
            to: quantity,
          },
          productName: cartItem.product.name,
        },
      },
      request
    )

    return NextResponse.json({
      success: true,
      cartItem: {
        id: updatedCartItem.id,
        productId: updatedCartItem.productId,
        quantity: updatedCartItem.quantity,
        product: {
          id: updatedCartItem.product.id,
          name: updatedCartItem.product.name,
          price: parseFloat(String(updatedCartItem.product.price)),
          featuredImage: updatedCartItem.product.featuredImage,
        },
      },
    })
  } catch (error) {
    console.error('[Cart API] Error updating cart item:', error)
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    )
  }
}

export async function DELETE(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    // Require authentication
    const user = await getCurrentUser()

    if (!user) {
      return NextResponse.json(
        { error: 'Unauthorized - authentication required' },
        { status: 401 }
      )
    }

    const cartItemId = params.id

    // Find the cart item and verify it belongs to the user
    const cartItem = await prisma.cartItem.findUnique({
      where: { id: cartItemId },
      include: {
        product: true,
      },
    })

    if (!cartItem) {
      return NextResponse.json(
        { error: 'Cart item not found' },
        { status: 404 }
      )
    }

    // Verify the cart item belongs to the authenticated user
    if (cartItem.userId !== user.id) {
      return NextResponse.json(
        { error: 'Forbidden - cannot delete another user\'s cart item' },
        { status: 403 }
      )
    }

    // Delete the cart item
    await prisma.cartItem.delete({
      where: { id: cartItemId },
    })

    // Log audit event
    await logAuditWithRequest(
      {
        userId: user.id,
        action: 'delete',
        entityType: 'CartItem',
        entityId: cartItem.id,
        changes: {
          productId: cartItem.productId,
          productName: cartItem.product.name,
          quantity: cartItem.quantity,
        },
      },
      request
    )

    return NextResponse.json({
      success: true,
      message: 'Cart item removed successfully',
    })
  } catch (error) {
    console.error('[Cart API] Error deleting cart item:', error)
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    )
  }
}
