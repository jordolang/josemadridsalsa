import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { http, HttpResponse } from 'msw'
import { server } from '@/tests/mocks/server'
import { normalizeBigCommerceProduct, type RawBigCommerceProduct } from '@/lib/bigcommerce/catalog'
import {
  bigCommerceOrderNumber,
  buildMirrorItems,
  mapBigCommerceStatus,
  mirrorBigCommerceOrder,
  syncBigCommerceOrders,
  type RawBigCommerceOrderProduct,
  type SiteProductRef,
} from '@/lib/bigcommerce/orders'
import { bigCommerceOrderLock } from '@/lib/bigcommerce/order-lock'
import fixtures from './fixtures.json'

const db = vi.hoisted(() => ({
  order: { findUnique: vi.fn(), create: vi.fn(), update: vi.fn() },
  orderItem: { deleteMany: vi.fn(), createMany: vi.fn() },
  product: { findMany: vi.fn() },
  user: { findFirst: vi.fn() },
  $transaction: vi.fn(),
}))
vi.mock('@/lib/prisma', () => ({ prisma: db, default: db }))

const API = 'https://api.bigcommerce.com/stores/testhash'
const [originalHotRaw, chooseSixRaw] = fixtures as unknown as RawBigCommerceProduct[]

// Catalog: Original Hot (98), Garden Fresh Cilantro Salsa Mild (105), and a Choose-5 pack (122).
const cilantroRaw: RawBigCommerceProduct = {
  ...originalHotRaw,
  id: 105,
  name: 'Garden Fresh Cilantro Salsa Mild',
  custom_url: { url: '/garden-fresh-cilantro-salsa-mild/' },
}
const chooseFiveRaw: RawBigCommerceProduct = { ...chooseSixRaw, id: 122, name: 'Choose-5', price: 28, calculated_price: 28 }
const catalog = [originalHotRaw, cilantroRaw, chooseFiveRaw].map((raw) => normalizeBigCommerceProduct(raw))

const siteProducts: SiteProductRef[] = [
  { id: 'p-oh', slug: 'original-hot', name: 'Original Hot', sku: 'OH', featuredImage: '/oh.jpg', costPrice: 2.32 },
  { id: 'p-gc', slug: 'garden-cilantro-mild-salsa', name: 'Garden Cilantro Mild', sku: 'GCM', featuredImage: null, costPrice: 2.32 },
]

const loose = (overrides: Partial<RawBigCommerceOrderProduct> = {}): RawBigCommerceOrderProduct => ({
  product_id: 98,
  name: 'Original Hot',
  sku: '',
  quantity: 2,
  quantity_shipped: 0,
  total_ex_tax: '16.0000',
  product_options: [],
  ...overrides,
})

// A real order shape (BigCommerce order 9595, trimmed): one Choose-5.
const packLine: RawBigCommerceOrderProduct = {
  product_id: 122,
  name: 'Choose-5',
  sku: '',
  quantity: 1,
  quantity_shipped: 0,
  total_ex_tax: '28.0000',
  product_options: [
    { display_name: 'Order Notes', display_value: 'Please tell us any order details' },
    { display_name: 'Jar 1', display_value: 'Garden Fresh Cilantro Mild' },
    { display_name: 'Jar 2', display_value: 'Garden Fresh Cilantro Mild' },
    { display_name: 'Jar 3', display_value: 'Original Hot' },
    { display_name: 'Jar 4', display_value: 'Original Hot' },
    { display_name: 'Jar 5', display_value: 'Original Hot' },
  ],
}

describe('mapBigCommerceStatus', () => {
  it('does not mirror orders that are not sales yet', () => {
    expect(mapBigCommerceStatus(0)).toBeNull()
    expect(mapBigCommerceStatus(1)).toBeNull()
    expect(mapBigCommerceStatus(7)).toBeNull()
  })

  it('maps paid, shipped, completed, cancelled and refunded orders', () => {
    expect(mapBigCommerceStatus(11)).toEqual({ status: 'PROCESSING', paymentStatus: 'PAID' })
    expect(mapBigCommerceStatus(2)).toEqual({ status: 'SHIPPED', paymentStatus: 'PAID' })
    expect(mapBigCommerceStatus(10)).toEqual({ status: 'DELIVERED', paymentStatus: 'PAID' })
    expect(mapBigCommerceStatus(5)).toEqual({ status: 'CANCELLED', paymentStatus: 'CANCELED' })
    expect(mapBigCommerceStatus(4)).toEqual({ status: 'REFUNDED', paymentStatus: 'REFUNDED' })
    expect(mapBigCommerceStatus(14, 3)).toEqual({ status: 'SHIPPED', paymentStatus: 'PARTIALLY_REFUNDED' })
  })
})

describe('buildMirrorItems', () => {
  it('maps a loose jar to its site product with its cost snapshot', () => {
    const { items, unmatched } = buildMirrorItems([loose({ quantity_shipped: 2 })], catalog, siteProducts)

    expect(unmatched).toEqual([])
    expect(items).toEqual([
      {
        productId: 'p-oh',
        quantity: 2,
        quantityFulfilled: 2,
        unitPrice: 8,
        totalPrice: 16,
        unitCost: 2.32,
        productName: 'Original Hot',
        productSku: 'OH',
        productImage: '/oh.jpg',
      },
    ])
  })

  it('splits a pack into one line per chosen jar, priced to the cent, including reworded choices', () => {
    const { items, unmatched } = buildMirrorItems([packLine], catalog, siteProducts)

    expect(unmatched).toEqual([])
    expect(items.map((item) => [item.productId, item.totalPrice])).toEqual([
      ['p-gc', 5.6],
      ['p-gc', 5.6],
      ['p-oh', 5.6],
      ['p-oh', 5.6],
      ['p-oh', 5.6],
    ])
    expect(items.reduce((sum, item) => sum + item.totalPrice, 0)).toBeCloseTo(28, 10)
  })

  it('never splits a pack price in a way that loses or gains a cent', () => {
    const odd = { ...packLine, total_ex_tax: '23.0000', product_options: packLine.product_options.slice(0, 4) }
    const { items } = buildMirrorItems([odd], catalog, siteProducts)
    expect(Math.round(items.reduce((sum, item) => sum + item.totalPrice, 0) * 100)).toBe(2300)
  })

  it('reports lines it cannot match instead of guessing', () => {
    const { items, unmatched } = buildMirrorItems(
      [loose({ product_id: 999, name: 'Salsa T-Shirt', quantity: 1 })],
      catalog,
      siteProducts,
    )
    expect(items).toEqual([])
    expect(unmatched).toEqual(['1 × Salsa T-Shirt'])
  })
})

describe('mirrorBigCommerceOrder', () => {
  const order = {
    id: 9595,
    status_id: 11,
    date_created: 'Fri, 25 Sep 2026 01:09:04 +0000',
    date_shipped: '',
    subtotal_ex_tax: '28.0000',
    shipping_cost_ex_tax: '9.0000',
    total_tax: '0.0000',
    discount_amount: '0.0000',
    coupon_discount: '0.0000',
    gift_certificate_amount: '0.0000',
    total_inc_tax: '37.0000',
    payment_method: 'Credit Cards',
    customer_message: '',
    billing_address: {
      first_name: 'Ana', last_name: 'Buyer', company: '', street_1: '1 Main St', street_2: '',
      city: 'Zanesville', state: 'Ohio', zip: '43701', country_iso2: 'US', phone: '555', email: 'Ana@Example.com',
    },
  }

  const useOrder = (overrides: Record<string, unknown> = {}, lines: unknown[] = [packLine]) => {
    server.use(
      http.get(`${API}/v2/orders/9595`, () => HttpResponse.json({ ...order, ...overrides })),
      http.get(`${API}/v2/orders/9595/products`, () => HttpResponse.json(lines)),
      http.get(`${API}/v2/orders/9595/shipping_addresses`, () =>
        HttpResponse.json([{ ...order.billing_address, shipping_method: 'Shipping costs' }]),
      ),
      http.get(`${API}/v2/orders/9595/shipments`, () =>
        HttpResponse.json([{ tracking_number: '9400', tracking_carrier: 'usps', tracking_link: 'https://t.example/9400' }]),
      ),
    )
  }

  beforeEach(() => {
    vi.stubEnv('BIGCOMMERCE_STORE_HASH', 'testhash')
    vi.stubEnv('BIGCOMMERCE_ACCESS_TOKEN', 'test-token')
    vi.stubEnv('BIGCOMMERCE_CLIENT_ID', 'test-client')
    vi.stubEnv('BIGCOMMERCE_CLIENT_SECRET', 'test-secret')
    for (const table of [db.order, db.orderItem, db.product, db.user]) {
      for (const fn of Object.values(table)) fn.mockReset()
    }
    db.$transaction.mockReset().mockImplementation(async (fn: (tx: typeof db) => unknown) => fn(db))
    db.order.create.mockResolvedValue({ id: 'o-1' })
    db.user.findFirst.mockResolvedValue(null)
  })
  afterEach(() => vi.unstubAllEnvs())

  it('creates a read-only website order, linked to the customer by email', async () => {
    useOrder()
    db.order.findUnique.mockResolvedValue(null)
    db.user.findFirst.mockResolvedValue({ id: 'u-ana' })

    const result = await mirrorBigCommerceOrder(9595, { catalog, siteProducts })

    expect(result).toEqual({ action: 'created', orderId: 'o-1', unmatched: [] })
    expect(db.user.findFirst).toHaveBeenCalledWith({
      where: { email: { equals: 'ana@example.com', mode: 'insensitive' } },
      select: { id: true },
    })
    const data = db.order.create.mock.calls[0][0].data
    expect(data).toMatchObject({
      orderNumber: 'BC-9595',
      importSource: 'bigcommerce',
      salesChannel: 'WEBSITE',
      paymentProvider: null,
      status: 'PROCESSING',
      paymentStatus: 'PAID',
      fulfillmentStatus: 'UNFULFILLED',
      subtotal: '28.0000',
      shippingCost: '9.0000',
      total: '37.0000',
      shippingMethod: 'Shipping costs',
      user: { connect: { id: 'u-ana' } },
    })
    expect(data.createdAt).toEqual(new Date('2026-09-25T01:09:04Z'))
    expect(data.items.create).toHaveLength(5)
    expect(data.adminNotes).toContain('BigCommerce order #9595')
  })

  it('records a guest by email when no account matches', async () => {
    useOrder()
    db.order.findUnique.mockResolvedValue(null)
    await mirrorBigCommerceOrder(9595, { catalog, siteProducts })
    expect(db.order.create.mock.calls[0][0].data).toMatchObject({ guestEmail: 'ana@example.com' })
  })

  it('skips an order that is not a sale yet', async () => {
    useOrder({ status_id: 0 })
    db.order.findUnique.mockResolvedValue(null)

    await expect(mirrorBigCommerceOrder(9595, { catalog, siteProducts })).resolves.toEqual({ action: 'skipped' })
    expect(db.order.create).not.toHaveBeenCalled()
  })

  it('brings an existing copy up to date, with tracking once it ships', async () => {
    useOrder({ status_id: 2, date_shipped: 'Sat, 26 Sep 2026 15:00:00 +0000' }, [{ ...packLine, quantity_shipped: 1 }])
    db.order.findUnique.mockResolvedValue({ id: 'o-1', _count: { fulfillments: 0, returnRequests: 0 } })

    const result = await mirrorBigCommerceOrder(9595, { catalog, siteProducts })

    expect(result.action).toBe('updated')
    expect(db.order.update.mock.calls[0][0].data).toMatchObject({
      status: 'SHIPPED',
      fulfillmentStatus: 'FULFILLED',
      trackingNumber: '9400',
      carrierName: 'usps',
      shippedAt: new Date('2026-09-26T15:00:00Z'),
    })
    expect(db.orderItem.deleteMany).toHaveBeenCalledWith({ where: { orderId: 'o-1' } })
    expect(db.orderItem.createMany.mock.calls[0][0].data).toHaveLength(5)
    expect(db.order.create).not.toHaveBeenCalled()
  })

  it('leaves lines alone once something on this site points at them', async () => {
    useOrder({ status_id: 2 })
    db.order.findUnique.mockResolvedValue({ id: 'o-1', _count: { fulfillments: 1, returnRequests: 0 } })
    await mirrorBigCommerceOrder(9595, { catalog, siteProducts })
    expect(db.orderItem.deleteMany).not.toHaveBeenCalled()
  })
})

describe('syncBigCommerceOrders', () => {
  beforeEach(() => {
    vi.stubEnv('BIGCOMMERCE_STORE_HASH', 'testhash')
    vi.stubEnv('BIGCOMMERCE_ACCESS_TOKEN', 'test-token')
    vi.stubEnv('BIGCOMMERCE_CLIENT_ID', 'test-client')
    vi.stubEnv('BIGCOMMERCE_CLIENT_SECRET', 'test-secret')
    db.product.findMany.mockResolvedValue([])
    db.order.findUnique.mockResolvedValue(null)
  })
  afterEach(() => vi.unstubAllEnvs())

  it('asks for orders changed since the date and counts what happened, including failures', async () => {
    let query: URLSearchParams | null = null
    server.use(
      http.get(`${API}/v3/catalog/products`, () =>
        HttpResponse.json({ data: [], meta: { pagination: { current_page: 1, total_pages: 1 } } }),
      ),
      http.get(`${API}/v2/orders`, ({ request }) => {
        query = new URL(request.url).searchParams
        return HttpResponse.json([{ id: 1 }, { id: 2 }])
      }),
      http.get(`${API}/v2/orders/1`, () => HttpResponse.json({ id: 1, status_id: 0, billing_address: {} })),
      http.get(`${API}/v2/orders/1/products`, () => HttpResponse.json([])),
      http.get(`${API}/v2/orders/2`, () => HttpResponse.json({ title: 'Nope' }, { status: 500 })),
    )
    vi.spyOn(console, 'error').mockImplementation(() => {})

    const tally = await syncBigCommerceOrders(new Date('2026-09-22T00:00:00Z'))

    expect(query!.get('min_date_modified')).toBe('2026-09-22T00:00:00.000Z')
    expect(tally).toEqual({ created: 0, updated: 0, skipped: 1, failed: 1 })
  })
})

describe('bigCommerceOrderLock', () => {
  it('refuses admin changes to a copied BigCommerce order and allows this site\'s own', async () => {
    db.order.findUnique.mockResolvedValueOnce({ importSource: 'bigcommerce' })
    const locked = await bigCommerceOrderLock('o-bc')
    expect(locked?.status).toBe(409)
    expect((await locked!.json()).error).toMatch(/managed there/)

    db.order.findUnique.mockResolvedValueOnce({ importSource: null })
    await expect(bigCommerceOrderLock('o-site')).resolves.toBeNull()
  })

  it('numbers copies after their BigCommerce order', () => {
    expect(bigCommerceOrderNumber(9595)).toBe('BC-9595')
  })
})
