import crypto from 'crypto';
import type { OrderStatus, PaymentStatus } from '@prisma/client';

const STATUS_MAP: Record<string, OrderStatus> = {
  pending: 'PENDING',
  confirmed: 'CONFIRMED',
  processing: 'PROCESSING',
  shipped: 'SHIPPED',
  delivered: 'DELIVERED',
  cancelled: 'CANCELLED',
  refunded: 'REFUNDED',
};

const PAYMENT_STATUS_MAP: Record<string, PaymentStatus> = {
  paid: 'PAID',
  failed: 'FAILED',
  refunded: 'REFUNDED',
  partially_refunded: 'PARTIALLY_REFUNDED',
};

export function getEverShopWebhookSecret(): string {
  const secret = process.env.EVERSHOP_WEBHOOK_SECRET;
  if (!secret) {
    throw new Error('EVERSHOP_WEBHOOK_SECRET is not configured');
  }
  return secret;
}

export function verifyEverShopSignature(
  payload: string,
  signature: string | null,
  secret: string = getEverShopWebhookSecret()
): boolean {
  if (!signature) {
    return false;
  }

  const expectedSignature = crypto
    .createHmac('sha256', secret)
    .update(payload)
    .digest('hex');

  const expectedBuffer = Buffer.from(expectedSignature, 'utf8');
  const providedBuffer = Buffer.from(signature, 'utf8');

  if (expectedBuffer.length !== providedBuffer.length) {
    return false;
  }

  return crypto.timingSafeEqual(providedBuffer, expectedBuffer);
}

export function mapEverShopStatusToPrisma(status?: string): OrderStatus {
  if (!status) {
    return 'PENDING';
  }
  return STATUS_MAP[status.toLowerCase()] || 'PENDING';
}

export function mapEverShopPaymentStatusToPrisma(status?: string | null): PaymentStatus {
  if (!status) {
    return 'PENDING';
  }
  return PAYMENT_STATUS_MAP[status.toLowerCase()] || 'PENDING';
}

export function parseWebhookDate(value?: string | null): Date | undefined {
  if (!value) {
    return undefined;
  }

  const parsed = new Date(value);
  return Number.isNaN(parsed.getTime()) ? undefined : parsed;
}
