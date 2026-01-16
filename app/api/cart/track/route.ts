import { NextRequest, NextResponse } from 'next/server'
import { z } from 'zod'
import { getCurrentUser } from '@/lib/rbac'
import { prisma } from '@/lib/prisma'

const CartItemSchema = z.object({
  id: z.string(),
  name: z.string(),
  slug: z.string(),
  price: z.number(),
  image: z.string(),
  quantity: z.number().int().positive(),
  sku: z.string(),
  heatLevel: z.string(),
  maxQuantity: z.number().int().optional(),
})

const TrackCartSchema = z.object({
  items: z.array(CartItemSchema),
  guestEmail: z.string().email().optional(),
})

export async function POST(request: NextRequest) {
  try {
    // Optional authentication - track user if logged in
    const user = await getCurrentUser()

    const payload = await request.json()
    const parsed = TrackCartSchema.safeParse(payload)

    if (!parsed.success) {
      return NextResponse.json({ error: 'Invalid cart data' }, { status: 400 })
    }

    const { items, guestEmail } = parsed.data

    // Don't track empty carts
    if (items.length === 0) {
      return NextResponse.json({ success: true, message: 'Empty cart, not tracked' })
    }

    // If no user or guest email, silently skip tracking (user hasn't provided email yet)
    if (!user && !guestEmail) {
      return NextResponse.json({ success: true, message: 'Cart not tracked yet, waiting for email' })
    }

    const totalItems = items.reduce((sum, item) => sum + item.quantity, 0)
    const totalPrice = items.reduce((sum, item) => sum + item.price * item.quantity, 0)

    const cartData = {
      items,
      totalItems,
      totalPrice,
    }

    // Check if there's an existing abandoned cart for this user
    const existingCart = await prisma.abandonedCart.findFirst({
      where: user
        ? { userId: user.id, recoveredAt: null }
        : { guestEmail: guestEmail?.toLowerCase(), recoveredAt: null },
      orderBy: { createdAt: 'desc' },
    })

    if (existingCart) {
      // Update existing cart
      await prisma.abandonedCart.update({
        where: { id: existingCart.id },
        data: {
          cartData,
          updatedAt: new Date(),
        },
      })
    } else {
      // Create new abandoned cart record
      await prisma.abandonedCart.create({
        data: {
          userId: user?.id,
          guestEmail: guestEmail?.toLowerCase(),
          cartData,
        },
      })
    }

    return NextResponse.json({ success: true })
  } catch (error) {
    console.error('Cart tracking error:', error)
    return NextResponse.json(
      { error: 'Unable to track cart' },
      { status: 500 }
    )
  }
}
