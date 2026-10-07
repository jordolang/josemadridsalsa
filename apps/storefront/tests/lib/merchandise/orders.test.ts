import { beforeEach, describe, expect, it, vi } from 'vitest'
import type { Order as SquareOrder } from 'square'

/**
 * The merch money path: what we charge is priced from Printify (never the request), and a
 * paid order reaches Printify exactly once however many times the thank-you page and the
 * sweep ask for it.
 */

const merchOrder = {
  create: vi.fn(),
  findUnique: vi.fn(),
  findMany: vi.fn(),
  update: vi.fn(),
  updateMany: vi.fn(),
}
const paymentLinksCreate = vi.fn()
const ordersGet = vi.fn()
const createPrintifyOrder = vi.fn()
const getMerchProduct = vi.fn()

vi.mock('@/lib/prisma', () => ({ default: { merchOrder } }))
vi.mock('@/lib/payments/providers/square', () => ({
  getSquareClient: () => ({ checkout: { paymentLinks: { create: paymentLinksCreate } }, orders: { get: ordersGet } }),
}))
vi.mock('@/lib/printify/client', () => ({ createPrintifyOrder: (...a: unknown[]) => createPrintifyOrder(...a) }))
vi.mock('@/lib/merchandise/catalog', () => ({ getMerchProduct: (...a: unknown[]) => getMerchProduct(...a) }))

const {
  createMerchCheckout,
  fulfillMerchOrder,
  isSquareOrderPaid,
  merchCheckoutSchema,
  merchShippingCents,
  squareShippingAddress,
  sweepMerchOrders,
} = await import('@/lib/merchandise/orders')

const PRODUCT_ID = '5d39b411749d0a000f30e0f4'
const ORDER_ID = '7f1c2d3e-4b5a-4c6d-8e9f-0a1b2c3d4e5f'

const product = {
  id: PRODUCT_ID,
  title: 'Tour Shirt',
  variants: [{ id: 101, title: 'Black / M', priceCents: 2500, optionIds: [1, 10], isDefault: true }],
}

function paidSquareOrder(overrides: Partial<SquareOrder> = {}): SquareOrder {
  return {
    locationId: 'LOC1',
    state: 'OPEN',
    tenders: [{ type: 'CARD' }],
    netAmountDueMoney: { amount: BigInt(0), currency: 'USD' },
    totalMoney: { amount: BigInt(3199), currency: 'USD' },
    fulfillments: [
      {
        type: 'SHIPMENT',
        shipmentDetails: {
          recipient: {
            displayName: 'Ana Lopez',
            emailAddress: 'ana@example.com',
            address: {
              addressLine1: '1 Main St',
              locality: 'Zanesville',
              administrativeDistrictLevel1: 'OH',
              postalCode: '43701',
              country: 'US',
            },
          },
        },
      },
    ],
    ...overrides,
  } as SquareOrder
}

const pendingRecord = {
  id: ORDER_ID,
  squareOrderId: 'SQ_ORDER',
  status: 'AWAITING_PAYMENT',
  totalCents: 3199,
  printifyOrderId: null,
  items: [{ productId: PRODUCT_ID, variantId: 101, quantity: 2, title: 'Tour Shirt', variantTitle: 'Black / M', unitPriceCents: 2500 }],
}

beforeEach(() => {
  vi.clearAllMocks()
  vi.stubEnv('SQUARE_LOCATION_ID', 'LOC1')
})

describe('merchShippingCents', () => {
  it('charges the first item more than each additional one', () => {
    expect(merchShippingCents(1)).toBe(699)
    expect(merchShippingCents(3)).toBe(699 + 250 * 2)
  })
})

describe('merchCheckoutSchema', () => {
  it('rejects a bad product id or an out-of-range quantity', () => {
    expect(merchCheckoutSchema.safeParse({ productId: 'nope', variantId: 1, quantity: 1 }).success).toBe(false)
    expect(merchCheckoutSchema.safeParse({ productId: PRODUCT_ID, variantId: 1, quantity: 11 }).success).toBe(false)
    expect(merchCheckoutSchema.safeParse({ productId: PRODUCT_ID, variantId: 1, quantity: 2 }).success).toBe(true)
  })
})

describe('createMerchCheckout', () => {
  it('prices from Printify, adds shipping, and records the pending order', async () => {
    getMerchProduct.mockResolvedValue(product)
    paymentLinksCreate.mockResolvedValue({ paymentLink: { id: 'PL', orderId: 'SQ_ORDER', url: 'https://square.link/u/abc', version: 1 } })

    const result = await createMerchCheckout({ productId: PRODUCT_ID, variantId: 101, quantity: 2 }, 'https://www.josemadrid.net')

    expect(result.url).toBe('https://square.link/u/abc')
    expect(getMerchProduct).toHaveBeenCalledWith(PRODUCT_ID, 0)
    const request = paymentLinksCreate.mock.calls[0][0]
    expect(request.order.lineItems[0].basePriceMoney.amount).toBe(BigInt(2500))
    expect(request.order.lineItems[0].quantity).toBe('2')
    expect(request.checkoutOptions.shippingFee.charge.amount).toBe(BigInt(949))
    expect(request.checkoutOptions.askForShippingAddress).toBe(true)
    expect(request.checkoutOptions.redirectUrl).toMatch(/^https:\/\/www\.josemadrid\.net\/merchandise\/order-complete\?ref=/)
    expect(merchOrder.create).toHaveBeenCalledWith({
      data: expect.objectContaining({ squareOrderId: 'SQ_ORDER', totalCents: 2500 * 2 + 949 }),
    })
  })

  it('refuses a variant that is not for sale', async () => {
    getMerchProduct.mockResolvedValue(product)
    await expect(
      createMerchCheckout({ productId: PRODUCT_ID, variantId: 999, quantity: 1 }, 'https://x.test')
    ).rejects.toMatchObject({ status: 404 })
    expect(paymentLinksCreate).not.toHaveBeenCalled()
  })
})

describe('isSquareOrderPaid', () => {
  it('needs a tender, nothing left due, our location and the amount we priced', () => {
    expect(isSquareOrderPaid(paidSquareOrder(), 'LOC1', 3199)).toBe(true)
    expect(isSquareOrderPaid(paidSquareOrder({ tenders: [] }), 'LOC1', 3199)).toBe(false)
    expect(isSquareOrderPaid(paidSquareOrder({ netAmountDueMoney: { amount: BigInt(100), currency: 'USD' } }), 'LOC1', 3199)).toBe(false)
    expect(isSquareOrderPaid(paidSquareOrder(), 'OTHER', 3199)).toBe(false)
    expect(isSquareOrderPaid(paidSquareOrder(), 'LOC1', 5000)).toBe(false)
    expect(isSquareOrderPaid(paidSquareOrder({ state: 'CANCELED' }), 'LOC1', 3199)).toBe(false)
  })
})

describe('squareShippingAddress', () => {
  it('maps the address Square collected into Printify shape', () => {
    expect(squareShippingAddress(paidSquareOrder())).toEqual({
      first_name: 'Ana',
      last_name: 'Lopez',
      email: 'ana@example.com',
      country: 'US',
      region: 'OH',
      address1: '1 Main St',
      city: 'Zanesville',
      zip: '43701',
    })
  })

  it('returns null without a usable address', () => {
    expect(squareShippingAddress(paidSquareOrder({ fulfillments: [] }))).toBeNull()
  })
})

describe('fulfillMerchOrder', () => {
  it('sends a paid order to Printify and marks it submitted', async () => {
    merchOrder.findUnique.mockResolvedValue(pendingRecord)
    ordersGet.mockResolvedValue({ order: paidSquareOrder() })
    merchOrder.updateMany.mockResolvedValue({ count: 1 })
    createPrintifyOrder.mockResolvedValue({ id: 'PF1' })

    await expect(fulfillMerchOrder(ORDER_ID)).resolves.toEqual({ status: 'submitted', printifyOrderId: 'PF1' })
    expect(createPrintifyOrder).toHaveBeenCalledWith(
      expect.objectContaining({
        external_id: 'SQ_ORDER',
        line_items: [{ product_id: PRODUCT_ID, variant_id: 101, quantity: 2 }],
        shipping_method: 1,
      })
    )
    expect(merchOrder.update).toHaveBeenCalledWith(
      expect.objectContaining({ data: expect.objectContaining({ status: 'SUBMITTED', printifyOrderId: 'PF1' }) })
    )
  })

  it('does nothing until Square shows the order paid', async () => {
    merchOrder.findUnique.mockResolvedValue(pendingRecord)
    ordersGet.mockResolvedValue({ order: paidSquareOrder({ tenders: [] }) })

    await expect(fulfillMerchOrder(ORDER_ID)).resolves.toEqual({ status: 'awaiting-payment' })
    expect(merchOrder.updateMany).not.toHaveBeenCalled()
    expect(createPrintifyOrder).not.toHaveBeenCalled()
  })

  it('does not submit when another caller already claimed the order', async () => {
    merchOrder.findUnique.mockResolvedValueOnce(pendingRecord).mockResolvedValueOnce({ ...pendingRecord, status: 'SUBMITTING' })
    ordersGet.mockResolvedValue({ order: paidSquareOrder() })
    merchOrder.updateMany.mockResolvedValue({ count: 0 })

    await expect(fulfillMerchOrder(ORDER_ID)).resolves.toEqual({ status: 'processing' })
    expect(createPrintifyOrder).not.toHaveBeenCalled()
  })

  it('never calls Square or Printify again for an order already sent', async () => {
    merchOrder.findUnique.mockResolvedValue({ ...pendingRecord, status: 'SUBMITTED', printifyOrderId: 'PF1' })
    await expect(fulfillMerchOrder(ORDER_ID)).resolves.toEqual({ status: 'submitted', printifyOrderId: 'PF1' })
    expect(ordersGet).not.toHaveBeenCalled()
  })

  it('records the Printify error so the sweep retries it', async () => {
    merchOrder.findUnique.mockResolvedValue(pendingRecord)
    ordersGet.mockResolvedValue({ order: paidSquareOrder() })
    merchOrder.updateMany.mockResolvedValue({ count: 1 })
    createPrintifyOrder.mockRejectedValue(new Error('Printify POST failed (400): bad address'))

    const result = await fulfillMerchOrder(ORDER_ID)
    expect(result.status).toBe('failed')
    expect(merchOrder.update).toHaveBeenCalledWith(
      expect.objectContaining({ data: expect.objectContaining({ status: 'FAILED', lastError: expect.stringContaining('bad address') }) })
    )
  })
})

describe('sweepMerchOrders', () => {
  it('expires stale unpaid links and retries due orders', async () => {
    merchOrder.updateMany.mockResolvedValueOnce({ count: 3 })
    merchOrder.findMany.mockResolvedValue([{ id: ORDER_ID }])
    merchOrder.findUnique.mockResolvedValue({ ...pendingRecord, status: 'SUBMITTED', printifyOrderId: 'PF1' })

    const result = await sweepMerchOrders(new Date('2026-10-07T00:00:00Z'))
    expect(result).toMatchObject({ checked: 1, expired: 3, submitted: 1 })
    expect(merchOrder.updateMany.mock.calls[0][0]).toMatchObject({
      where: { status: 'AWAITING_PAYMENT', createdAt: { lt: new Date('2026-09-30T00:00:00Z') } },
      data: { status: 'EXPIRED' },
    })
  })
})
