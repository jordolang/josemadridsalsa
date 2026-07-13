import { NextRequest, NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import { prisma as db } from '@/lib/prisma'
import { logAuditWithRequest } from '@/lib/audit'
import { rateLimit } from '@/lib/rateLimit'
import { UpdateCartItemSchema } from '@/lib/validations/cart'

/**
 * PUT /api/cart/:id
 *
 * Updates a cart item quantity with ownership check and inventory validation.
 * Follows canonical pattern: rate limiting, ownership verification, inventory check.
 */
export async function PUT(
  request: NextRequest,
  context: { params: Promise<{ id: string }> }
) {
  // Rate limiting
  const ip =
    request.headers.get('x-forwarded-for')?.split(',')[0]?.trim() ?? 'unknown'
  const rl = rateLimit(`cart-update:${ip}`, 10, 60_000)
  if (!rl.allowed) {
    return NextResponse.json(
      { success: false, error: 'Too many requests' },
      {
        status: 429,
        headers: { 'Retry-After': String(Math.ceil(rl.retryAfterMs / 1000)) },
      },
    )
  }

  // Authentication check
  const session = await getServerSession(authOptions)
  if (!session?.user?.id) {
    return NextResponse.json(
      { success: false, error: 'Unauthorized - authentication required' },
      { status: 401 },
    )
  }

  const userId = session.user.id

  // Validate request payload
  const parsed = UpdateCartItemSchema.safeParse(
    await request.json().catch(() => ({})),
  )
  if (!parsed.success) {
    return NextResponse.json(
      { success: false, error: 'Invalid request' },
      { status: 422 },
    )
  }

  const { quantity } = parsed.data
  // Await params per Next.js 15 pattern
  const { id: cartItemId } = await context.params

  try {
    // Find cart item with product details
    const cartItem = await db.cartItem.findUnique({
    where: { id: cartItemId },
    include: {
      product: true,
    },
  })

  if (!cartItem) {
    return NextResponse.json(
      { success: false, error: 'Cart item not found' },
      { status: 404 },
    )
  }

  // Ownership check
  if (cartItem.userId !== userId) {
    return NextResponse.json(
      { success: false, error: "Cannot update another user's cart" },
      { status: 403 },
    )
  }

  // Inventory validation
  if (cartItem.product.inventory < quantity) {
    return NextResponse.json(
      {
        success: false,
        error: `Insufficient inventory for ${cartItem.product.name}. Available: ${cartItem.product.inventory}`,
      },
      { status: 422 },
    )
  }

  // Update cart item
  const updatedCartItem = await db.cartItem.update({
    where: { id: cartItemId },
    data: { quantity },
    include: {
      product: true,
    },
  })

  // Log audit event
  await logAuditWithRequest(
    {
      userId,
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
    request,
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

/**
 * DELETE /api/cart/:id
 *
 * Removes a cart item with ownership verification.
 * Follows canonical pattern: rate limiting, ownership check, audit logging.
 */
export async function DELETE(
  request: NextRequest,
  context: { params: Promise<{ id: string }> }
) {
  // Rate limiting
  const ip =
    request.headers.get('x-forwarded-for')?.split(',')[0]?.trim() ?? 'unknown'
  const rl = rateLimit(`cart-delete:${ip}`, 10, 60_000)
  if (!rl.allowed) {
    return NextResponse.json(
      { success: false, error: 'Too many requests' },
      {
        status: 429,
        headers: { 'Retry-After': String(Math.ceil(rl.retryAfterMs / 1000)) },
      },
    )
  }

  // Authentication check
  const session = await getServerSession(authOptions)
  if (!session?.user?.id) {
    return NextResponse.json(
      { success: false, error: 'Unauthorized - authentication required' },
      { status: 401 },
    )
  }

  const userId = session.user.id

  // Await params per Next.js 15 pattern
  const { id: cartItemId } = await context.params

  try {
    // Find cart item with product details
    const cartItem = await db.cartItem.findUnique({
    where: { id: cartItemId },
    include: {
      product: true,
    },
  })

  if (!cartItem) {
    return NextResponse.json(
      { success: false, error: 'Cart item not found' },
      { status: 404 },
    )
  }

  // Ownership check
  if (cartItem.userId !== userId) {
    return NextResponse.json(
      { success: false, error: "Cannot delete another user's cart item" },
      { status: 403 },
    )
  }

  // Delete cart item
  await db.cartItem.delete({
    where: { id: cartItemId },
  })

  // Log audit event
  await logAuditWithRequest(
    {
      userId,
      action: 'delete',
      entityType: 'CartItem',
      entityId: cartItem.id,
      changes: {
        productId: cartItem.productId,
        productName: cartItem.product.name,
        quantity: cartItem.quantity,
      },
    },
    request,
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
