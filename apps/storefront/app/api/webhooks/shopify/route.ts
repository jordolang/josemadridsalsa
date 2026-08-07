import { NextRequest, NextResponse } from 'next/server'
import type { Prisma } from '@prisma/client'
import { prisma } from '@/lib/prisma'
import { buildFulfillmentUpdate, recordFulfillmentEvent } from '@/lib/orders/fulfillment'
import {
  mapShopifyFinancialStatusToPrisma,
  mapShopifyFulfillmentStatusToPrisma,
  parseShopifyDate,
  verifyShopifySignature,
} from '@/lib/shopify/webhook'

type ShopifyOrderWebhookPayload = {
  id: number
  name: string
  order_number: number
  financial_status?: string | null
  fulfillment_status?: string | null
  cancelled_at?: string | null
  closed_at?: string | null
  updated_at?: string | null
  note_attributes?: { name: string; value: string }[]
  fulfillments?: Array<{
    tracking_number?: string | null
    tracking_numbers?: string[] | null
    tracking_company?: string | null
    status?: string | null
    created_at?: string | null
  }>
}

type ShopifyFulfillmentPayload = {
  id: number
  order_id: number
  status?: string | null
  created_at?: string | null
  tracking_number?: string | null
  tracking_numbers?: string[] | null
  tracking_company?: string | null
}

function extractOrderNumber(payload: { note_attributes?: { name: string; value: string }[] }) {
  return payload.note_attributes?.find((attr) => attr.name === 'orderNumber')?.value
}

async function findOrderByIdentifiers(shopifyOrderId?: string, orderNumber?: string) {
  if (shopifyOrderId) {
    const order = await prisma.order.findFirst({ where: { shopifyOrderId } })
    if (order) {
      return order
    }
  }

  if (orderNumber) {
    return prisma.order.findUnique({ where: { orderNumber } })
  }

  return null
}

async function handleOrderPayload(payload: ShopifyOrderWebhookPayload) {
  const shopifyOrderId = String(payload.id)
  const orderNumber = extractOrderNumber(payload)
  const order = await findOrderByIdentifiers(shopifyOrderId, orderNumber)

  if (!order) {
    console.warn(`[Shopify] Order webhook received for unknown order ${shopifyOrderId}`)
    return
  }

  const updateData: Prisma.OrderUpdateInput = {
    shopifyOrderId,
    shopifyOrderName: payload.name,
    shopifyFinancialStatus: payload.financial_status || undefined,
    shopifyFulfillmentStatus: payload.fulfillment_status || undefined,
    shopifySyncedAt: new Date(),
    shopifySyncError: null,
  }

  if (payload.financial_status !== undefined) {
    updateData.paymentStatus = mapShopifyFinancialStatusToPrisma(payload.financial_status)
  }

  if (payload.fulfillment_status !== undefined) {
    updateData.status = mapShopifyFulfillmentStatusToPrisma(payload.fulfillment_status)
  }

  if (payload.cancelled_at) {
    updateData.status = 'CANCELLED'
    updateData.paymentStatus = payload.financial_status === 'refunded' ? 'REFUNDED' : 'FAILED'
  }

  if (payload.fulfillment_status === 'fulfilled' && !order.shippedAt) {
    updateData.shippedAt = parseShopifyDate(payload.updated_at) ?? new Date()
  }

  if (payload.closed_at && !order.deliveredAt) {
    updateData.deliveredAt = parseShopifyDate(payload.closed_at) ?? undefined
  }

  const fulfillments = payload.fulfillments || []
  const fulfillment = fulfillments[fulfillments.length - 1]
  const trackingNumber = fulfillment?.tracking_number || fulfillment?.tracking_numbers?.[0]
  if (trackingNumber) {
    updateData.trackingNumber = trackingNumber
  }

  await prisma.order.update({ where: { id: order.id }, data: updateData })
}

async function handleFulfillmentPayload(payload: ShopifyFulfillmentPayload) {
  const shopifyOrderId = String(payload.order_id)
  const order = await findOrderByIdentifiers(shopifyOrderId)

  if (!order) {
    console.warn(`[Shopify] Fulfillment webhook for unknown order ${shopifyOrderId}`)
    return
  }

  const updateData: Prisma.OrderUpdateInput = {
    shopifyFulfillmentStatus: payload.status || order.shopifyFulfillmentStatus,
  }

  const trackingNumber = payload.tracking_number || payload.tracking_numbers?.[0]
  if (trackingNumber) {
    updateData.trackingNumber = trackingNumber
  }

  if (payload.status === 'cancelled') {
    updateData.status = 'CANCELLED'
    updateData.fulfillmentStatus = 'UNFULFILLED'
  } else {
    // Shopify reports fulfillment, so translate it through the shared helper rather than
    // setting status on its own and leaving fulfillmentStatus behind. Shopify's own event
    // time is more accurate than "now", so it is passed in as the stamp the helper uses.
    const transition = payload.status === 'delivered' ? 'delivered' : 'shipped'
    Object.assign(
      updateData,
      buildFulfillmentUpdate({
        transition,
        current: order,
        now: parseShopifyDate(payload.created_at) ?? new Date(),
      })
    )
  }

  await prisma.order.update({ where: { id: order.id }, data: updateData })

  if (payload.status !== 'cancelled') {
    await recordFulfillmentEvent({
      orderId: order.id,
      transition: payload.status === 'delivered' ? 'delivered' : 'shipped',
      current: order,
      eventPayload: { orderNumber: order.orderNumber, via: 'webhook:shopify' },
    })
  }
}

export async function POST(request: NextRequest) {
  try {
    const signature = request.headers.get('x-shopify-hmac-sha256')
    const topic = request.headers.get('x-shopify-topic')
    const rawBody = Buffer.from(await request.arrayBuffer())

    if (!verifyShopifySignature(rawBody, signature)) {
      return NextResponse.json({ error: 'Invalid signature' }, { status: 401 })
    }

    if (!topic) {
      return NextResponse.json({ error: 'Missing webhook topic' }, { status: 400 })
    }

    const payload = JSON.parse(rawBody.toString('utf8'))

    switch (topic) {
      case 'orders/create':
      case 'orders/updated':
      case 'orders/paid':
      case 'orders/cancelled':
        await handleOrderPayload(payload as ShopifyOrderWebhookPayload)
        break
      case 'fulfillments/create':
      case 'fulfillments/update':
        await handleFulfillmentPayload(payload as ShopifyFulfillmentPayload)
        break
      default:
        console.log(`[Shopify] Webhook ${topic} received and ignored (not mapped).`)
    }

    return NextResponse.json({ success: true })
  } catch (error) {
    console.error('Error processing Shopify webhook:', error)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}
