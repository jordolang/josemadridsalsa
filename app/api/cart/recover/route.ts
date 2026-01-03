import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'

export async function GET(request: NextRequest) {
  try {
    const searchParams = request.nextUrl.searchParams
    const token = searchParams.get('token')

    if (!token) {
      return NextResponse.json({ error: 'Recovery token required' }, { status: 400 })
    }

    // Find the abandoned cart by recovery token
    const abandonedCart = await prisma.abandonedCart.findUnique({
      where: { recoveryToken: token },
    })

    if (!abandonedCart) {
      return NextResponse.json({ error: 'Invalid recovery token' }, { status: 404 })
    }

    // Check if cart was already recovered
    if (abandonedCart.recoveredAt) {
      return NextResponse.json(
        { error: 'Cart has already been recovered' },
        { status: 410 }
      )
    }

    // Check if cart is too old (e.g., older than 30 days)
    const thirtyDaysAgo = new Date(Date.now() - 30 * 24 * 60 * 60 * 1000)
    if (abandonedCart.createdAt < thirtyDaysAgo) {
      return NextResponse.json(
        { error: 'Cart recovery link has expired' },
        { status: 410 }
      )
    }

    // Parse and return cart data
    const cartData = abandonedCart.cartData as {
      items: Array<{
        id: string
        name: string
        slug: string
        price: number
        image: string
        quantity: number
        sku: string
        heatLevel: string
      }>
      totalItems: number
      totalPrice: number
    }

    // Mark cart as recovered
    await prisma.abandonedCart.update({
      where: { id: abandonedCart.id },
      data: { recoveredAt: new Date() },
    })

    return NextResponse.json({
      success: true,
      cart: cartData,
    })
  } catch (error) {
    console.error('Cart recovery error:', error)
    return NextResponse.json(
      { error: 'Unable to recover cart' },
      { status: 500 }
    )
  }
}
