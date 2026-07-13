import { describe, expect, it, vi, afterEach } from 'vitest'
import {
  ShopifyAdminClient,
  mapPrismaPaymentStatusToShopify,
  transformOrderForShopify,
} from '@/lib/shopify/client'

const order = {
  id: 'order_1',
  orderNumber: 'JMS-20250216-1234',
  guestEmail: 'guest@example.com',
  guestPhone: '555-111-2222',
  paymentStatus: 'PENDING',
  customerNotes: 'Leave at the door',
  shippingMethod: 'UPS Ground',
  tax: 2,
  discountAmount: 0,
  shippingCost: 5,
  items: [
    {
      productName: 'Salsa Verde',
      productSku: 'SV-1',
      quantity: 2,
      unitPrice: 10,
      product: {
        name: 'Salsa Verde',
        sku: 'SV-1',
      },
    },
  ],
  shippingAddress: {
    firstName: 'Jane',
    lastName: 'Doe',
    street: '123 Main St',
    city: 'Columbus',
    state: 'OH',
    zipCode: '43004',
    country: 'US',
    phone: '555-111-2222',
    company: null,
  },
  billingAddress: null,
  user: null,
} as unknown as Parameters<typeof transformOrderForShopify>[0]

describe('Shopify client helpers', () => {
  afterEach(() => {
    vi.restoreAllMocks()
  })

  it('transforms Prisma order into Shopify payload', () => {
    const payload = transformOrderForShopify(order)
    expect(payload.order.line_items).toHaveLength(1)
    expect(payload.order.line_items[0].title).toBe('Salsa Verde')
    expect(payload.order.note_attributes).toEqual(
      expect.arrayContaining([
        expect.objectContaining({ name: 'orderNumber', value: order.orderNumber }),
      ])
    )
  })

  it('maps Prisma payment status to Shopify values', () => {
    expect(mapPrismaPaymentStatusToShopify('PENDING' as const)).toBe('pending')
    expect(mapPrismaPaymentStatusToShopify('PAID' as const)).toBe('paid')
  })

  it('creates Shopify orders via Admin API', async () => {
    vi.spyOn(globalThis, 'fetch').mockResolvedValueOnce({
      ok: true,
      status: 201,
      json: async () => ({ order: { id: 123, name: '#1001' } }),
    } as Response)

    const client = new ShopifyAdminClient({
      storeDomain: 'example.myshopify.com',
      accessToken: 'test',
      apiVersion: '2024-10',
    })

    const result = await client.createOrder(order)
    expect(result.success).toBe(true)
    expect(result.order?.name).toBe('#1001')
  })

  it('handles Shopify API errors gracefully', async () => {
    vi.spyOn(globalThis, 'fetch').mockResolvedValueOnce({
      ok: false,
      status: 400,
      text: async () => 'bad request',
    } as Response)

    const client = new ShopifyAdminClient({
      storeDomain: 'example.myshopify.com',
      accessToken: 'test',
      apiVersion: '2024-10',
    })

    const result = await client.createOrder(order)
    expect(result.success).toBe(false)
    expect(result.error).toContain('Shopify API error')
  })
})
