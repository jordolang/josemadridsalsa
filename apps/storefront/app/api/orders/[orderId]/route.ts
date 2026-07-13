import { NextRequest, NextResponse } from 'next/server'
import prisma from '@/lib/prisma'
import { getCurrentUser } from '@/lib/rbac'

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'

interface RouteParams {
  params: Promise<{
    orderId: string
  }>
}

// GET endpoint to retrieve order details by ID
export async function GET(
  request: NextRequest,
  { params }: RouteParams
) {
  try {
    // Require authentication
    const user = await getCurrentUser()

    if (!user) {
      return NextResponse.json(
        { error: 'Authentication required' },
        { status: 401 }
      )
    }

    // Extract orderId from route params
    const { orderId } = await params

    if (!orderId) {
      return NextResponse.json(
        { error: 'Order ID is required' },
        { status: 400 }
      )
    }

    // Fetch order with items
    const order = await prisma.order.findUnique({
      where: { id: orderId },
      include: {
        items: {
          include: {
            product: true,
          },
        },
        user: {
          select: {
            id: true,
            email: true,
            name: true,
          },
        },
      },
    })

    if (!order) {
      return NextResponse.json(
        { error: 'Order not found' },
        { status: 404 }
      )
    }

    // Verify order belongs to authenticated user (or user is admin/developer)
    if (order.userId !== user.id && user.role !== 'ADMIN' && user.role !== 'DEVELOPER') {
      return NextResponse.json(
        { error: 'Access denied' },
        { status: 403 }
      )
    }

    // Convert Decimal prices to numbers and format response
    const parsedOrder = {
      id: order.id,
      orderNumber: order.orderNumber,
      status: order.status,
      paymentStatus: order.paymentStatus,
      subtotal: parseFloat(String(order.subtotal)),
      shippingCost: parseFloat(String(order.shippingCost)),
      tax: parseFloat(String(order.tax)),
      discountAmount: parseFloat(String(order.discountAmount)),
      total: parseFloat(String(order.total)),
      shippingMethod: order.shippingMethod,
      trackingNumber: order.trackingNumber,
      customerNotes: order.customerNotes,
      stripePaymentId: order.stripePaymentId,
      createdAt: order.createdAt,
      updatedAt: order.updatedAt,
      user: order.user,
      items: order.items.map((item) => ({
        id: item.id,
        productId: item.productId,
        productName: item.productName,
        productSku: item.productSku,
        productImage: item.productImage,
        quantity: item.quantity,
        unitPrice: parseFloat(String(item.unitPrice)),
        totalPrice: parseFloat(String(item.totalPrice)),
        product: item.product
          ? {
              id: item.product.id,
              name: item.product.name,
              slug: item.product.slug,
              featuredImage: item.product.featuredImage,
              heatLevel: item.product.heatLevel,
            }
          : null,
      })),
    }

    return NextResponse.json(parsedOrder)
  } catch (error) {
    console.error('[Orders API] Error fetching order:', error)
    return NextResponse.json(
      { error: 'Failed to fetch order' },
      { status: 500 }
    )
  }
}
