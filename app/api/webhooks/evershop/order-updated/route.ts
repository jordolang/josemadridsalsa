import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import {
  mapEverShopPaymentStatusToPrisma,
  mapEverShopStatusToPrisma,
  verifyEverShopSignature,
} from '@/lib/evershop/webhook';

interface WebhookPayload {
  orderNumber: string;
  status?: string;
  paymentStatus?: string;
  shipmentStatus?: string;
  shipment?: {
    carrier: string;
    trackingNumber: string;
  };
}

/**
 * POST /api/webhooks/evershop/order-updated
 * Handle order status updates from EverShop
 */
export async function POST(request: NextRequest) {
  try {
    const signature = request.headers.get('x-evershop-signature');
    const rawBody = await request.text();
    if (!verifyEverShopSignature(rawBody, signature)) {
      console.error('Invalid webhook signature');
      return NextResponse.json(
        { error: 'Invalid signature' },
        { status: 401 }
      );
    }

    const payload: WebhookPayload = JSON.parse(rawBody);
    const { orderNumber, status, paymentStatus, shipmentStatus, shipment } = payload;

    if (!orderNumber) {
      return NextResponse.json(
        { error: 'Order number is required' },
        { status: 400 }
      );
    }

    // Find the order in Prisma
    const order = await prisma.order.findUnique({
      where: { orderNumber },
    });

    if (!order) {
      console.error(`Order not found: ${orderNumber}`);
      return NextResponse.json(
        { error: 'Order not found' },
        { status: 404 }
      );
    }

    // Update order in Prisma
    const updateData: any = {};

    if (status) {
      updateData.status = mapEverShopStatusToPrisma(status);
    }

    if (paymentStatus !== undefined) {
      updateData.paymentStatus = mapEverShopPaymentStatusToPrisma(paymentStatus);
    }

    if (shipment?.trackingNumber) {
      updateData.trackingNumber = shipment.trackingNumber;
    }

    // Set shipped/delivered timestamps
    if (status === 'shipped' && !order.shippedAt) {
      updateData.shippedAt = new Date();
    }

    if (status === 'delivered' && !order.deliveredAt) {
      updateData.deliveredAt = new Date();
    }

    await prisma.order.update({
      where: { orderNumber },
      data: updateData,
    });

    console.log(`Order ${orderNumber} updated from EverShop webhook:`, updateData);

    // TODO: Send customer notification email if needed
    // if (status === 'shipped') {
    //   await sendShippingNotification(order);
    // }

    return NextResponse.json({
      success: true,
      message: 'Order updated successfully',
    });
  } catch (error) {
    console.error('Error processing EverShop webhook:', error);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}
