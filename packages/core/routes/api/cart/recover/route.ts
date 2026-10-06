import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { RECOVERY_LINK_TTL_MS } from '@/lib/checkout/abandoned-cart'

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

    // Check if cart is too old. The same window is what the final recovery email counts down
    // to, so both read it from one constant.
    const expiresBefore = new Date(Date.now() - RECOVERY_LINK_TTL_MS)
    if (abandonedCart.createdAt < expiresBefore) {
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

    // Create response with cart data
    const response = NextResponse.json({
      success: true,
      cart: cartData,
    })

    // Store abandonedCartId in cookie for checkout attribution
    // Cookie expires in 30 days (same as cart expiration)
    response.cookies.set('abandonedCartId', abandonedCart.id, {
      httpOnly: true,
      secure: process.env.NODE_ENV === 'production',
      sameSite: 'lax',
      maxAge: 30 * 24 * 60 * 60, // 30 days in seconds
      path: '/',
    })

    return response
  } catch (error) {
    console.error('Cart recovery error:', error)
    return NextResponse.json(
      { error: 'Unable to recover cart' },
      { status: 500 }
    )
  }
}
