import { NextRequest } from 'next/server';
import { requirePermission } from '@/lib/rbac';
import { ok, fail } from '@/lib/api';
import { logAuditWithRequest } from '@/lib/audit';
import prisma from '@/lib/prisma';
import { getStripe } from '@/lib/stripe';

/**
 * POST /api/admin/orders/[id]/refund
 * Process a refund for an order through Stripe
 */
export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    // Verify permissions
    const user = await requirePermission('orders:write');

    const { id } = await params;

    // Parse request body
    const body = await req.json();
    const { amount } = body;

    // Validate amount
    if (amount === undefined || amount === null) {
      return fail('Refund amount is required', 400);
    }

    if (typeof amount !== 'number' || amount <= 0) {
      return fail('Refund amount must be a positive number', 400);
    }

    // Fetch order
    const order = await prisma.order.findUnique({
      where: { id },
      include: {
        items: true,
      },
    });

    if (!order) {
      return fail('Order not found', 404);
    }

    // Check payment status
    if (order.paymentStatus !== 'PAID' && order.paymentStatus !== 'PARTIALLY_REFUNDED') {
      return fail(
        `Cannot refund order with payment status: ${order.paymentStatus}`,
        400
      );
    }

    // Check if order has a Stripe payment ID
    if (!order.stripePaymentId) {
      return fail('Order does not have a Stripe payment ID', 400);
    }

    // Calculate total paid amount
    const totalPaid = Number(order.total);

    // Validate refund amount doesn't exceed total
    if (amount > totalPaid) {
      return fail(
        `Refund amount ($${amount}) cannot exceed order total ($${totalPaid})`,
        400
      );
    }

    // Get Stripe client
    const stripe = getStripe();

    // Retrieve the payment intent to get the charge ID
    const paymentIntent = await stripe.paymentIntents.retrieve(
      order.stripePaymentId,
      { expand: ['charges'] }
    ) as any;

    if (!paymentIntent.charges?.data?.[0]?.id) {
      return fail('No charge found for this payment', 400);
    }

    const chargeId = paymentIntent.charges.data[0].id;

    // Check if there are existing refunds
    const existingRefunds = paymentIntent.charges.data[0].refunds?.data || [];
    const totalRefunded = existingRefunds.reduce(
      (sum: number, refund: any) => sum + refund.amount,
      0
    ) / 100; // Convert from cents to dollars

    // Calculate remaining refundable amount
    const refundableAmount = totalPaid - totalRefunded;

    if (amount > refundableAmount) {
      return fail(
        `Refund amount ($${amount}) exceeds refundable amount ($${refundableAmount.toFixed(2)})`,
        400
      );
    }

    // Create refund in Stripe
    const refund = await stripe.refunds.create({
      charge: chargeId,
      amount: Math.round(amount * 100), // Convert to cents
      metadata: {
        orderId: order.id,
        orderNumber: order.orderNumber,
        refundedBy: user.id,
      },
    });

    // Log audit
    await logAuditWithRequest(
      {
        userId: user.id,
        action: 'orders.refund',
        entityType: 'order',
        entityId: order.id,
        changes: {
          refundAmount: amount,
          refundId: refund.id,
          orderNumber: order.orderNumber,
          totalPaid,
          totalRefunded: totalRefunded + amount,
        },
      },
      req
    );

    return ok({
      success: true,
      refund: {
        id: refund.id,
        amount,
        status: refund.status,
        created: refund.created,
      },
      order: {
        id: order.id,
        orderNumber: order.orderNumber,
        totalRefunded: totalRefunded + amount,
        refundableAmount: refundableAmount - amount,
      },
      message: 'Refund processed successfully. Order status will be updated via webhook.',
    });
  } catch (error: any) {
    console.error('Error processing refund:', error);

    // Handle Stripe-specific errors
    if (error.type === 'StripeInvalidRequestError') {
      return fail(`Stripe error: ${error.message}`, 400);
    }

    return fail(error.message, error.status || 500);
  }
}
