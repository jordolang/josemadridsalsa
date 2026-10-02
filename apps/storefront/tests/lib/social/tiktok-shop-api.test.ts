// @vitest-environment node
import { createHmac } from 'crypto'
import { afterEach, describe, expect, it, vi } from 'vitest'
import {
  buildTikTokShopProduct,
  putTikTokShopProduct,
  signTikTokShopRequest,
} from '@/lib/social/tiktok-shop-api'

const SECRET = 'secret'

describe('signTikTokShopRequest', () => {
  it('signs secret + path + sorted params + body + secret, skipping sign and access_token', () => {
    const sign = signTikTokShopRequest(
      '/product/202309/products',
      { timestamp: '1700000000', app_key: 'key', sign: 'old', access_token: 'tok', shop_cipher: 'c' },
      '{"a":1}',
      SECRET,
    )
    const expected = createHmac('sha256', SECRET)
      .update('secret/product/202309/productsapp_keykeyshop_cipherctimestamp1700000000{"a":1}secret')
      .digest('hex')
    expect(sign).toBe(expected)
  })
})

describe('buildTikTokShopProduct', () => {
  it('uses uploaded image URIs, the shop warehouse and pounds converted from ounces', () => {
    const body = buildTikTokShopProduct(
      { name: 'Mild', description: null, sku: 'S1', price: 9.5, images: [], featuredImage: null, inventory: -2, weightOz: 24 },
      {},
      ['tos-uri-1'],
      'wh_1',
    )
    expect(body.main_images).toEqual([{ uri: 'tos-uri-1' }])
    expect(body.skus).toEqual([
      { seller_sku: 'S1', price: { amount: '9.50', currency: 'USD' }, inventory: [{ warehouse_id: 'wh_1', quantity: 0 }] },
    ])
    expect(body.package_weight).toEqual({ value: '1.50', unit: 'POUND' })
  })
})

describe('putTikTokShopProduct', () => {
  afterEach(() => {
    vi.unstubAllGlobals()
    vi.unstubAllEnvs()
  })

  it('signs every Partner API call and sends the shop token, not a TikTok login token', async () => {
    vi.stubEnv('TIKTOK_SHOP_APP_KEY', 'key')
    vi.stubEnv('TIKTOK_SHOP_APP_SECRET', SECRET)
    vi.stubEnv('TIKTOK_SHOP_REFRESH_TOKEN', 'refresh')
    const ok = (data: unknown) => new Response(JSON.stringify({ code: 0, message: 'Success', data }))
    const fetchMock = vi.fn(async (input: string | URL | Request) => {
      const url = String(input)
      if (url.startsWith('https://auth.tiktok-shops.com')) return ok({ access_token: 'shop-token' })
      if (url.includes('/authorization/202309/shops')) return ok({ shops: [{ id: 'shop1', cipher: 'cipher1' }] })
      if (url === 'https://cdn.example/a.jpg') return new Response(new Blob(['img']))
      if (url.includes('/images/upload')) return ok({ uri: 'tos-1' })
      if (url.includes('/logistics/202309/warehouses')) return ok({ warehouses: [{ id: 'wh1', type: 'SALES_WAREHOUSE', is_default: true }] })
      return ok({ product_id: 'p1' })
    })
    vi.stubGlobal('fetch', fetchMock)

    const result = await putTikTokShopProduct(
      { name: 'Mild', description: 'x', sku: 'S1', price: 10, images: [], featuredImage: 'https://cdn.example/a.jpg', inventory: 3, weightOz: 16 },
      {},
      null,
      null,
    )

    expect(result).toEqual({ success: true, externalId: 'p1', externalUrl: 'https://shop.tiktok.com/view/product/p1' })
    const apiCalls = fetchMock.mock.calls.filter(([u]) => String(u).startsWith('https://open-api.tiktokglobalshop.com'))
    expect(apiCalls).toHaveLength(4)
    for (const [u, init] of apiCalls) {
      const url = new URL(String(u))
      expect(url.searchParams.get('sign')).toMatch(/^[0-9a-f]{64}$/)
      expect((init as RequestInit).headers).toMatchObject({ 'x-tts-access-token': 'shop-token' })
    }
    const create = apiCalls.at(-1)!
    const createUrl = new URL(String(create[0]))
    expect(createUrl.pathname).toBe('/product/202309/products')
    expect(createUrl.searchParams.get('shop_cipher')).toBe('cipher1')
    const query = Object.fromEntries(createUrl.searchParams)
    expect(createUrl.searchParams.get('sign')).toBe(
      signTikTokShopRequest(createUrl.pathname, query, (create[1] as RequestInit).body as string, SECRET),
    )
    // Image upload refuses shop_cipher.
    const upload = apiCalls.find(([u]) => String(u).includes('/images/upload'))!
    expect(new URL(String(upload[0])).searchParams.has('shop_cipher')).toBe(false)
  })

  it('reports missing configuration instead of calling TikTok', async () => {
    const fetchMock = vi.fn()
    vi.stubGlobal('fetch', fetchMock)
    const result = await putTikTokShopProduct(
      { name: 'Mild', description: null, sku: 'S1', price: 10, images: ['a'], featuredImage: null, inventory: 1, weightOz: null },
      {}, null, null,
    )
    expect(result.success).toBe(false)
    expect(fetchMock).not.toHaveBeenCalled()
  })
})
