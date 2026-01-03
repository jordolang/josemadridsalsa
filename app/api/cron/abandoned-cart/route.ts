import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { sendAbandonedCartEmail } from '@/lib/email/automation'

// Cron secret for Vercel Cron Jobs
// Set CRON_SECRET in your environment variables
const CRON_SECRET = process.env.CRON_SECRET

export async function GET(request: NextRequest) {
  try {
    // Verify cron secret for security
    const authHeader = request.headers.get('authorization')
    if (CRON_SECRET && authHeader !== `Bearer ${CRON_SECRET}`) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    // Find abandoned carts that:
    // 1. Haven't been recovered
    // 2. Are older than 1 hour
    // 3. Haven't had an email sent yet
    const oneHourAgo = new Date(Date.now() - 60 * 60 * 1000)

    const abandonedCarts = await prisma.abandonedCart.findMany({
      where: {
        recoveredAt: null,
        emailSent: false,
        createdAt: {
          lte: oneHourAgo,
        },
      },
      include: {
        user: {
          select: {
            email: true,
            name: true,
          },
        },
      },
      take: 50, // Process max 50 carts per run to avoid timeouts
    })

    const results = {
      processed: 0,
      sent: 0,
      failed: 0,
      errors: [] as string[],
    }

    for (const cart of abandonedCarts) {
      results.processed++

      try {
        // Get email and name
        const email = cart.user?.email || cart.guestEmail
        const name = cart.user?.name || null

        if (!email) {
          results.failed++
          results.errors.push(`Cart ${cart.id}: No email available`)
          continue
        }

        // Parse cart data
        const cartData = cart.cartData as {
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

        // Skip if cart is empty
        if (!cartData.items || cartData.items.length === 0) {
          results.failed++
          results.errors.push(`Cart ${cart.id}: Empty cart`)
          continue
        }

        // Send abandoned cart email
        const result = await sendAbandonedCartEmail({
          email,
          name,
          cartItems: cartData.items,
          totalPrice: cartData.totalPrice,
          recoveryToken: cart.recoveryToken,
        })

        if (result.success) {
          // Mark email as sent
          await prisma.abandonedCart.update({
            where: { id: cart.id },
            data: {
              emailSent: true,
              emailSentAt: new Date(),
            },
          })
          results.sent++
        } else {
          results.failed++
          results.errors.push(`Cart ${cart.id}: Email failed`)
        }
      } catch (error) {
        results.failed++
        results.errors.push(`Cart ${cart.id}: ${error instanceof Error ? error.message : 'Unknown error'}`)
        console.error(`Failed to process abandoned cart ${cart.id}:`, error)
      }
    }

    return NextResponse.json({
      success: true,
      ...results,
      timestamp: new Date().toISOString(),
    })
  } catch (error) {
    console.error('Abandoned cart cron job error:', error)
    return NextResponse.json(
      {
        success: false,
        error: error instanceof Error ? error.message : 'Unknown error',
      },
      { status: 500 }
    )
  }
}
