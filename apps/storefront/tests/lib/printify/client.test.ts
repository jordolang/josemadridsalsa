import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { createPrintifyOrder, getPrintifyProduct, getPrintifyShopIds, listPrintifyProducts } from '@/lib/printify/client'

/** The storefront sells from every Printify shop on the account, such as an API shop and an Etsy shop. */

const API_BASE = 'https://api.printify.com/v1'
const PRODUCT_ID = '5d39b411749d0a000f30e0f4'

function product(id: string, title: string) {
  return { id, title, variants: [], images: [], options: [] }
}

const routes: Record<string, { status?: number; body: unknown }> = {}
const fetchMock = vi.fn(async (url: string) => {
  const route = routes[url.replace(API_BASE, '')]
  if (!route) return new Response(JSON.stringify({ message: 'Not found' }), { status: 404 })
  return new Response(JSON.stringify(route.body), { status: route.status ?? 200 })
})

beforeEach(() => {
  for (const key of Object.keys(routes)) delete routes[key]
  fetchMock.mockClear()
  vi.stubGlobal('fetch', fetchMock)
  vi.stubEnv('PRINTIFY_API_TOKEN', 'test-token')
  vi.stubEnv('PRINTIFY_SHOP_ID', '')
  routes['/shops.json'] = {
    body: [
      { id: 1, title: 'Website', sales_channel: 'custom_integration' },
      { id: 2, title: 'JoseMadridSalsaShop', sales_channel: 'etsy' },
    ],
  }
})

afterEach(() => {
  vi.unstubAllGlobals()
  vi.unstubAllEnvs()
})

describe('getPrintifyShopIds', () => {
  it('uses every shop on the account when PRINTIFY_SHOP_ID is unset', async () => {
    await expect(getPrintifyShopIds()).resolves.toEqual(['1', '2'])
  })

  it('uses only the shops PRINTIFY_SHOP_ID lists', async () => {
    vi.stubEnv('PRINTIFY_SHOP_ID', ' 2 , 7 ')
    await expect(getPrintifyShopIds()).resolves.toEqual(['2', '7'])
    expect(fetchMock).not.toHaveBeenCalled()
  })
})

describe('listPrintifyProducts', () => {
  it('lists the products of every shop, tagged with their shop, following pagination', async () => {
    routes['/shops/1/products.json?limit=50&page=1'] = {
      body: { current_page: 1, last_page: 1, data: [product('a'.repeat(24), 'Poster')] },
    }
    routes['/shops/2/products.json?limit=50&page=1'] = {
      body: { current_page: 1, last_page: 2, data: [product('b'.repeat(24), 'Tour Shirt')] },
    }
    routes['/shops/2/products.json?limit=50&page=2'] = {
      body: { current_page: 2, last_page: 2, data: [product('c'.repeat(24), 'Hoodie')] },
    }

    const products = await listPrintifyProducts()
    expect(products.map((p) => [p.title, p.shop_id])).toEqual([
      ['Poster', '1'],
      ['Tour Shirt', '2'],
      ['Hoodie', '2'],
    ])
  })
})

describe('getPrintifyProduct', () => {
  it('finds a product in whichever shop holds it', async () => {
    routes[`/shops/2/products/${PRODUCT_ID}.json`] = { body: product(PRODUCT_ID, 'Tour Shirt') }

    const found = await getPrintifyProduct(PRODUCT_ID)
    expect(found).toMatchObject({ title: 'Tour Shirt', shop_id: '2' })
  })

  it('returns null when no shop has it', async () => {
    await expect(getPrintifyProduct(PRODUCT_ID)).resolves.toBeNull()
  })
})

describe('createPrintifyOrder', () => {
  it('posts the order to the given shop', async () => {
    routes['/shops/2/orders.json'] = { body: { id: 'PF1' } }
    const order = {
      external_id: 'SQ1',
      line_items: [{ product_id: PRODUCT_ID, variant_id: 1, quantity: 1 }],
      shipping_method: 1,
      send_shipping_notification: false,
      address_to: { first_name: 'A', last_name: 'B', country: 'US', region: 'OH', address1: '1 Main', city: 'X', zip: '43701' },
    }

    await expect(createPrintifyOrder('2', order)).resolves.toEqual({ id: 'PF1' })
    expect(fetchMock).toHaveBeenCalledWith(`${API_BASE}/shops/2/orders.json`, expect.objectContaining({ method: 'POST' }))
  })
})
