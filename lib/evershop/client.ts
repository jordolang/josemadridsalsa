/**
 * EverShop API Client
 * Handles communication between Next.js and EverShop backend
 */

import type { Order, OrderItem, Address } from '@prisma/client';

interface EverShopConfig {
  apiUrl: string;
  apiKey: string;
}

interface EverShopOrder {
  orderNumber: string;
  customerEmail: string;
  customerFullName: string;
  status: string;
  paymentStatus: string | null;
  shipmentStatus: string | null;
  currency: string;
  items: EverShopOrderItem[];
  shippingAddress: EverShopAddress;
  billingAddress?: EverShopAddress;
  grandTotal: number;
  subTotal: number;
  taxAmount: number;
  shippingFee: number;
  discountAmount: number;
  shippingMethod?: string;
  paymentMethod?: string;
  shippingNote?: string;
}

interface EverShopOrderItem {
  productSku: string;
  productName: string;
  qty: number;
  productPrice: number;
  finalPrice: number;
  lineTotal: number;
  taxAmount: number;
  discountAmount: number;
}

interface EverShopAddress {
  fullName: string;
  telephone: string;
  address1: string;
  address2?: string;
  city: string;
  province: string;
  postcode: string;
  country: string;
}

interface EverShopOrderResponse {
  success: boolean;
  order?: {
    orderId: number;
    uuid: string;
    orderNumber: string;
  };
  error?: string;
}

interface EverShopOrderStatusResponse {
  success: boolean;
  order?: {
    orderNumber: string;
    status: string;
    paymentStatus: string;
    shipmentStatus: string;
    shipment?: {
      carrier: string;
      trackingNumber: string;
    };
  };
  error?: string;
}

type PrismaOrderWithRelations = Order & { 
  items: (OrderItem & { product?: { name?: string | null; sku?: string | null } | null })[]; 
  shippingAddress?: Address | null;
  billingAddress?: Address | null;
  user?: { email?: string | null; name?: string | null } | null;
};

export function mapPrismaOrderStatusToEverShop(status: string): string {
  const statusMap: Record<string, string> = {
    PENDING: 'pending',
    CONFIRMED: 'confirmed',
    PROCESSING: 'processing',
    SHIPPED: 'shipped',
    DELIVERED: 'delivered',
    CANCELLED: 'cancelled',
    REFUNDED: 'refunded',
  };
  return statusMap[status] || 'pending';
}

export function mapPrismaPaymentStatusToEverShop(status: string): string | null {
  const statusMap: Record<string, string | null> = {
    PENDING: null,
    PAID: 'paid',
    FAILED: 'failed',
    REFUNDED: 'refunded',
    PARTIALLY_REFUNDED: 'partially_refunded',
  };
  return statusMap[status] ?? null;
}

export function transformOrderForEverShop(order: PrismaOrderWithRelations): EverShopOrder {
  const items: EverShopOrderItem[] = order.items.map(item => ({
    productSku: item.productSku,
    productName: item.productName,
    qty: item.quantity,
    productPrice: Number(item.unitPrice),
    finalPrice: Number(item.unitPrice),
    lineTotal: Number(item.totalPrice),
    taxAmount: 0,
    discountAmount: 0,
  }));

  const shippingAddress: EverShopAddress = {
    fullName: order.shippingAddress 
      ? `${order.shippingAddress.firstName} ${order.shippingAddress.lastName}`
      : 'Guest Customer',
    telephone: order.shippingAddress?.phone || order.guestPhone || '',
    address1: order.shippingAddress?.street || '',
    address2: '',
    city: order.shippingAddress?.city || '',
    province: order.shippingAddress?.state || '',
    postcode: order.shippingAddress?.zipCode || '',
    country: order.shippingAddress?.country || 'US',
  };

  const billingAddress: EverShopAddress | undefined = order.billingAddress ? {
    fullName: `${order.billingAddress.firstName} ${order.billingAddress.lastName}`,
    telephone: order.billingAddress.phone || '',
    address1: order.billingAddress.street,
    address2: '',
    city: order.billingAddress.city,
    province: order.billingAddress.state,
    postcode: order.billingAddress.zipCode,
    country: order.billingAddress.country,
  } : undefined;

  return {
    orderNumber: order.orderNumber,
    customerEmail: order.guestEmail || order.user?.email || '',
    customerFullName: order.shippingAddress
      ? `${order.shippingAddress.firstName} ${order.shippingAddress.lastName}`
      : order.user?.name || 'Guest',
    status: mapPrismaOrderStatusToEverShop(order.status),
    paymentStatus: mapPrismaPaymentStatusToEverShop(order.paymentStatus),
    shipmentStatus: null,
    currency: 'USD',
    items,
    shippingAddress,
    billingAddress,
    grandTotal: Number(order.total),
    subTotal: Number(order.subtotal),
    taxAmount: Number(order.tax),
    shippingFee: Number(order.shippingCost),
    discountAmount: Number(order.discountAmount),
    shippingMethod: order.shippingMethod || undefined,
    paymentMethod: order.paymentMethod || undefined,
    shippingNote: order.customerNotes || undefined,
  };
}

export class EverShopClient {
  private config: EverShopConfig;

  constructor(config: EverShopConfig) {
    this.config = config;
  }

  /**
   * Create order in EverShop
   */
  async createOrder(order: PrismaOrderWithRelations): Promise<EverShopOrderResponse> {
    try {
      const evershopOrder = transformOrderForEverShop(order);

      const response = await fetch(`${this.config.apiUrl}/orders`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'X-API-Key': this.config.apiKey,
        },
        body: JSON.stringify(evershopOrder),
      });

      if (!response.ok) {
        const error = await response.text();
        return {
          success: false,
          error: `EverShop API error: ${error}`,
        };
      }

      const data = await response.json();
      return {
        success: true,
        order: data,
      };
    } catch (error) {
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Unknown error',
      };
    }
  }

  /**
   * Get order status from EverShop
   */
  async getOrderStatus(orderNumber: string): Promise<EverShopOrderStatusResponse> {
    try {
      const response = await fetch(`${this.config.apiUrl}/orders/${orderNumber}`, {
        method: 'GET',
        headers: {
          'X-API-Key': this.config.apiKey,
        },
      });

      if (!response.ok) {
        return {
          success: false,
          error: `Order not found: ${orderNumber}`,
        };
      }

      const data = await response.json();
      return {
        success: true,
        order: data,
      };
    } catch (error) {
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Unknown error',
      };
    }
  }

  /**
   * Cancel order in EverShop
   */
  async cancelOrder(orderNumber: string): Promise<{ success: boolean; error?: string }> {
    try {
      const response = await fetch(`${this.config.apiUrl}/orders/${orderNumber}/cancel`, {
        method: 'POST',
        headers: {
          'X-API-Key': this.config.apiKey,
        },
      });

      if (!response.ok) {
        const error = await response.text();
        return {
          success: false,
          error: `Failed to cancel order: ${error}`,
        };
      }

      return { success: true };
    } catch (error) {
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Unknown error',
      };
    }
  }
}

// Singleton instance
let evershopClient: EverShopClient | null = null;

export function getEverShopClient(): EverShopClient {
  if (!evershopClient) {
    const apiUrl = process.env.EVERSHOP_API_URL;
    const apiKey = process.env.EVERSHOP_API_KEY;

    if (!apiUrl || !apiKey) {
      throw new Error('EverShop API configuration missing. Set EVERSHOP_API_URL and EVERSHOP_API_KEY');
    }

    evershopClient = new EverShopClient({ apiUrl, apiKey });
  }

  return evershopClient;
}

export type { EverShopOrder, EverShopOrderItem, EverShopAddress, EverShopOrderResponse };
