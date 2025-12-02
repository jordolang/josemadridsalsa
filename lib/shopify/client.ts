import type { Address, Order, OrderItem, PaymentStatus } from '@prisma/client'

type PrismaOrderWithRelations = Order & {
  items: (OrderItem & { product?: { name?: string | null; sku?: string | null } | null })[]
  shippingAddress?: Address | null
  billingAddress?: Address | null
  user?: { email?: string | null; name?: string | null } | null
}

interface ShopifyConfig {
  storeDomain: string
  accessToken: string
  apiVersion: string
}

interface ShopifyOrderPayload {
  order: {
    email?: string | null
    phone?: string | null
    currency: string
    financial_status: string
    inventory_behaviour: 'decrement_obeying_policy'
    send_receipt: boolean
    send_fulfillment_receipt: boolean
    tags: string
    note?: string
    note_attributes: { name: string; value: string }[]
    line_items: ShopifyLineItemPayload[]
    shipping_lines?: { title: string; code: string; price: string }[]
    shipping_address?: ShopifyAddressPayload
    billing_address?: ShopifyAddressPayload
    total_tax?: string
    total_discounts?: string
  }
}

interface ShopifyLineItemPayload {
  title: string
  sku?: string | null
  quantity: number
  price: string
  requires_shipping: boolean
  taxable: boolean
}

interface ShopifyAddressPayload {
  first_name?: string | null
  last_name?: string | null
  address1?: string | null
  address2?: string | null
  city?: string | null
  province?: string | null
  zip?: string | null
  country?: string | null
  phone?: string | null
  company?: string | null
}

export interface ShopifyOrderSummary {
  id: number
  name: string
  order_number: number
  admin_graphql_api_id?: string
  financial_status?: string | null
  fulfillment_status?: string | null
  cancelled_at?: string | null
  closed_at?: string | null
  note_attributes?: { name: string; value: string }[]
  fulfillments?: Array<{
    status?: string | null
    tracking_number?: string | null
    tracking_numbers?: string[] | null
    tracking_urls?: string[] | null
    tracking_company?: string | null
    created_at?: string | null
  }>
}

interface ShopifyOrderResponse {
  order: ShopifyOrderSummary
}

const PAYMENT_STATUS_MAP: Record<PaymentStatus, string> = {
  PENDING: 'pending',
  PAID: 'paid',
  FAILED: 'voided',
  REFUNDED: 'refunded',
  PARTIALLY_REFUNDED: 'partially_refunded',
}

export function mapPrismaPaymentStatusToShopify(status: PaymentStatus): string {
  return PAYMENT_STATUS_MAP[status] ?? 'pending'
}

export function transformOrderForShopify(order: PrismaOrderWithRelations): ShopifyOrderPayload {
  const lineItems: ShopifyLineItemPayload[] = order.items.map((item) => ({
    title: item.productName,
    sku: item.productSku || item.product?.sku || undefined,
    quantity: item.quantity,
    price: Number(item.unitPrice).toFixed(2),
    requires_shipping: true,
    taxable: true,
  }))

  const shippingAddress: ShopifyAddressPayload | undefined = order.shippingAddress
    ? {
        first_name: order.shippingAddress.firstName,
        last_name: order.shippingAddress.lastName,
        company: order.shippingAddress.company,
        address1: order.shippingAddress.street,
        city: order.shippingAddress.city,
        province: order.shippingAddress.state,
        zip: order.shippingAddress.zipCode,
        country: order.shippingAddress.country || 'US',
        phone: order.shippingAddress.phone,
      }
    : undefined

  const billingAddress: ShopifyAddressPayload | undefined = order.billingAddress
    ? {
        first_name: order.billingAddress.firstName,
        last_name: order.billingAddress.lastName,
        company: order.billingAddress.company,
        address1: order.billingAddress.street,
        city: order.billingAddress.city,
        province: order.billingAddress.state,
        zip: order.billingAddress.zipCode,
        country: order.billingAddress.country || 'US',
        phone: order.billingAddress.phone,
      }
    : undefined

  const tags = ['Jose Madrid Salsa', 'Next.js Storefront']
  const noteAttributes = [
    { name: 'orderNumber', value: order.orderNumber },
    { name: 'orderId', value: order.id },
  ]

  const payload: ShopifyOrderPayload = {
    order: {
      email: order.guestEmail || order.user?.email || undefined,
      phone: order.guestPhone || undefined,
      currency: 'USD',
      financial_status: mapPrismaPaymentStatusToShopify(order.paymentStatus),
      inventory_behaviour: 'decrement_obeying_policy',
      send_receipt: false,
      send_fulfillment_receipt: false,
      tags: tags.join(', '),
      note: order.customerNotes || undefined,
      note_attributes: noteAttributes,
      line_items: lineItems,
      shipping_address: shippingAddress,
      billing_address: billingAddress,
      total_tax: Number(order.tax).toFixed(2),
      total_discounts: Number(order.discountAmount).toFixed(2),
    },
  }

  if (Number(order.shippingCost) > 0 || order.shippingMethod) {
    payload.order.shipping_lines = [
      {
        title: order.shippingMethod || 'Shipping',
        code: 'MANUAL',
        price: Number(order.shippingCost).toFixed(2),
      },
    ]
  }

  return payload
}

export class ShopifyAdminClient {
  private readonly storeDomain: string
  private readonly accessToken: string
  private readonly apiVersion: string

  constructor(config: ShopifyConfig) {
    this.storeDomain = config.storeDomain.replace(/^https?:\/\//i, '').replace(/\/$/, '')
    this.accessToken = config.accessToken
    this.apiVersion = config.apiVersion
  }

  private get baseUrl() {
    return `https://${this.storeDomain}/admin/api/${this.apiVersion}`
  }

  private async request<T>(path: string, init: RequestInit): Promise<T> {
    const url = `${this.baseUrl}${path}`

    const response = await fetch(url, {
      ...init,
      headers: {
        'Content-Type': 'application/json',
        'X-Shopify-Access-Token': this.accessToken,
        ...(init.headers ?? {}),
      },
    })

    if (!response.ok) {
      const errorText = await response.text()
      throw new Error(`Shopify API error (${response.status}): ${errorText}`)
    }

    if (response.status === 204) {
      return {} as T
    }

    return (await response.json()) as T
  }

  async createOrder(order: PrismaOrderWithRelations): Promise<{ success: boolean; order?: ShopifyOrderSummary; error?: string }> {
    try {
      const payload = transformOrderForShopify(order)
      const data = await this.request<ShopifyOrderResponse>('/orders.json', {
        method: 'POST',
        body: JSON.stringify(payload),
      })

      return { success: true, order: data.order }
    } catch (error) {
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Unknown Shopify error',
      }
    }
  }

  async cancelOrder(shopifyOrderId: string, reason?: string) {
    await this.request(`/orders/${shopifyOrderId}/cancel.json`, {
      method: 'POST',
      body: JSON.stringify({
        email: false,
        restock: true,
        reason: reason ? 'customer' : undefined,
        note: reason,
      }),
    })
  }

  async getOrder(shopifyOrderId: string): Promise<ShopifyOrderSummary> {
    const data = await this.request<ShopifyOrderResponse>(`/orders/${shopifyOrderId}.json`, {
      method: 'GET',
    })

    return data.order
  }
}

let shopifyClient: ShopifyAdminClient | null = null

export function getShopifyClient(): ShopifyAdminClient {
  if (!shopifyClient) {
    const storeDomain = process.env.SHOPIFY_STORE_DOMAIN
    const accessToken = process.env.SHOPIFY_ADMIN_API_TOKEN
    const apiVersion = process.env.SHOPIFY_API_VERSION || '2024-10'

    if (!storeDomain || !accessToken) {
      throw new Error('Shopify configuration missing. Set SHOPIFY_STORE_DOMAIN and SHOPIFY_ADMIN_API_TOKEN')
    }

    shopifyClient = new ShopifyAdminClient({ storeDomain, accessToken, apiVersion })
  }

  return shopifyClient
}
