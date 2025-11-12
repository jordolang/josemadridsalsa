import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { getEverShopClient } from '@/lib/evershop/client';

interface CancelOrderBody {
  reason?: string;
}

export async function POST(
  request: NextRequest,
  { params }: { params: { orderNumber: string } }
) {
  try {
    const orderNumber = params.orderNumber;

    if (!orderNumber) {
      return NextResponse.json({ error: 'Order number is required' }, { status: 400 });
    }

    const order = await prisma.order.findUnique({
      where: { orderNumber },
    });

    if (!order) {
      return NextResponse.json({ error: 'Order not found' }, { status: 404 });
    }

    let reason: string | undefined;
    try {
      const body = (await request.json()) as CancelOrderBody;
      reason = body.reason;
    } catch {
      reason = undefined;
    }

    const client = getEverShopClient();
    const result = await client.cancelOrder(orderNumber);

    if (!result.success) {
      console.error(`EverShop cancel failed for ${orderNumber}:`, result.error);
      return NextResponse.json(
        { error: result.error || 'Failed to cancel EverShop order' },
        { status: 502 }
      );
    }

    const adminNote = `[EverShop] Order cancelled${reason ? `: ${reason}` : ''}`;

    await prisma.order.update({
      where: { orderNumber },
      data: {
        status: 'CANCELLED',
        paymentStatus: order.paymentStatus === 'PAID' ? 'REFUNDED' : order.paymentStatus,
        adminNotes: [order.adminNotes, adminNote].filter(Boolean).join('\n'),
      },
    });

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error('Error cancelling EverShop order:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
