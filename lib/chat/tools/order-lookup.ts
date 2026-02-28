import { prisma } from '@/lib/prisma'

export interface OrderLookupParams {
  orderNumber?: string
  email?: string
}

export async function lookupOrder(params: OrderLookupParams) {
  if (!params.orderNumber && !params.email) {
    return {
      error: 'Please provide either an order number or email address',
    }
  }

  const order = await prisma.order.findFirst({
    where: {
      OR: [
        params.orderNumber ? { orderNumber: params.orderNumber } : {},
        params.email ? { 
          OR: [
            { guestEmail: params.email },
            { user: { email: params.email } },
          ],
        } : {},
      ],
    },
    include: {
      items: {
        include: {
          product: true,
        },
      },
      shippingAddress: true,
    },
  })

  if (!order) {
    return {
      found: false,
      message: 'No order found with the provided information',
    }
  }

  return {
    found: true,
    order: {
      orderNumber: order.orderNumber,
      status: order.status,
      total: order.total.toString(),
      createdAt: order.createdAt.toISOString(),
      items: order.items.map((item) => ({
        name: item.productName,
        quantity: item.quantity,
        price: item.unitPrice.toString(),
      })),
      tracking: order.trackingNumber || 'Not available yet',
      estimatedDelivery: order.estimatedDelivery?.toISOString(),
    },
  }
}

export async function getOrderStatus(orderNumber: string) {
  const order = await prisma.order.findUnique({
    where: { orderNumber },
  })

  if (!order) {
    return {
      found: false,
      message: 'Order not found',
    }
  }

  return {
    found: true,
    orderNumber: order.orderNumber,
    status: order.status,
    paymentStatus: order.paymentStatus,
    trackingNumber: order.trackingNumber,
    estimatedDelivery: order.estimatedDelivery,
    shippedAt: order.shippedAt,
    deliveredAt: order.deliveredAt,
  }
}
