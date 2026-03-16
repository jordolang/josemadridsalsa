import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { getShopifyClient } from '@/lib/shopify/client'

interface CancelOrderBody {
  reason?: string
}

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ orderNumber: string }> }
) {
  try {
    const { orderNumber } = await params

    if (!orderNumber) {
      return NextResponse.json({ error: 'Order number is required' }, { status: 400 })
    }

    const order = await prisma.order.findUnique({
      where: { orderNumber },
    })

    if (!order) {
      return NextResponse.json({ error: 'Order not found' }, { status: 404 })
    }

    if (!order.shopifyOrderId) {
      return NextResponse.json({ error: 'Order has not been synced to Shopify' }, { status: 409 })
    }

    let reason: string | undefined
    try {
      const body = (await request.json()) as CancelOrderBody
      reason = body.reason
    } catch {
      reason = undefined
    }

    const client = getShopifyClient()
    await client.cancelOrder(order.shopifyOrderId, reason)

    const adminNote = `[Shopify] Order cancelled${reason ? `: ${reason}` : ''}`

    await prisma.order.update({
      where: { orderNumber },
      data: {
        status: 'CANCELLED',
        paymentStatus: order.paymentStatus === 'PAID' ? 'REFUNDED' : order.paymentStatus,
        shopifyFinancialStatus: 'refunded',
        shopifyFulfillmentStatus: 'cancelled',
        adminNotes: [order.adminNotes, adminNote].filter(Boolean).join('\n'),
      },
    })

    return NextResponse.json({ success: true })
  } catch (error) {
    console.error('Error cancelling Shopify order:', error)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}
