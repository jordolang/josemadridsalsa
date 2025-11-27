import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { getShopifyClient } from '@/lib/shopify/client'

export async function POST(request: NextRequest) {
  try {
    const body = await request.json()
    const { orderNumber } = body

    if (!orderNumber) {
      return NextResponse.json({ error: 'Order number is required' }, { status: 400 })
    }

    const order = await prisma.order.findUnique({
      where: { orderNumber },
      include: {
        items: { include: { product: true } },
        shippingAddress: true,
        billingAddress: true,
        user: true,
      },
    })

    if (!order) {
      return NextResponse.json({ error: 'Order not found' }, { status: 404 })
    }

    if (order.shopifyOrderId) {
      return NextResponse.json({
        success: true,
        message: 'Order already synced to Shopify',
        shopifyOrderId: order.shopifyOrderId,
        shopifyOrderName: order.shopifyOrderName,
      })
    }

    const client = getShopifyClient()
    const result = await client.createOrder(order)

    if (!result.success || !result.order) {
      return NextResponse.json(
        { error: result.error || 'Failed to sync order to Shopify' },
        { status: 502 }
      )
    }

    await prisma.order.update({
      where: { id: order.id },
      data: {
        shopifyOrderId: String(result.order.id),
        shopifyOrderName: result.order.name,
        shopifyFinancialStatus: result.order.financial_status || undefined,
        shopifyFulfillmentStatus: result.order.fulfillment_status || undefined,
        shopifySyncedAt: new Date(),
        shopifySyncError: null,
      },
    })

    return NextResponse.json({ success: true, shopifyOrder: result.order })
  } catch (error) {
    console.error('Error syncing order to Shopify:', error)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}

export async function GET(request: NextRequest) {
  try {
    const orderNumber = request.nextUrl.searchParams.get('orderNumber')

    if (!orderNumber) {
      return NextResponse.json({ error: 'Order number is required' }, { status: 400 })
    }

    const order = await prisma.order.findUnique({ where: { orderNumber } })

    if (!order || !order.shopifyOrderId) {
      return NextResponse.json({ error: 'Order not synced with Shopify' }, { status: 404 })
    }

    const client = getShopifyClient()
    const shopifyOrder = await client.getOrder(order.shopifyOrderId)

    return NextResponse.json({ success: true, order: shopifyOrder })
  } catch (error) {
    console.error('Error fetching Shopify order status:', error)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}
