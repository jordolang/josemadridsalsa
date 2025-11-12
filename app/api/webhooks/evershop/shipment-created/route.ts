import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import {
  mapEverShopStatusToPrisma,
  parseWebhookDate,
  verifyEverShopSignature,
} from '@/lib/evershop/webhook';

interface ShipmentPayload {
  orderNumber: string;
  carrier?: string;
  service?: string;
  trackingNumber?: string;
  shippedAt?: string;
  estimatedDelivery?: string;
  notes?: string;
}

export async function POST(request: NextRequest) {
  try {
    const signature = request.headers.get('x-evershop-signature');
    const rawBody = await request.text();

    if (!verifyEverShopSignature(rawBody, signature)) {
      return NextResponse.json({ error: 'Invalid signature' }, { status: 401 });
    }

    const payload = JSON.parse(rawBody) as ShipmentPayload;
    const { orderNumber, trackingNumber, carrier, service, shippedAt, estimatedDelivery, notes } = payload;

    if (!orderNumber) {
      return NextResponse.json({ error: 'Order number is required' }, { status: 400 });
    }

    const order = await prisma.order.findUnique({
      where: { orderNumber },
    });

    if (!order) {
      return NextResponse.json({ error: 'Order not found' }, { status: 404 });
    }

    const updateData: Record<string, unknown> = {
      status: mapEverShopStatusToPrisma('shipped'),
      shippedAt: parseWebhookDate(shippedAt) ?? new Date(),
    };

    if (trackingNumber) {
      updateData.trackingNumber = trackingNumber;
    }

    const eta = parseWebhookDate(estimatedDelivery);
    if (eta) {
      updateData.estimatedDelivery = eta;
    }

    const shippingDescription = [carrier, service].filter(Boolean).join(' - ');
    if (shippingDescription) {
      updateData.shippingMethod = shippingDescription;
    }

    if (notes) {
      updateData.adminNotes = [order.adminNotes, `[EverShop Shipment] ${notes}`]
        .filter(Boolean)
        .join('\n');
    }

    await prisma.order.update({
      where: { orderNumber },
      data: updateData,
    });

    return NextResponse.json({ success: true, message: 'Shipment recorded' });
  } catch (error) {
    console.error('Error processing EverShop shipment webhook:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
