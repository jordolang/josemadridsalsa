import { NextRequest, NextResponse } from 'next/server';
import { getEverShopClient } from '@/lib/evershop/client';
import { prisma } from '@/lib/prisma';

/**
 * POST /api/evershop/sync-order
 * Sync a Next.js order to EverShop
 */
export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { orderNumber } = body;

    if (!orderNumber) {
      return NextResponse.json(
        { error: 'Order number is required' },
        { status: 400 }
      );
    }

    // Fetch order from Prisma with all relations
    const order = await prisma.order.findUnique({
      where: { orderNumber },
      include: {
        items: {
          include: {
            product: true,
          },
        },
        shippingAddress: true,
        billingAddress: true,
        user: true,
      },
    });

    if (!order) {
      return NextResponse.json(
        { error: 'Order not found' },
        { status: 404 }
      );
    }

    // Sync to EverShop
    const client = getEverShopClient();
    const result = await client.createOrder(order);

    if (!result.success) {
      console.error('Failed to sync order to EverShop:', result.error);
      return NextResponse.json(
        { error: result.error },
        { status: 500 }
      );
    }

    // Optionally: Store EverShop order ID in adminNotes or a new field
    if (result.order) {
      await prisma.order.update({
        where: { orderNumber },
        data: {
          adminNotes: `EverShop Order ID: ${result.order.orderId}, UUID: ${result.order.uuid}`,
        },
      });
    }

    return NextResponse.json({
      success: true,
      evershopOrder: result.order,
    });
  } catch (error) {
    console.error('Error syncing order to EverShop:', error);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}

/**
 * GET /api/evershop/sync-order?orderNumber=xxx
 * Get EverShop order status
 */
export async function GET(request: NextRequest) {
  try {
    const searchParams = request.nextUrl.searchParams;
    const orderNumber = searchParams.get('orderNumber');

    if (!orderNumber) {
      return NextResponse.json(
        { error: 'Order number is required' },
        { status: 400 }
      );
    }

    const client = getEverShopClient();
    const result = await client.getOrderStatus(orderNumber);

    if (!result.success) {
      return NextResponse.json(
        { error: result.error },
        { status: 404 }
      );
    }

    return NextResponse.json({
      success: true,
      order: result.order,
    });
  } catch (error) {
    console.error('Error fetching EverShop order status:', error);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}
