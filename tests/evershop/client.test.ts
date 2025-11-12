import { describe, expect, it, beforeEach, afterAll, vi } from 'vitest'
import { Prisma } from '@prisma/client'
import {
  EverShopClient,
  transformOrderForEverShop,
} from '@/lib/evershop/client'

const decimal = (value: number) => new Prisma.Decimal(value.toFixed(2))

const buildOrder = () =>
  ({
    id: 'order_1',
    orderNumber: 'JMS-2024-0001',
    guestEmail: 'guest@example.com',
    guestPhone: '555-111-2222',
    status: 'PENDING',
    subtotal: decimal(20),
    shippingCost: decimal(5),
    tax: decimal(1.5),
    discountAmount: decimal(0),
    total: decimal(26.5),
    shippingMethod: 'Ground',
    paymentStatus: 'PENDING',
    paymentMethod: 'card',
    customerNotes: 'Please leave at the door',
    shippingAddress: null,
    billingAddress: null,
    user: null,
    items: [
      {
        id: 'item_1',
        orderId: 'order_1',
        productId: 'prod_1',
        quantity: 2,
        unitPrice: decimal(10),
        totalPrice: decimal(20),
        productName: 'Salsa Verde',
        productSku: 'SALSAVERDE',
        productImage: null,
        createdAt: new Date(),
        product: {
          name: 'Salsa Verde',
          sku: 'SALSAVERDE',
        },
      },
    ],
  } as unknown as Parameters<typeof transformOrderForEverShop>[0])

describe('EverShop client helpers', () => {
  it('transforms Prisma order into EverShop payload', () => {
    const order = buildOrder()
    const transformed = transformOrderForEverShop(order)

    expect(transformed.orderNumber).toBe(order.orderNumber)
    expect(transformed.customerEmail).toBe(order.guestEmail)
    expect(transformed.status).toBe('pending')
    expect(transformed.paymentStatus).toBeNull()
    expect(transformed.items).toHaveLength(1)
    expect(transformed.items[0]).toMatchObject({
      productSku: 'SALSAVERDE',
      qty: 2,
      lineTotal: 20,
    })
  })
})

describe('EverShopClient', () => {
  const originalFetch = global.fetch
  const fetchMock = vi.fn()
  const client = new EverShopClient({
    apiUrl: 'http://localhost:3001/api',
    apiKey: 'test-key',
  })
  const order = buildOrder()

  beforeEach(() => {
    fetchMock.mockReset()
    global.fetch = fetchMock as unknown as typeof fetch
  })

  afterAll(() => {
    global.fetch = originalFetch
  })

  it('returns success when EverShop responds with OK', async () => {
    fetchMock.mockResolvedValue({
      ok: true,
      json: async () => ({ orderId: 42, uuid: 'abc', orderNumber: order.orderNumber }),
    })

    const result = await client.createOrder(order)
    expect(result.success).toBe(true)
    expect(result.order?.orderId).toBe(42)
    expect(fetchMock).toHaveBeenCalledWith(
      'http://localhost:3001/api/orders',
      expect.objectContaining({
        method: 'POST',
        headers: expect.objectContaining({
          'X-API-Key': 'test-key',
        }),
      })
    )
  })

  it('returns error when EverShop responds with failure', async () => {
    fetchMock.mockResolvedValue({
      ok: false,
      text: async () => 'Bad Request',
    })

    const result = await client.createOrder(order)
    expect(result.success).toBe(false)
    expect(result.error).toContain('Bad Request')
  })
})
