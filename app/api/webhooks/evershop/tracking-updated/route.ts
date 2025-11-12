import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import {
  mapEverShopStatusToPrisma,
  parseWebhookDate,
  verifyEverShopSignature,
} from '@/lib/evershop/webhook';

interface TrackingEvent {
  status: string;
  location?: string;
  timestamp?: string;
  details?: string;
}

interface TrackingPayload {
  orderNumber: string;
  trackingNumber?: string;
  status?: string;
  estimatedDelivery?: string;
  events?: TrackingEvent[];
}

const formatTrackingNote = (event: TrackingEvent | undefined): string | undefined => {
  if (!event) {
    return undefined;
  }

  const eventDate = event.timestamp ? new Date(event.timestamp) : new Date();
  const timestamp = Number.isNaN(eventDate.getTime())
    ? new Date().toISOString()
    : eventDate.toISOString();
  const parts = [
    `Status: ${event.status}`,
    event.location ? `Location: ${event.location}` : null,
    event.details ? `Details: ${event.details}` : null,
  ].filter(Boolean);

  return `[EverShop Tracking ${timestamp}] ${parts.join(' | ')}`;
};

export async function POST(request: NextRequest) {
  try {
    const signature = request.headers.get('x-evershop-signature');
    const rawBody = await request.text();

    if (!verifyEverShopSignature(rawBody, signature)) {
      return NextResponse.json({ error: 'Invalid signature' }, { status: 401 });
    }

    const payload = JSON.parse(rawBody) as TrackingPayload;
    const { orderNumber, trackingNumber, status, estimatedDelivery, events } = payload;

    if (!orderNumber) {
      return NextResponse.json({ error: 'Order number is required' }, { status: 400 });
    }

    const order = await prisma.order.findUnique({
      where: { orderNumber },
    });

    if (!order) {
      return NextResponse.json({ error: 'Order not found' }, { status: 404 });
    }

    const updateData: Record<string, unknown> = {};

    if (trackingNumber) {
      updateData.trackingNumber = trackingNumber;
    }

    const eta = parseWebhookDate(estimatedDelivery);
    if (eta) {
      updateData.estimatedDelivery = eta;
    }

    if (status) {
      const mappedStatus = mapEverShopStatusToPrisma(status);
      updateData.status = mappedStatus;

      if (mappedStatus === 'DELIVERED' && !order.deliveredAt) {
        updateData.deliveredAt = new Date();
      }
    }

    const latestEvent = events?.[0];
    const note = formatTrackingNote(latestEvent);
    if (note) {
      updateData.adminNotes = [order.adminNotes, note].filter(Boolean).join('\n');
    }

    await prisma.order.update({
      where: { orderNumber },
      data: updateData,
    });

    return NextResponse.json({ success: true, message: 'Tracking updated' });
  } catch (error) {
    console.error('Error processing EverShop tracking webhook:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
